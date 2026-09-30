import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { entrarComo } from './utils';
import { server } from '@/mocks/server';
import { db } from '@/mocks/db';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

const linha = async (texto: string) => (await screen.findByText(texto)).closest('tr')!;

describe('Clientes — lista', () => {
  it('mostra nome, documento, telefone, placas e total de pedidos', async () => {
    await entrarComo('/clientes');
    expect(await screen.findByText('10 clientes')).toBeInTheDocument();
    const marcos = await linha('Marcos Vilela');
    expect(within(marcos).getByText('412.688.301-00')).toBeInTheDocument();
    expect(within(marcos).getByText('(11) 98877-1234')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(marcos).getByRole('img', { name: 'Placa FZR4C71' })).toBeInTheDocument();
      expect(within(marcos).getByRole('img', { name: 'Placa EBX9A55' })).toBeInTheDocument();
    });
    await waitFor(() => expect(within(marcos).getAllByRole('cell').at(-1)).toHaveTextContent('2')); // pedidos 1058 e 1055
  });

  it('busca fica na URL e filtra (nome, telefone ou CPF/CNPJ)', async () => {
    const { router } = await entrarComo('/clientes');
    await screen.findByText('Renata Sampaio');
    await userEvent.type(screen.getByLabelText('Buscar cliente'), 'renata');
    expect(await screen.findByText('1 cliente')).toBeInTheDocument(); // só depois de recarregar (o skeleton não tem contagem)
    expect(screen.getByText('Renata Sampaio')).toBeInTheDocument();
    expect(screen.queryByText('Marcos Vilela')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?busca=renata');
  });

  it('vazio oferece "Cadastrar" (abre o painel) e o novo cliente leva ao detalhe', async () => {
    const { router } = await entrarComo('/clientes?busca=zzzz');
    expect(await screen.findByText('Nenhum cliente encontrado para "zzzz".')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));
    const painel = await screen.findByRole('dialog', { name: 'Novo cliente' });
    await userEvent.type(within(painel).getByLabelText('Nome'), 'Beltrano');
    await userEvent.type(within(painel).getByLabelText('CPF/CNPJ'), '52998224725');
    await userEvent.type(within(painel).getByLabelText('Telefone'), '11987654321');
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar cliente' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/clientes\/\d+$/));
    expect(await screen.findByRole('heading', { name: 'Beltrano' })).toBeInTheDocument();
    expect(db.clientes.at(-1)!.nome).toBe('Beltrano');
  });

  it('clicar na linha abre o detalhe', async () => {
    const { router } = await entrarComo('/clientes');
    await userEvent.click(await screen.findByText('Renata Sampaio'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/clientes/3'));
  });
});

