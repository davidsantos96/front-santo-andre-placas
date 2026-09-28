import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ApiError, Cliente, NovoClienteRequest } from '@/api/types';

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
