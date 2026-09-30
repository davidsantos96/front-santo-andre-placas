import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ApiError, Cliente, NovoClienteRequest } from '@/api/types';
import { usePedidos } from '@/features/pedidos/api';

/** Assume `GET /clientes?busca=` → `Cliente[]` (o backend não especifica paginação para clientes). */
export const useClientes = (busca?: string, enabled = true) =>
  useQuery({
    queryKey: qk.clientes(busca),
    enabled,
    queryFn: async () => (await api.get<Cliente[]>('/clientes', { params: busca ? { busca } : {} })).data,
  });

export const useCriarCliente = () => {
  const qc = useQueryClient();
  return useMutation<Cliente, ApiError, NovoClienteRequest>({
    mutationFn: async (dados) => (await api.post<Cliente>('/clientes', dados)).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['clientes'] }); },
  });
};

/** Assume `GET /clientes/{id}` (não listado no §14 da spec — ver PENDENCIAS.md). */
export const useCliente = (id: number) =>
  useQuery({ queryKey: qk.cliente(id), queryFn: async () => (await api.get<Cliente>(`/clientes/${id}`)).data });

/** PUT /clientes/{id}. O pedido embute o cliente, então `pedidos` e `veiculos` (clienteNome) também são invalidados. */
export const useAtualizarCliente = (id: number) => {
  const qc = useQueryClient();
  return useMutation<Cliente, ApiError, NovoClienteRequest>({
    mutationFn: async (dados) => (await api.put<Cliente>(`/clientes/${id}`, dados)).data,
    onSuccess: () => {
      for (const k of [['clientes'], qk.cliente(id), ['pedidos'], ['pedido'], ['veiculos']]) void qc.invalidateQueries({ queryKey: k });
    },
  });
};

/** Total de pedidos do cliente via `GET /pedidos?clienteId=&size=1` (uma chamada por cliente — ver PENDENCIAS.md). */
export const useTotalPedidosDoCliente = (clienteId: number) => {
  const q = usePedidos({ clienteId, size: 1 });
  return { total: q.data?.page.totalElements, carregando: q.isPending };
};
