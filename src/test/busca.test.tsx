import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { entrarComo } from './utils';
import { server } from '@/mocks/server';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

const API = 'http://localhost:8080/api';
const campo = () => screen.findByRole('combobox', { name: 'Buscar placa, cliente ou nº do pedido' });
const lista = () => screen.findByRole('listbox', { name: 'Resultados da busca' });

describe('Busca global (combobox)', () => {
  it('placa normalizada: agrupa Pedidos e Veículos, o 1º resultado já vem ativo e Enter abre o pedido', async () => {
    const { router } = await entrarComo('/pedidos');
    const busca = await campo();
    await userEvent.type(busca, 'dpt-7b02');
    const l = await lista();
    await waitFor(() => expect(within(l).getAllByRole('option').length).toBeGreaterThanOrEqual(2));
    expect(within(l).getByRole('group', { name: 'Pedidos' })).toBeInTheDocument();
    expect(within(l).getByRole('group', { name: 'Veículos' })).toBeInTheDocument();
    const opcoes = within(l).getAllByRole('option');
    expect(opcoes[0]).toHaveAttribute('aria-selected', 'true');
    expect(opcoes[0]).toHaveAccessibleName(/Pedido 1056, DPT7B02, Renata Sampaio/);
    expect(busca).toHaveAttribute('aria-expanded', 'true');
    expect(busca).toHaveAttribute('aria-activedescendant', opcoes[0]!.id);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/1056'));
    expect(busca).toHaveValue(''); // limpa depois de abrir
  });

  it('setas navegam entre os grupos (com volta) e Enter abre o veículo', async () => {
    const { router } = await entrarComo('/pedidos');
    const busca = await campo();
    await userEvent.type(busca, 'DPT7B02');
    const l = await lista();
    await waitFor(() => expect(within(l).getAllByRole('option').length).toBe(2));
    await userEvent.keyboard('{ArrowDown}');
    expect(within(l).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}'); // volta ao primeiro
    expect(within(l).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/veiculos\/\d+$/));
  });

  it('nome de cliente: grupo Clientes; clicar abre o cliente', async () => {
    const { router } = await entrarComo('/pedidos');
    await userEvent.type(await campo(), 'Renata');
    const l = await lista();
    const cliente = await within(l).findByRole('option', { name: /Cliente Renata Sampaio/ });
    expect(within(l).getByRole('group', { name: 'Clientes' })).toContainElement(cliente);
    await userEvent.click(cliente);
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/clientes\/\d+$/));
  });

  it('número do pedido (com ou sem #)', async () => {
    const { router } = await entrarComo('/pedidos');
    await userEvent.type(await campo(), '#1058');
    const l = await lista();
    await within(l).findByRole('option', { name: /Pedido 1058, FZR4C71, Marcos Vilela/ });
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/1058'));
  });

  it('menos de 2 caracteres não consulta nem abre; sem resultado mostra a mensagem', async () => {
    const chamadas: string[] = [];
    server.events.on('request:start', ({ request }) => { const u = new URL(request.url); if (/\/(veiculos|clientes|pedidos)$/.test(u.pathname) && u.searchParams.has('busca') || u.searchParams.has('placa')) chamadas.push(u.pathname); });
    await entrarComo('/dashboard', 'gerente@sap.com');
    const busca = await campo();
    await userEvent.type(busca, 'z');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(chamadas).toHaveLength(0);
    await userEvent.type(busca, 'zzzq');
    expect(await screen.findByText(/Nenhum resultado para “zzzzq”\./)).toBeInTheDocument();
    server.events.removeAllListeners();
  });

  it('Esc limpa o campo, fecha a lista e tira o foco', async () => {
    await entrarComo('/pedidos');
    const busca = await campo();
    await userEvent.type(busca, 'Renata');
    await lista();
    await userEvent.keyboard('{Escape}');
    expect(busca).toHaveValue('');
    expect(busca).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('um tipo falhando não derruba os outros: mostra os resultados e avisa quais grupos falharam', async () => {
    server.use(http.get(`${API}/clientes`, () => HttpResponse.json({ mensagem: 'erro' }, { status: 500 })));
    await entrarComo('/pedidos');
    await userEvent.type(await campo(), 'DPT7B02');
    const l = await lista();
    await within(l).findByRole('option', { name: /Veículo DPT7B02/ });
    expect(await within(l).findByRole('alert')).toHaveTextContent('Não foi possível buscar em: Clientes.');
  });

  it('anuncia a quantidade de resultados (região aria-live)', async () => {
    await entrarComo('/pedidos');
    await userEvent.type(await campo(), 'DPT7B02');
    expect(await screen.findByText(/^\d+ resultados?$/)).toHaveAttribute('aria-live', 'polite');
  });
});

describe('Atalhos globais', () => {
  it('"/" foca a busca; dentro de um campo, não', async () => {
    await entrarComo('/pedidos');
    const busca = await campo();
    expect(busca).not.toHaveFocus();
    await userEvent.keyboard('/');
    expect(busca).toHaveFocus();
    expect(busca).toHaveValue(''); // o "/" não é digitado no campo
    await userEvent.keyboard('/');
    expect(busca).toHaveValue('/'); // já estava num input: vira texto
  });

  it('"N" abre Novo pedido; "G" depois "P"/"C" navega; fora de inputs apenas', async () => {
    const { router } = await entrarComo('/dashboard', 'gerente@sap.com');
    await campo();
    await userEvent.keyboard('gc');
    await waitFor(() => expect(router.state.location.pathname).toBe('/clientes'));
    await userEvent.keyboard('gp');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos'));
    await userEvent.keyboard('n');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/novo'));
    // digitando na busca, "n" e "g" são texto
    await userEvent.click(await campo());
    await userEvent.keyboard('ng');
    expect(router.state.location.pathname).toBe('/pedidos/novo');
    expect(await campo()).toHaveValue('ng');
  });

  it('G sozinho expira e não navega; teclas com Ctrl/Meta são ignoradas', async () => {
    const { router } = await entrarComo('/dashboard', 'gerente@sap.com');
    await campo();
    await userEvent.keyboard('g');
    await userEvent.keyboard('{Control>}p{/Control}');
    expect(router.state.location.pathname).toBe('/dashboard');
  });
});

describe('Acessibilidade — foco', () => {
  it('fechar um modal devolve o foco a quem o abriu (não deixa cair no <body>)', async () => {
    await entrarComo('/servicos', 'gerente@sap.com');
    const gatilho = await screen.findByRole('button', { name: '+ Novo serviço' });
    gatilho.focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: 'Novo serviço' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(gatilho).toHaveFocus());
  });
});
