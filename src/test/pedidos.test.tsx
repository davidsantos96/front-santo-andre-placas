import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderApp } from './utils';
import { useTrocaStatus } from '@/features/pedidos/useTrocaStatus';
import { ToastProvider } from '@/components/Toast';
import { api, setAccessToken } from '@/api/client';
import type { StatusPedido } from '@/components/status';
import { server } from '@/mocks/server';
import { db } from '@/mocks/db';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

async function entrar(inicial: string) {
  const app = renderApp(`/login?next=${encodeURIComponent(inicial)}`);
  await userEvent.type(await screen.findByLabelText('E-mail'), 'atendente@sap.com');
  await userEvent.type(screen.getByLabelText('Senha'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  return app;
}

describe('Pedidos — quadro', () => {
  it('agrupa por status, mostra "$ pendente" e mantém CANCELADO fora', async () => {
    db.pedidos.find((p) => p.id === 1048)!.status = 'CANCELADO';
    await entrar('/pedidos');
    const recebido = await screen.findByRole('region', { name: 'Recebido' });
    expect(within(recebido).getAllByRole('button')).toHaveLength(3);
    expect(within(recebido).getByRole('button', { name: /Pedido 1058/ })).toHaveTextContent('$ pendente');
    expect(within(recebido).getByRole('button', { name: /Pedido 1056/ })).not.toHaveTextContent('$ pendente');
    expect(screen.queryByRole('button', { name: /Pedido 1048/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cancelado' })).not.toBeInTheDocument();
  });

  it('pedido com pagamento parcial segue com "$ pendente" (pago = soma ≥ preço)', async () => {
    db.pagamentos.push({ id: 99, pedidoId: 1058, valorCentavos: 10000, formaPagamento: 'PIX', status: 'PAGO', pagoEm: new Date().toISOString(), registradoPor: 'Bruna Costa' });
    await entrar('/pedidos');
    expect(await screen.findByRole('button', { name: /Pedido 1058/ })).toHaveTextContent('$ pendente');
    expect(screen.getByRole('button', { name: /Pedido 1056/ })).not.toHaveTextContent('$ pendente'); // quitado
  });

  it('cards de pedido em status final (Entregue) não são arrastáveis; os demais são', async () => {
    await entrar('/pedidos');
    expect(await screen.findByRole('button', { name: /Pedido 1050/ })).toHaveAttribute('aria-disabled', 'true'); // ENTREGUE
    expect(screen.getByRole('button', { name: /Pedido 1058/ })).toHaveAttribute('aria-disabled', 'false'); // RECEBIDO
  });

  it('status final no backend: tentar mudar devolve 400 com a mensagem e o card volta', async () => {
    await renderHarness({ id: 1050, de: 'PLACA_PRONTA', para: 'EM_PROCESSAMENTO' }); // 1050 já é ENTREGUE no servidor
    await userEvent.click(screen.getByText('soltar'));
    expect(await screen.findByText(/Pedido em status final \(ENTREGUE\) não pode mudar de status\./)).toBeInTheDocument();
  });

  it('clique e Enter no card abrem o detalhe', async () => {
    const { router } = await entrar('/pedidos');
    await userEvent.click(await screen.findByRole('button', { name: /Pedido 1058/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/1058'));

    await router.navigate('/pedidos');
    const card = await screen.findByRole('button', { name: /Pedido 1057/ });
    card.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/1057'));
  });

});

describe('Pedidos — tabela', () => {
  it('lista com colunas e abre o detalhe pela linha', async () => {
    const { router } = await entrar('/pedidos?visao=tabela');
    expect(await screen.findByText('11 pedidos')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Origem' })).toHaveAttribute('scope', 'col');
    await userEvent.click(await screen.findByText('Renata Sampaio'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/1056'));
  });

  it('filtros ficam na URL e vão para a API', async () => {
    const { router } = await entrar('/pedidos?visao=tabela');
    await screen.findByText('Renata Sampaio');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ENTREGUE');
    await waitFor(() => expect(screen.queryByText('Renata Sampaio')).not.toBeInTheDocument());
    expect(router.state.location.search).toContain('status=ENTREGUE');
    expect(screen.getByText('Vanessa Okamoto')).toBeInTheDocument();
    expect(await screen.findByText('3 pedidos')).toBeInTheDocument();
  });

  it('vazio com filtro oferece "Limpar filtros"', async () => {
    const { router } = await entrar('/pedidos?visao=tabela');
    await screen.findByText('Renata Sampaio');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'CANCELADO');
    await userEvent.click(await screen.findByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('Renata Sampaio')).toBeInTheDocument();
  });

  it('busca filtra por placa (normalizada) na página carregada', async () => {
    await entrar('/pedidos?visao=tabela');
    await screen.findByText('Renata Sampaio');
    await userEvent.type(screen.getByLabelText('Filtrar nesta página'), 'dpt-7b02');
    await waitFor(() => expect(screen.queryByText('Marcos Vilela')).not.toBeInTheDocument());
    expect(screen.getByText('Renata Sampaio')).toBeInTheDocument();
  });

  it('paginação do servidor (size=50, páginas)', async () => {
    server.use(http.get('http://localhost:8080/api/pedidos', ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
      return HttpResponse.json({ content: page === 0 ? db.pedidos.slice(0, 2) : db.pedidos.slice(2, 3), page: { size: 50, number: page, totalElements: 3, totalPages: 2 } });
    }));
    const { router } = await entrar('/pedidos?visao=tabela');
    await screen.findByText('Página 1 de 2');
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 2');
    expect(router.state.location.search).toContain('page=2');
    await act(async () => {});
  });
});

/**
 * O Kanban chama `solicitar(pedido, colunaDestino)` no onDragEnd. O arrastar em si não é
 * testável no jsdom (sem layout, o dnd-kit não resolve colisões), então as regras de negócio
 * do soltar — confirmação, mutação otimista e rollback — são testadas no hook que ele usa.
 */
function Harness({ id, de, para }: { id: number; de: StatusPedido; para: StatusPedido }) {
  const { solicitar, dialogo } = useTrocaStatus();
  const pedido = db.pedidos.find((p) => p.id === id)!;
  return (
    <>
      <button onClick={() => solicitar({ id, status: de, pago: pedido.pago }, para)}>soltar</button>
      {dialogo}
    </>
  );
}

async function renderHarness(props: { id: number; de: StatusPedido; para: StatusPedido }) {
  const { data } = await api.post('/auth/login', { email: 'atendente@sap.com', senha: '123456' });
  setAccessToken(data.token);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><ToastProvider><Harness {...props} /></ToastProvider></QueryClientProvider>);
  return qc;
}

describe('Pedidos — soltar card em outra coluna', () => {
  it('→ ENTREGUE sem pagamento pede confirmação; "Voltar" não altera nada', async () => {
    await renderHarness({ id: 1055, de: 'EM_PROCESSAMENTO', para: 'ENTREGUE' });
    await userEvent.click(screen.getByText('soltar'));
    const d = await screen.findByRole('dialog', { name: 'Entregar sem pagamento?' });
    expect(d).toHaveTextContent('Pedido sem pagamento registrado. Entregar mesmo assim?');
    await userEvent.click(within(d).getByRole('button', { name: 'Voltar' }));
    expect(db.pedidos.find((p) => p.id === 1055)!.status).toBe('EM_PROCESSAMENTO');
  });

  it('→ ENTREGUE sem pagamento: confirmar efetiva a mudança', async () => {
    await renderHarness({ id: 1055, de: 'EM_PROCESSAMENTO', para: 'ENTREGUE' });
    await userEvent.click(screen.getByText('soltar'));
    await userEvent.click(await screen.findByRole('button', { name: 'Entregar mesmo assim' }));
    await waitFor(() => expect(db.pedidos.find((p) => p.id === 1055)!.status).toBe('ENTREGUE'));
    await screen.findByText('Pedido #1055 → Entregue');
  });

  it('→ ENTREGUE com pagamento não pede confirmação', async () => {
    await renderHarness({ id: 1052, de: 'PLACA_PRONTA', para: 'ENTREGUE' });
    await userEvent.click(screen.getByText('soltar'));
    await waitFor(() => expect(db.pedidos.find((p) => p.id === 1052)!.status).toBe('ENTREGUE'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('→ CANCELADO sempre pede confirmação (ação perigosa, foco em "Voltar")', async () => {
    await renderHarness({ id: 1056, de: 'RECEBIDO', para: 'CANCELADO' });
    await userEvent.click(screen.getByText('soltar'));
    const d = await screen.findByRole('dialog', { name: 'Cancelar pedido #1056?' });
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Voltar' })).toHaveFocus());
  });

  it('erro 500: rollback do cache otimista e toast de erro', async () => {
    server.use(http.patch('http://localhost:8080/api/pedidos/:id/status', async () => { await delay(400); return HttpResponse.json({ mensagem: 'Falha' }, { status: 500 }); }));
    const qc = await renderHarness({ id: 1058, de: 'RECEBIDO', para: 'EM_PROCESSAMENTO' });
    const chave = ['pedidos', { de: 'x' }];
    qc.setQueryData(chave, { content: [db.pedidos.find((p) => p.id === 1058)!], page: { size: 1, number: 0, totalElements: 1, totalPages: 1 } });

    await userEvent.click(screen.getByText('soltar'));
    // otimista: o cache muda antes da resposta
    await waitFor(() => expect((qc.getQueryData(chave) as any).content[0].status).toBe('EM_PROCESSAMENTO'));
    // erro: volta ao status original
    await screen.findByText(/Não foi possível atualizar o pedido #1058: Falha/);
    await waitFor(() => expect((qc.getQueryData(chave) as any).content[0].status).toBe('RECEBIDO'));
  });
});
