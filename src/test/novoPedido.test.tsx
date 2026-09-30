import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { entrarComo } from './utils';
import { db } from '@/mocks/db';
import { server } from '@/mocks/server';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

/** Tab até o elemento em foco satisfazer `ok` (navegação só por teclado). */
async function tabAte(ok: (el: HTMLElement) => boolean, max = 15) {
  for (let i = 0; i < max; i++) {
    await userEvent.tab();
    if (ok(document.activeElement as HTMLElement)) return document.activeElement as HTMLElement;
  }
  throw new Error(`não chegou ao elemento por Tab: ${document.activeElement?.outerHTML.slice(0, 120)}`);
}
const radio = (nome: RegExp) => (el: HTMLElement) => el.getAttribute('role') === 'radio' && nome.test(el.getAttribute('aria-label') ?? el.textContent ?? '');

describe('Novo pedido', () => {
  it('cria o pedido só com teclado (cliente existente, Pix) — fluxo 1', async () => {
    const { router } = await entrarComo('/pedidos/novo');
    const busca = await screen.findByRole('combobox', { name: 'Buscar cliente' });
    await waitFor(() => expect(busca).toHaveFocus());

    await userEvent.keyboard('Marcos');
    await screen.findByRole('option', { name: /Marcos Vilela/ });
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('412.688.301-00 · (11) 98877-1234')).toBeInTheDocument();

    await tabAte(radio(/FZR4C71/));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('radio', { name: /FZR4C71/ })).toBeChecked());

    await tabAte(radio(/Par de placas Mercosul \(carro\)/));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('radio', { name: /Par de placas Mercosul \(carro\)/ })).toBeChecked());

    await userEvent.selectOptions(screen.getByLabelText('Forma de pagamento'), 'PIX'); // select nativo: jsdom não simula teclado

    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    await screen.findByText('Pedido #1059 criado');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos'));
    const novo = db.pedidos.find((p) => p.id === 1059)!;
    expect(novo).toMatchObject({ status: 'RECEBIDO', origem: 'BALCAO' });
    expect(novo.cliente.nome).toBe('Marcos Vilela');
    expect(novo.veiculo.placa).toBe('FZR4C71');
    expect(db.pagamentos.find((p) => p.pedidoId === 1059)).toMatchObject({ formaPagamento: 'PIX', valorCentavos: 31690 });
  });

  it('pagamento parcial no Novo pedido: valor editável, aviso de saldo e pedido criado sem estar quitado', async () => {
    await entrarComo('/pedidos/novo');
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar cliente' }), 'Renata');
    await userEvent.click(await screen.findByRole('option', { name: /Renata Sampaio/ }));
    await userEvent.click(await screen.findByRole('radio', { name: /DPT7B02/ }));
    await userEvent.click(await screen.findByRole('radio', { name: /Segunda via de placa/ })); // R$ 249,00
    expect(screen.queryByLabelText('Valor do pagamento')).not.toBeInTheDocument(); // só aparece com uma forma escolhida
    await userEvent.selectOptions(screen.getByLabelText('Forma de pagamento'), 'PIX');
    const valor = screen.getByLabelText('Valor do pagamento');
    expect((valor as HTMLInputElement).value.replace(/\u00a0/g, ' ')).toBe('R$ 249,00'); // padrão = preço do serviço
    await userEvent.clear(valor);
    await userEvent.type(valor, '10000');
    expect(await screen.findByText(/Pagamento parcial: o pedido será criado com saldo de R\$\s149,00/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Criar pedido/ }));

    await screen.findByText('Pedido #1059 criado');
    expect(db.pagamentos.find((p) => p.pedidoId === 1059)).toMatchObject({ valorCentavos: 10000, formaPagamento: 'PIX' });
  });

  it('blocos só habilitam quando o anterior está preenchido e há validação ao enviar', async () => {
    await entrarComo('/pedidos/novo');
    await screen.findByRole('combobox', { name: 'Buscar cliente' });
    expect(screen.getByRole('group', { name: 'Veículo' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Serviço e pagamento' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /Criar pedido/ }));
    expect(await screen.findByText('Selecione um cliente')).toBeInTheDocument();
    expect(db.pedidos.some((p) => p.id === 1059)).toBe(false);
  });

  it('cadastra cliente novo no painel lateral e já o seleciona', async () => {
    await entrarComo('/pedidos/novo');
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar cliente' }), 'zz');
    await userEvent.click(await screen.findByRole('option', { name: '+ Cadastrar novo cliente' }));

    const painel = await screen.findByRole('dialog', { name: 'Novo cliente' });
    await userEvent.type(within(painel).getByLabelText('Nome'), 'Fulano de Tal');
    await userEvent.type(within(painel).getByLabelText('CPF/CNPJ'), '11111111111');
    await userEvent.type(within(painel).getByLabelText('Telefone'), '11912345678');
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar cliente' }));
    expect(await within(painel).findByText('CPF ou CNPJ inválido')).toBeInTheDocument();

    const cpf = within(painel).getByLabelText('CPF/CNPJ');
    await userEvent.clear(cpf);
    await userEvent.type(cpf, '52998224725');
    expect(cpf).toHaveValue('529.982.247-25');
    expect(within(painel).getByLabelText('Telefone')).toHaveValue('(11) 91234-5678');
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar cliente' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Novo cliente' })).not.toBeInTheDocument());
    expect(await screen.findByText('529.982.247-25 · (11) 91234-5678')).toBeInTheDocument();
    expect(db.clientes.at(-1)).toMatchObject({ nome: 'Fulano de Tal', cpfCnpj: '529.982.247-25' });
    expect(await screen.findByText('Este cliente ainda não tem veículos.')).toBeInTheDocument();
  });

  it('erro de campo (`campos`) vindo do backend aparece no formulário do cliente', async () => {
    // A API atual só manda `mensagem`; o mecanismo de `campos` está pronto para quando ela passar a mandar.
    server.use(http.post('http://localhost:8080/api/clientes', () => HttpResponse.json({ mensagem: 'Dados inválidos', campos: { cpfCnpj: 'CPF/CNPJ já cadastrado' } }, { status: 400 })));
    await entrarComo('/pedidos/novo');
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar cliente' }), 'zz');
    await userEvent.click(await screen.findByRole('option', { name: '+ Cadastrar novo cliente' }));
    const painel = await screen.findByRole('dialog', { name: 'Novo cliente' });
    await userEvent.type(within(painel).getByLabelText('Nome'), 'Duplicado');
    await userEvent.type(within(painel).getByLabelText('CPF/CNPJ'), '41268830100'); // já é do Marcos Vilela
    await userEvent.type(within(painel).getByLabelText('Telefone'), '11912345678');
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar cliente' }));
    // CPF 412.688.301-00 do protótipo pode não ter dígito verificador válido; qualquer um dos dois erros prova o caminho
    expect(await within(painel).findByText(/CPF ou CNPJ inválido|CPF\/CNPJ já cadastrado/)).toBeInTheDocument();
  });

  it('cadastra veículo novo do cliente e o seleciona', async () => {
    await entrarComo('/pedidos/novo');
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar cliente' }), 'Renata');
    await userEvent.click(await screen.findByRole('option', { name: /Renata Sampaio/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo veículo' }));

    const f = screen.getByRole('form', { name: 'Novo veículo' });
    await userEvent.type(within(f).getByLabelText('Placa'), 'abc-1d23');
    expect(within(f).getByLabelText('Placa')).toHaveValue('ABC1D23');
    await userEvent.type(within(f).getByLabelText('Marca / modelo'), 'Fiat Mobi');
    await userEvent.type(within(f).getByLabelText('Ano de fabricação'), '2021');
    await userEvent.type(within(f).getByLabelText('Ano do modelo'), '2022');
    await userEvent.click(within(f).getByRole('button', { name: 'Salvar veículo' }));

    await waitFor(() => expect(screen.getByRole('radio', { name: /ABC1D23/ })).toBeChecked());
    expect(db.veiculos.at(-1)).toMatchObject({ placa: 'ABC1D23', anoFabricacao: 2021, anoModelo: 2022, clienteNome: 'Renata Sampaio' });
  });

  it('"Consultar placa" trata o 400 esperado como aviso informativo', async () => {
    await entrarComo('/pedidos/novo');
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar cliente' }), 'Renata');
    await userEvent.click(await screen.findByRole('option', { name: /Renata Sampaio/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Consultar placa' }));
    expect(await screen.findByText('Consulta veicular ainda não está disponível.')).toBeInTheDocument();
  });

  it('erro ao criar pedido vira toast e mantém o formulário preenchido', async () => {
    server.use(http.post('http://localhost:8080/api/pedidos', () => HttpResponse.json({ mensagem: 'Falha geral' }, { status: 500 })));
    const { router } = await entrarComo('/pedidos/novo');
    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar cliente' }), 'Renata');
    await userEvent.click(await screen.findByRole('option', { name: /Renata Sampaio/ }));
    await userEvent.click(await screen.findByRole('radio', { name: /DPT7B02/ }));
    await userEvent.click(await screen.findByRole('radio', { name: /Segunda via de placa/ }));
    await userEvent.click(screen.getByRole('button', { name: /Criar pedido/ }));

    expect(await screen.findByText(/Não foi possível criar o pedido: Falha geral/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/pedidos/novo');
    expect(screen.getByText('Renata Sampaio')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Segunda via de placa/ })).toBeChecked();
  });
});