describe('Clientes — detalhe', () => {
  it('abas Dados · Veículos · Pedidos sincronizadas com ?aba= e com contagens', async () => {
    const { router } = await entrarComo('/clientes/1');
    expect(await screen.findByRole('heading', { name: 'Marcos Vilela' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Dados/ })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: /Veículos/ }));
    expect(router.state.location.search).toContain('aba=veiculos');
    expect(await screen.findByText('Fiat Argo Drive 1.0')).toBeInTheDocument();
    expect(screen.getByText('Honda CG 160 Fan')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Cliente' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('tab', { name: /Veículos/ })).toHaveTextContent('2'));

    await userEvent.click(screen.getByRole('tab', { name: /Pedidos/ }));
    const tabela = await screen.findByRole('table');
    await within(tabela).findByText('#1058');
    expect(within(tabela).getByText('#1055')).toBeInTheDocument();
    expect(within(tabela).queryByText('#1056')).not.toBeInTheDocument(); // pedido de outro cliente
  });

  it('abre direto na aba pedindo por URL', async () => {
    await entrarComo('/clientes/1?aba=pedidos');
    expect(await screen.findByRole('tab', { name: /Pedidos/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('edita os dados do cliente (PUT) e reflete na tela', async () => {
    await entrarComo('/clientes/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const nome = screen.getByLabelText('Nome');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Marcos V. Silva');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Cliente atualizado')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Marcos V. Silva' })).toBeInTheDocument();
    expect(db.clientes[0].nome).toBe('Marcos V. Silva');
    expect(db.pedidos.find((p) => p.id === 1058)!.cliente.nome).toBe('Marcos V. Silva');
  });

  it('erro de campo (`campos`) na edição aparece no campo', async () => {
    server.use(http.put('http://localhost:8080/api/clientes/:id', () => HttpResponse.json({ mensagem: 'Dados inválidos', campos: { cpfCnpj: 'CPF/CNPJ já cadastrado' } }, { status: 400 })));
    await entrarComo('/clientes/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const doc = screen.getByLabelText('CPF/CNPJ');
    await userEvent.clear(doc);
    await userEvent.type(doc, '52998224725');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('CPF/CNPJ já cadastrado')).toBeInTheDocument();
  });

  it('cadastra veículo na aba Veículos', async () => {
    await entrarComo('/clientes/3?aba=veiculos');
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo veículo' }));
    const f = screen.getByRole('form', { name: 'Novo veículo' });
    await userEvent.type(within(f).getByLabelText('Placa'), 'QWE1R23');
    await userEvent.type(within(f).getByLabelText('Marca / modelo'), 'Fiat Uno');
    await userEvent.type(within(f).getByLabelText('Ano de fabricação'), '2015');
    await userEvent.type(within(f).getByLabelText('Ano do modelo'), '2015');
    await userEvent.click(within(f).getByRole('button', { name: 'Salvar veículo' }));
    expect(await screen.findByText('Fiat Uno')).toBeInTheDocument();
    expect(db.veiculos.at(-1)).toMatchObject({ placa: 'QWE1R23', clienteId: 3 });
  });

  it('cliente inexistente mostra erro claro', async () => {
    await entrarComo('/clientes/999');
    expect(await screen.findByText('Cliente não encontrado.')).toBeInTheDocument();
  });
});

describe('Veículos', () => {
  it('lista com placa, marca/modelo, ano, cliente e "—" em última consulta', async () => {
    await entrarComo('/veiculos');
    expect(await screen.findByText('11 veículos')).toBeInTheDocument();
    const r = await linha('Fiat Argo Drive 1.0');
    expect(within(r).getByRole('img', { name: 'Placa FZR4C71' })).toBeInTheDocument();
    expect(within(r).getByText('2022/2023')).toBeInTheDocument();
    expect(within(r).getByRole('link', { name: 'Marcos Vilela' })).toHaveAttribute('href', '/clientes/1');
    expect(within(r).getAllByRole('cell').at(-1)).toHaveTextContent('—');
  });

  it('busca por placa: maiúsculas automáticas, sem hífen, na URL', async () => {
    const { router } = await entrarComo('/veiculos');
    await screen.findByText('Fiat Argo Drive 1.0');
    const campo = screen.getByLabelText('Buscar por placa');
    await userEvent.type(campo, 'dpt-7b');
    expect(campo).toHaveValue('DPT7B');
    expect(await screen.findByText('1 veículo')).toBeInTheDocument();
    expect(screen.getByText('Volkswagen T-Cross 200 TSI')).toBeInTheDocument();
    expect(screen.queryByText('Fiat Argo Drive 1.0')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?placa=DPT7B');
  });

  it('sem resultado oferece limpar a busca', async () => {
    await entrarComo('/veiculos?placa=ZZZ');
    expect(await screen.findByText('Nenhum veículo encontrado para "ZZZ".')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(await screen.findByText('Fiat Argo Drive 1.0')).toBeInTheDocument();
  });

  it('filtra por clienteId', async () => {
    await entrarComo('/veiculos?clienteId=1');
    expect(await screen.findByText('2 veículos')).toBeInTheDocument();
  });

  it('detalhe: placa grande, dados, cliente vinculado e histórico de consultas vazio', async () => {
    const { router } = await entrarComo('/veiculos');
    await userEvent.click(await screen.findByText('Fiat Argo Drive 1.0'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/veiculos/1'));
    expect(await screen.findByRole('img', { name: 'Placa FZR4C71' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Marcos Vilela' })).toHaveAttribute('href', '/clientes/1');
    expect(await screen.findByText('Nenhuma consulta realizada para este veículo.')).toBeInTheDocument();
  });

  it('"Consultar placa" no detalhe mostra o aviso do 400 esperado', async () => {
    await entrarComo('/veiculos/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Consultar placa' }));
    expect(await screen.findByText('Consulta veicular ainda não está disponível.')).toBeInTheDocument();
  });

  it('veículo inexistente mostra erro claro', async () => {
    await entrarComo('/veiculos/999');
    expect(await screen.findByText('Veículo não encontrado.')).toBeInTheDocument();
  });
});
