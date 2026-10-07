import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { entrarComo } from './utils';
import { db } from '@/mocks/db';
import { reloginCancelado } from '@/api/sessaoEventos';
import { dataBR, dataHoraCompleta, lerData } from '@/lib/datas';
import { nomeAutor } from '@/lib/autor';

afterEach(() => reloginCancelado());

const gerente = 'gerente@sap.com';
const admin = 'admin@sap.com';
const linha = async (texto: string | RegExp) => (await screen.findByText(texto)).closest('tr')!;

describe('Rastreabilidade — utilitários', () => {
  it('nomeAutor: snapshot como veio; null e "sistema" viram "Sistema"', () => {
    expect(nomeAutor('Bruna Costa')).toBe('Bruna Costa');
    expect(nomeAutor(null)).toBe('Sistema');
    expect(nomeAutor(undefined)).toBe('Sistema');
    expect(nomeAutor('sistema')).toBe('Sistema');
    expect(nomeAutor(' Sistema ')).toBe('Sistema');
  });

  it('timestamps da API vêm sem fuso e (às vezes) com nanossegundos: lê como hora local, sem converter', () => {
    const d = lerData('2026-10-07T16:43:05.803261971');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 10, 7, 16, 43, 5]);
    expect(dataHoraCompleta('2026-10-07T16:43:05.803261971')).toBe('07/10/2026 16:43');
    expect(dataHoraCompleta('2026-10-07T16:43:05')).toBe('07/10/2026 16:43');
    expect(dataBR('2026-10-07T23:59:59.999999')).toBe('07/10/2026'); // por texto: nunca "vira" outro dia
  });
});

describe('Rastreabilidade — cliente, veículo e pedido', () => {
  it('cliente: "Cadastrado por X em …" e, depois de editar, "Última alteração por Y em …"', async () => {
    await entrarComo('/clientes/3', gerente);
    const rodape = await screen.findByTestId('autoria');
    expect(rodape).toHaveTextContent(/^Cadastrado por Bruna Costa em \d{2}\/\d{2}\/\d{4}$/); // nunca editado: sem trecho de alteração
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.clear(screen.getByLabelText('Nome'));
    await userEvent.type(screen.getByLabelText('Nome'), 'Renata S. Sampaio');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(screen.getByTestId('autoria')).toHaveTextContent(/Última alteração por Carlos Menezes em \d{2}\/\d{2}\/\d{4}/));
    expect(db.clientes.find((c) => c.id === 3)).toMatchObject({ atualizadoPor: 'Carlos Menezes', atualizadoPorId: 2 });
  });

  it('autor "sistema" ou ausente aparece como "Sistema"; sem nenhum dado o rodapé não aparece', async () => {
    db.clientes.find((c) => c.id === 3)!.criadoPor = 'sistema';
    await entrarComo('/clientes/3', gerente);
    expect(await screen.findByTestId('autoria')).toHaveTextContent(/^Cadastrado por Sistema em /);
  });

  it('veículo: rodapé de autoria no detalhe', async () => {
    const v = db.veiculos.find((x) => x.placa === 'DPT7B02')!;
    await entrarComo(`/veiculos/${v.id}`, gerente);
    expect(await screen.findByTestId('autoria')).toHaveTextContent(/Cadastrado por Bruna Costa em \d{2}\/\d{2}\/\d{4}/);
  });

  it('tabela de pedidos mostra o preço COBRADO (snapshot), não o preço atual do serviço', async () => {
    const ped = db.pedidos.find((p) => p.id === 1056)!;
    ped.servico.precoCentavos = 99900; // o serviço foi reajustado depois do pedido
    await entrarComo('/pedidos?visao=tabela', gerente);
    const r = await linha('Renata Sampaio');
    expect(within(r).getByText(/R\$\s*249,00/)).toBeInTheDocument(); // serviço 3 custava R$ 249,00 quando o pedido foi feito
    expect(within(r).queryByText(/999,00/)).not.toBeInTheDocument();
  });

  it('histórico do pedido e pagamento mostram o autor gravado ("Sistema" quando não há)', async () => {
    db.historico.find((h) => h.pedidoId === 1056)!.alteradoPor = 'sistema';
    await entrarComo('/pedidos/1056', gerente);
    expect(await screen.findAllByText(/Sistema · /)).not.toHaveLength(0);
  });
});

