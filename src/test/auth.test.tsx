import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils';
import { api } from '@/api/client';
import { expirarSessoes } from '@/mocks/handlers';
import { reloginCancelado } from '@/api/sessaoEventos';

async function entrar(email: string, senha = '123456') {
  await userEvent.type(await screen.findByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), senha);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

afterEach(() => reloginCancelado());

describe('login', () => {
  it('sem sessão, redireciona para /login guardando o destino', async () => {
    const { router } = renderApp('/clientes');
    await screen.findByRole('heading', { name: 'Entrar' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Fclientes');
  });

  it('401 vira erro inline, não toast', async () => {
    renderApp('/login');
    await entrar('atendente@sap.com', 'errada');
    expect(await screen.findByText('E-mail ou senha incorretos')).toBeInTheDocument();
  });

  it('valida campos com Zod', async () => {
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Informe o e-mail')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha')).toBeInTheDocument();
  });

  it('atendente entra em /pedidos; gerente em /dashboard', async () => {
    const a = renderApp('/login');
    await entrar('atendente@sap.com');
    await waitFor(() => expect(a.router.state.location.pathname).toBe('/pedidos'));
    a.unmount();

    const g = renderApp('/login');
    await entrar('gerente@sap.com');
    await waitFor(() => expect(g.router.state.location.pathname).toBe('/dashboard'));
  });

  it('respeita ?next= interno e ignora externo', async () => {
    const { router } = renderApp('/login?next=%2Fclientes');
    await entrar('atendente@sap.com');
    await waitFor(() => expect(router.state.location.pathname).toBe('/clientes'));
  });
});

describe('papéis (fluxo 5)', () => {
  it('ATENDENTE não vê Dashboard/Financeiro/Serviços e a URL direta redireciona', async () => {
    const { router } = renderApp('/login');
    await entrar('atendente@sap.com');
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: /Pedidos/ })).toBeInTheDocument();
    for (const n of ['Dashboard', 'Financeiro', 'Serviços', 'Usuários']) {
      expect(within(nav).queryByRole('link', { name: new RegExp(n) })).not.toBeInTheDocument();
    }
    await router.navigate('/financeiro');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos'));
  });

  it('GERENTE vê Financeiro mas não Usuários; ADMIN vê tudo', async () => {
    const g = renderApp('/login');
    await entrar('gerente@sap.com');
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: /Financeiro/ })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Usuários/ })).not.toBeInTheDocument();
    await g.router.navigate('/usuarios');
    await waitFor(() => expect(g.router.state.location.pathname).toBe('/dashboard'));
    g.unmount();

    renderApp('/login');
    await entrar('admin@sap.com');
    const nav2 = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav2).getByRole('link', { name: /Usuários/ })).toBeInTheDocument();
  });

  it('sidebar mostra o badge de estoque abaixo do mínimo', async () => {
    renderApp('/login');
    await entrar('atendente@sap.com');
    expect(await screen.findByLabelText('3 itens abaixo do mínimo')).toBeInTheDocument();
  });
});

describe('sessão expirada', () => {
  it('401 abre o modal de re-login e a requisição é refeita ao entrar', async () => {
    renderApp('/login');
    await entrar('atendente@sap.com');
    await screen.findByRole('navigation', { name: 'Navegação principal' });

    expirarSessoes();
    const pendente = api.get('/estoque/itens');

    const modal = await screen.findByRole('dialog', { name: 'Sessão expirada' });
    // a tela atual continua montada por baixo (o Radix a marca aria-hidden enquanto o modal está aberto)
    expect(screen.getByRole('navigation', { name: 'Navegação principal', hidden: true })).toBeInTheDocument();

    await userEvent.type(within(modal).getByLabelText('Senha'), '123456');
    await userEvent.click(within(modal).getByRole('button', { name: 'Entrar' }));

    const r = await pendente;
    expect(r.status).toBe(200);
    expect(r.data).toHaveLength(6);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sessão expirada' })).not.toBeInTheDocument());
  });

  it('"Sair" no modal rejeita a requisição pendente e volta ao login', async () => {
    const { router } = renderApp('/login');
    await entrar('atendente@sap.com');
    await screen.findByRole('navigation', { name: 'Navegação principal' });

    expirarSessoes();
    const pendente = api.get('/estoque/itens');
    pendente.catch(() => {});
    const modal = await screen.findByRole('dialog', { name: 'Sessão expirada' });
    await userEvent.click(within(modal).getByRole('button', { name: 'Sair' }));

    await expect(pendente).rejects.toMatchObject({ status: 401 });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
