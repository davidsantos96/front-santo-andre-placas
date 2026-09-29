import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { entrarComo } from './utils';
import { db } from '@/mocks/db';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

const linha = async (texto: string | RegExp) => (await screen.findByText(texto)).closest('tr')!;
const gerente = 'gerente@sap.com';

describe('Serviços', () => {
  it('lista com categoria, preço, pedidos no mês e status', async () => {
    await entrarComo('/servicos', gerente);
    const r = await linha('Par de placas Mercosul (carro)');
    expect(within(r).getByText('EMPLACAMENTO')).toBeInTheDocument();
    expect(within(r).getByText(/R\$\s316,90/)).toBeInTheDocument();
    expect(within(r).getByRole('switch', { name: /ativo/ })).toBeChecked();
    // pedidos do mês (não cancelados) do serviço 1: 1058, 1054, 1053, 1050 — só os criados neste mês entram
    await waitFor(() => expect(within(r).getAllByRole('cell')[3]).not.toHaveTextContent('…'));
  });

  it('cria serviço (preço em centavos) pelo modal', async () => {
    await entrarComo('/servicos', gerente);
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo serviço' }));
    const m = await screen.findByRole('dialog', { name: 'Novo serviço' });
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    expect(await within(m).findByText('Informe o nome')).toBeInTheDocument();
    expect(within(m).getByText('Escolha a categoria')).toBeInTheDocument();
    expect(within(m).getByText('Informe um preço maior que zero')).toBeInTheDocument();

    await userEvent.type(within(m).getByLabelText('Nome'), 'Película refletiva extra');
    await userEvent.selectOptions(within(m).getByLabelText('Categoria'), 'SERVIÇOS');
    await userEvent.type(within(m).getByLabelText('Preço'), '12550');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Serviço criado');
    expect(db.servicos.at(-1)).toMatchObject({ nome: 'Película refletiva extra', categoria: 'SERVIÇOS', precoCentavos: 12550, ativo: true });
    expect(await screen.findByText('Película refletiva extra')).toBeInTheDocument();
  });

  it('edita serviço clicando na linha', async () => {
    await entrarComo('/servicos', gerente);
    await userEvent.click(await screen.findByText('Lacre / desamassamento'));
    const m = await screen.findByRole('dialog', { name: 'Editar serviço' });
    expect(within(m).getByLabelText('Categoria')).toHaveValue('SERVIÇOS');
    const preco = within(m).getByLabelText('Preço');
    await userEvent.clear(preco);
    await userEvent.type(preco, '9900');
    await userEvent.click(within(m).getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Serviço atualizado');
    expect(db.servicos.find((s) => s.id === 5)!.precoCentavos).toBe(9900);
  });

  it('desativar é otimista, a linha continua (reativável) e o serviço some do Novo pedido', async () => {
    const { router } = await entrarComo('/servicos', gerente);
    const sw = within(await linha('Lacre / desamassamento')).getByRole('switch');
    await userEvent.click(sw);
    await waitFor(() => expect(sw).not.toBeChecked()); // otimista: muda antes da resposta do servidor
    expect(sw).toHaveFocus(); // a célula não remonta: o foco fica no switch
    await screen.findByText('Lacre / desamassamento desativado');
    expect(db.servicos.find((s) => s.id === 5)!.ativo).toBe(false);
    expect(within(await linha('Lacre / desamassamento')).getByRole('switch')).not.toBeChecked();

    await router.navigate('/pedidos/novo');
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar cliente' }), 'Renata');
    await userEvent.click(await screen.findByRole('option', { name: /Renata Sampaio/ }));
    await userEvent.click(await screen.findByRole('radio', { name: /DPT7B02/ }));
    expect(await screen.findByRole('radio', { name: /Segunda via de placa/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Lacre/ })).not.toBeInTheDocument();
  });
});

describe('Estoque', () => {
  it('destaca itens abaixo do mínimo com texto (não só cor) e mostra "—" para SKU/unidade ausentes', async () => {
    await entrarComo('/estoque');
    expect(await screen.findByRole('status')).toHaveTextContent('3 abaixo do mínimo');
    const baixo = await linha('Lacre inviolável');
    expect(baixo).toHaveTextContent('Abaixo do mínimo');
    expect(baixo).toHaveClass('bg-alerta-bgHover');
    expect(within(baixo).getByText('LAC-STD')).toBeInTheDocument();
    expect(await linha('Placa Mercosul carro (par)')).not.toHaveTextContent('Abaixo do mínimo');
    const pelicula = await linha('Película refletiva');
    expect(within(pelicula).getAllByText('—')).toHaveLength(1); // sku nulo
    expect(within(pelicula).getByRole('meter')).toHaveAttribute('aria-valuenow', '3');
  });

  it('ATENDENTE movimenta (entrada) e o badge da sidebar atualiza', async () => {
    await entrarComo('/estoque'); // atendente
    expect(await screen.findByLabelText('3 itens abaixo do mínimo')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Movimentar Lacre inviolável' }));
    const m = await screen.findByRole('dialog', { name: 'Movimentar estoque' });
    await userEvent.type(within(m).getByLabelText('Quantidade'), '20');
    await userEvent.type(within(m).getByLabelText(/Observação/), 'Compra');
    await userEvent.click(within(m).getByRole('button', { name: 'Registrar' }));
    await screen.findByText('Entrada de 20 — Lacre inviolável');
    expect(db.estoque.find((i) => i.sku === 'LAC-STD')!.quantidade).toBe(28);
    expect(await screen.findByLabelText('2 itens abaixo do mínimo')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('2 abaixo do mínimo');
  });

  it('saída valida quantidade inteira > 0 e ≤ saldo', async () => {
    await entrarComo('/estoque');
    await userEvent.click(await screen.findByRole('button', { name: 'Movimentar Lacre inviolável' }));
    const m = await screen.findByRole('dialog', { name: 'Movimentar estoque' });
    await userEvent.click(within(m).getByRole('radio', { name: 'Saída' }));
    await userEvent.type(within(m).getByLabelText('Quantidade'), '9');
    await userEvent.click(within(m).getByRole('button', { name: 'Registrar' }));
    expect(await within(m).findByText('Saldo insuficiente (disponível: 8)')).toBeInTheDocument();
    const q = within(m).getByLabelText('Quantidade');
    await userEvent.clear(q);
    await userEvent.type(q, '0');
    await userEvent.click(within(m).getByRole('button', { name: 'Registrar' }));
    expect(await within(m).findByText('A quantidade deve ser maior que zero')).toBeInTheDocument();
    await userEvent.clear(q);
    await userEvent.type(q, '8');
    await userEvent.click(within(m).getByRole('button', { name: 'Registrar' }));
    await screen.findByText('Saída de 8 — Lacre inviolável');
    expect(db.estoque.find((i) => i.sku === 'LAC-STD')!.quantidade).toBe(0);
  });
});

describe('Financeiro', () => {
  it('padrão: aba Pagamentos, últimos 7 dias, com total e contagem', async () => {
    await entrarComo('/financeiro', gerente);
    expect(await screen.findByRole('tab', { name: /Pagamentos/ })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('6 pagamentos ·');
    expect(screen.getByText(/R\$\s1\.669,80/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pagamentos/ })).toHaveTextContent('6');
    const r = await linha('Renata Sampaio');
    expect(r).toHaveTextContent('Pix');
    expect(within(r).getAllByRole('cell')[0]).toHaveTextContent(/^Hoje · \d\d:\d\d$/);
    expect(within(r).getByText('Bruna Costa')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Registrado por' })).toBeInTheDocument();
  });

  it('filtro por forma e período ficam na URL; vazio oferece "Ver últimos 30 dias"', async () => {
    const { router } = await entrarComo('/financeiro', gerente);
    await screen.findByText('6 pagamentos ·');
    await userEvent.selectOptions(screen.getByLabelText('Forma'), 'BOLETO');
    await screen.findByText('1 pagamento ·');
    expect(router.state.location.search).toContain('forma=BOLETO');
    await userEvent.selectOptions(screen.getByLabelText('Período'), 'hoje');
    expect(await screen.findByText('Nenhum pagamento neste período com esse filtro.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver últimos 30 dias' }));
    await screen.findByText('6 pagamentos ·'); // 30 dias e sem filtro de forma
    expect(router.state.location.search).toContain('periodo=30');
    expect(router.state.location.search).not.toContain('forma=');
  });

  it('linha do pagamento abre o pedido', async () => {
    const { router } = await entrarComo('/financeiro', gerente);
    await userEvent.click(await screen.findByText('Renata Sampaio'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/1056'));
  });

  it('aba Caixa (fluxo 4): KPIs por forma + total do período recalculam ao trocar o período', async () => {
    await entrarComo('/financeiro?aba=caixa', gerente);
    // hoje: Pix 2 × 249,00 + crédito 316,90 = 814,90
    const total = async () => (await screen.findByText('TOTAL DO PERÍODO')).parentElement!;
    await waitFor(async () => expect(await total()).toHaveTextContent(/R\$\s814,90/));
    expect(await total()).toHaveTextContent('3 pagamentos');
    expect(screen.getByText('PIX').parentElement).toHaveTextContent(/R\$\s498,00.*2 pagamentos/);
    expect(screen.getByText('CARTÃO DE CRÉDITO').parentElement).toHaveTextContent(/R\$\s316,90.*1 pagamento/);
    expect(screen.queryByText('BOLETO')).not.toBeInTheDocument(); // só formas com pagamento no período
    expect(screen.queryByRole('button', { name: /fechar caixa|reabrir/i })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Período'), '7');
    await waitFor(async () => expect(await total()).toHaveTextContent(/R\$\s1\.669,80/));
    expect(await total()).toHaveTextContent('6 pagamentos');
    expect(await screen.findByText('BOLETO')).toBeInTheDocument();
    expect(screen.getByText('DINHEIRO')).toBeInTheDocument();
    expect(screen.getByText('PAGAMENTOS DO PERÍODO · SP')).toBeInTheDocument();
  });

  it('registrar pagamento no detalhe aparece em Financeiro → Pagamentos e no total do Caixa (fluxo 3)', async () => {
    const { router } = await entrarComo('/pedidos/1058', gerente);
    await screen.findByRole('heading', { name: '#1058' });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    await screen.findByText(/Pago via Pix/);

    await router.navigate('/financeiro?periodo=hoje');
    await screen.findByText('4 pagamentos ·');
    expect((await linha('Marcos Vilela'))).toHaveTextContent('Pix');

    await router.navigate('/financeiro?aba=caixa');
    const total = (await screen.findByText('TOTAL DO PERÍODO')).parentElement!;
    await waitFor(() => expect(total).toHaveTextContent(/R\$\s1\.131,80/));
    expect(total).toHaveTextContent('4 pagamentos');
  });

  it('ATENDENTE não acessa /financeiro nem /servicos (redireciona)', async () => {
    const { router } = await entrarComo('/pedidos');
    await screen.findByRole('navigation', { name: 'Navegação principal' });
    await router.navigate('/financeiro');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos'));
    await router.navigate('/servicos');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos'));
  });
});
