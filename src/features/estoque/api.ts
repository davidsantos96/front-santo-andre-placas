import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ApiError, ItemEstoque, MovimentacaoRequest, VinculoServicoItem } from '@/api/types';

export const useEstoque = () =>
  useQuery({ queryKey: qk.estoque, queryFn: async () => (await api.get<ItemEstoque[]>('/estoque/itens')).data });

export const useEstoqueBaixo = (enabled = true) =>
  useQuery({
    queryKey: qk.estoqueBaixo,
    enabled,
    queryFn: async () => (await api.get<ItemEstoque[]>('/estoque/itens/baixo-estoque')).data,
  });

/** POST /estoque/movimentacoes (ATENDENTE liberado). Invalida `estoque` e `estoqueBaixo` (§4.2) e o dashboard. */
export function useMovimentar() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, MovimentacaoRequest>({
    mutationFn: async (d) => (await api.post('/estoque/movimentacoes', d)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.estoque });
      void qc.invalidateQueries({ queryKey: qk.estoqueBaixo });
      void qc.invalidateQueries({ queryKey: ['dash'] });
    },
  });
}

export const abaixoDoMinimo = (i: ItemEstoque): boolean => i.quantidade <= i.quantidadeMinima;

/** `GET /estoque/vinculos?servicoId=` — itens baixados automaticamente ao iniciar o processamento do serviço. */
export const useVinculosDoServico = (servicoId: number) =>
  useQuery({
    queryKey: ['estoque', 'vinculos', servicoId],
    queryFn: async () => (await api.get<VinculoServicoItem[]>('/estoque/vinculos', { params: { servicoId } })).data,
  });
