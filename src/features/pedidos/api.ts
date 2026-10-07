import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ApiError, FiltroPedidos, HistoricoStatus, NovoPedidoRequest, Pagamento, PagamentoRequest, Paginado, Pedido } from '@/api/types';
import { fmt } from '@/lib/money';
import { FORMA_PAGAMENTO, STATUS, type StatusPedido } from '@/components/status';
import { useToast } from '@/components/Toast';

export const usePedidos = (filtro?: FiltroPedidos) =>
  useQuery({
    queryKey: qk.pedidos(filtro),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filtro ?? {}).filter(([, v]) => v !== undefined && v !== ''));
      return (await api.get<Paginado<Pedido>>('/pedidos', { params })).data;
    },
  });

type Vars = { id: number; novoStatus: StatusPedido };
type Ctx = { anteriores: [readonly unknown[], Paginado<Pedido> | undefined][] };

/** PATCH /pedidos/{id}/status — otimista no cache `pedidos`, com rollback no erro (spec §7.2, §4.2). */
export function useMudarStatus() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<Pedido, ApiError, Vars, Ctx>({
    mutationFn: async ({ id, novoStatus }) =>
      (await api.patch<Pedido>(`/pedidos/${id}/status`, { novoStatus })).data,

    onMutate: async ({ id, novoStatus }) => {
      await qc.cancelQueries({ queryKey: ['pedidos'] });
      const anteriores = qc.getQueriesData<Paginado<Pedido>>({ queryKey: ['pedidos'] });
      qc.setQueriesData<Paginado<Pedido>>({ queryKey: ['pedidos'] }, (old) =>
        old && { ...old, content: old.content.map((p) => (p.id === id ? { ...p, status: novoStatus } : p)) },
      );
      return { anteriores };
    },

    onError: (e, { id }, ctx) => {
      ctx?.anteriores.forEach(([key, data]) => qc.setQueryData(key, data));
      toast(`Não foi possível atualizar o pedido #${id}: ${e.mensagem}`, 'erro');
    },

    onSuccess: (_d, { id, novoStatus }) => {
      toast(`Pedido #${id} → ${STATUS[novoStatus].label}`);
    },

    onSettled: (_d, _e, { id }) => {
      // §4.2: pedidos, pedido(id), historico(id), estoque (baixa automática), dash
      void qc.invalidateQueries({ queryKey: ['pedidos'] });
      void qc.invalidateQueries({ queryKey: qk.pedido(id) });
      void qc.invalidateQueries({ queryKey: qk.historico(id) });
      void qc.invalidateQueries({ queryKey: qk.estoque });
      void qc.invalidateQueries({ queryKey: ['dash'] });
    },
  });
}

export const usePedido = (id: number) =>
  useQuery({ queryKey: qk.pedido(id), queryFn: async () => (await api.get<Pedido>(`/pedidos/${id}`)).data });

export const useHistorico = (id: number) =>
  useQuery({ queryKey: qk.historico(id), queryFn: async () => (await api.get<HistoricoStatus[]>(`/pedidos/${id}/historico`)).data });

/** Sem `pagamento` embutido no pedido (spec §11): busca em `GET /pedidos/{id}/pagamentos`. */
export const usePagamentosDoPedido = (id: number) =>
  useQuery({ queryKey: qk.pagamentosDoPedido(id), queryFn: async () => (await api.get<Pagamento[]>(`/pedidos/${id}/pagamentos`)).data });

/** POST /pedidos/{id}/pagamento. Invalida (§4.2): pedido(id), pedidos, pagamentos, caixa, dash. */
export function useRegistrarPagamento(id: number) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<Pagamento, ApiError, PagamentoRequest>({
    mutationFn: async (dados) => (await api.post<Pagamento>(`/pedidos/${id}/pagamento`, dados)).data,
    onSuccess: (p) => {
      toast(`Pagamento registrado — ${fmt(p.valorCentavos)} via ${FORMA_PAGAMENTO[p.formaPagamento].label}`);
      void qc.invalidateQueries({ queryKey: qk.pedido(id) });
      void qc.invalidateQueries({ queryKey: qk.pagamentosDoPedido(id) });
      void qc.invalidateQueries({ queryKey: ['pedidos'] });
      void qc.invalidateQueries({ queryKey: ['pagamentos'] });
      void qc.invalidateQueries({ queryKey: ['caixa'] });
      void qc.invalidateQueries({ queryKey: ['dash'] });
    },
    onError: (e) => toast(`Não foi possível registrar o pagamento: ${e.mensagem}`, 'erro'),
  });
}

/** POST /pedidos. Invalida `pedidos` (e `pagamentos`/`caixa` quando já nasce pago — feito por quem paga). */
export function useCriarPedido() {
  const qc = useQueryClient();
  return useMutation<Pedido, ApiError, NovoPedidoRequest>({
    mutationFn: async (dados) => (await api.post<Pedido>('/pedidos', dados)).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['pedidos'] }); },
  });
}