describe('Rastreabilidade — estoque: movimentações', () => {
  it('aba lista movimentações (mais recente primeiro) com tipo, quantidade, autor e a origem da baixa automática', async () => {
    db.movimentacoes.push(
      { id: 1, itemEstoqueId: 3, itemEstoqueNome: 'Lacre inviolável', tipo: 'ENTRADA', quantidade: 10, pedidoId: null, registradoPor: 'Bruna Costa', registradoPorId: 1, criadoEm: '2026-10-06T09:00:00.123456' },
      { id: 2, itemEstoqueId: 3, itemEstoqueNome: 'Lacre inviolável', tipo: 'SAIDA', quantidade: 2, pedidoId: 1050, registradoPor: 'Carlos Menezes', registradoPorId: 2, criadoEm: '2026-10-07T10:30:00.123456' },
    );
    const { router } = await entrarComo('/estoque?aba=movimentacoes'); // atendente também vê
    const baixa = await linha('Baixa automática ·');
    expect(baixa).toHaveTextContent('Saída');
    expect(baixa).toHaveTextContent('−2');
    expect(baixa).toHaveTextContent('Carlos Menezes');
    expect(baixa).toHaveTextContent('07/10/2026 10:30');
    const entrada = await linha('Manual');
    expect(entrada).toHaveTextContent('+10');
    expect(entrada).toHaveTextContent('Bruna Costa');
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas[0]).toBe(baixa); // mais recente primeiro
    await userEvent.click(within(baixa).getByRole('link', { name: 'Pedido #1050' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/1050'));
  });

  it('filtro por item e estado vazio', async () => {
    db.movimentacoes.push({ id: 1, itemEstoqueId: 3, itemEstoqueNome: 'Lacre inviolável', tipo: 'ENTRADA', quantidade: 1, pedidoId: null, registradoPor: 'Bruna Costa', registradoPorId: 1, criadoEm: '2026-10-07T09:00:00' });
    await entrarComo('/estoque?aba=movimentacoes');
    await screen.findByText('Manual');
    await userEvent.selectOptions(screen.getByLabelText('Item'), 'Película refletiva');
    expect(await screen.findByText('Nenhuma movimentação para este item.')).toBeInTheDocument();
  });

  it('movimentar pela tela grava autor e aparece na aba; baixa automática do Kanban também', async () => {
    await entrarComo('/estoque');
    await userEvent.click(await screen.findByRole('button', { name: 'Movimentar Lacre inviolável' }));
    const m = await screen.findByRole('dialog', { name: 'Movimentar estoque' });
    await userEvent.clear(within(m).getByLabelText('Quantidade'));
    await userEvent.type(within(m).getByLabelText('Quantidade'), '4');
    await userEvent.click(within(m).getByRole('button', { name: 'Registrar' }));
    await screen.findByText(/Entrada de 4/);
    expect(db.movimentacoes.at(-1)).toMatchObject({ tipo: 'ENTRADA', quantidade: 4, registradoPor: 'Bruna Costa', registradoPorId: 1 });
    await userEvent.click(screen.getByRole('tab', { name: 'Movimentações' }));
    expect(await screen.findByText('Manual')).toBeInTheDocument();
  });

  it('coluna "Cadastro" do item mostra quem criou', async () => {
    await entrarComo('/estoque');
    expect(within(await linha('Lacre inviolável')).getByText(/Carlos Menezes · \d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
  });
});

describe('Rastreabilidade — histórico (auditoria) de serviços e usuários', () => {
  it('serviço: editar o preço gera linha "Preço: R$ … → R$ …" com autor; "Só preço" filtra; valores vêm como texto', async () => {
    await entrarComo('/servicos', gerente);
    await userEvent.click(await screen.findByText('Lacre / desamassamento'));
    const m = await screen.findByRole('dialog', { name: 'Editar serviço' });
    const preco = within(m).getByLabelText('Preço');
    await userEvent.clear(preco);
    await userEvent.type(preco, '9900');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Serviço atualizado');
    expect(db.auditoria.at(-1)).toMatchObject({ entidade: 'SERVICO', campo: 'precoCentavos', valorNovo: '9900' }); // texto, não número

    await userEvent.click(screen.getByRole('button', { name: 'Histórico de Lacre / desamassamento' }));
    const h = await screen.findByRole('dialog', { name: /Histórico de Lacre \/ desamassamento/ });
    const itens = await within(h).findAllByRole('listitem');
    expect(itens).toHaveLength(1);
    expect(itens[0]).toHaveTextContent(/Preço: R\$\s*\d+,\d{2} → R\$\s*99,00/);
    expect(itens[0]).toHaveTextContent(/Carlos Menezes · \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    await userEvent.click(within(h).getByRole('radio', { name: 'Só preço' }));
    expect(within(h).getAllByRole('listitem')).toHaveLength(1);
  });

  it('serviço sem alterações mostra o estado vazio; "Só preço" sem mudança de preço também', async () => {
    await entrarComo('/servicos', gerente);
    await userEvent.click(await screen.findByRole('button', { name: 'Histórico de Lacre / desamassamento' }));
    const h = await screen.findByRole('dialog');
    expect(await within(h).findByText('Nenhum registro de alteração.')).toBeInTheDocument();
    await userEvent.click(within(h).getByRole('radio', { name: 'Só preço' }));
    expect(within(h).getByText('O preço nunca foi alterado.')).toBeInTheDocument();
  });

  it('serviço: reenviar o mesmo valor não gera registro; mudar nome e preço gera uma linha por campo', async () => {
    await entrarComo('/servicos', gerente);
    await userEvent.click(await screen.findByText('Lacre / desamassamento'));
    let m = await screen.findByRole('dialog', { name: 'Editar serviço' });
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' })); // nada mudou
    await screen.findByText('Serviço atualizado');
    expect(db.auditoria).toHaveLength(0);

    await userEvent.click(await screen.findByText('Lacre / desamassamento'));
    m = await screen.findByRole('dialog', { name: 'Editar serviço' });
    await userEvent.type(within(m).getByLabelText('Nome'), ' XL');
    const preco = within(m).getByLabelText('Preço');
    await userEvent.clear(preco);
    await userEvent.type(preco, '7000');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(db.auditoria).toHaveLength(2));
    expect(db.auditoria.map((r) => r.campo).sort()).toEqual(['nome', 'precoCentavos']);
  });

  it('usuário: criação, troca de papel e reset de senha aparecem no histórico — a senha nunca', async () => {
    await entrarComo('/usuarios', admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Bruna Costa' }));
    const e = await screen.findByRole('dialog', { name: 'Editar usuário' });
    await userEvent.selectOptions(within(e).getByLabelText('Papel'), 'GERENTE');
    await userEvent.click(within(e).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha de Bruna Costa' }));
    const s = await screen.findByRole('dialog', { name: 'Redefinir senha' });
    await userEvent.type(within(s).getByLabelText('Nova senha provisória'), 'segredo-123');
    await userEvent.click(within(s).getByRole('button', { name: 'Redefinir senha' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Histórico de Bruna Costa' }));
    const h = await screen.findByRole('dialog', { name: /Histórico de Bruna Costa/ });
    const itens = await within(h).findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Senha redefinida'); // mais recente primeiro
    expect(itens[1]).toHaveTextContent('Papel: Atendente → Gerente');
    expect(h).not.toHaveTextContent('segredo-123');
    expect(h).not.toHaveTextContent('Só preço'); // filtro de preço é só de serviço
  });

  it('GERENTE/ATENDENTE: o backend nega /auditoria (403) e o front não oferece o histórico de usuários', async () => {
    const { router } = await entrarComo('/dashboard', gerente);
    await router.navigate('/usuarios');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard')); // módulo é ADMIN
  });
});
