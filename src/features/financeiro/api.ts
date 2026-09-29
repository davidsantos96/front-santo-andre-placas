import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { FechamentoCaixa, FiltroPagamentos, PagamentoListagem } from '@/api/types';

/** `GET /pagamentos?de=&ate=&forma=` (GERENTE+). */
export const usePagamentos = (f: FiltroPagamentos) =>
  useQuery({
    queryKey: qk.pagamentos(f),
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<PagamentoListagem[]>('/pagamentos', { params: { de: f.de, ate: f.ate, ...(f.forma ? { forma: f.forma } : {}) } })).data,
  });

/** `GET /financeiro/fechamento-caixa?de=&ate=` — relatório sem estado (sem abrir/fechar caixa). */
export const useFechamentoCaixa = (de: string, ate: string) =>
  useQuery({
    queryKey: qk.caixa(de, ate),
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<FechamentoCaixa>('/financeiro/fechamento-caixa', { params: { de, ate } })).data,
  });
