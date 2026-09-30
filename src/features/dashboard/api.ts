import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { FaturamentoResponse, ResumoDashboard, ServicoMaisVendido, TempoMedioProducao } from '@/api/types';
import { intervaloUltimosDias } from '@/lib/datas';
import { usePedidos } from '@/features/pedidos/api';

export const useResumo = () =>
  useQuery({ queryKey: qk.dashboard.resumo, queryFn: async () => (await api.get<ResumoDashboard>('/dashboard/resumo')).data });

export type IntervaloDatas = { de: string; ate: string };

/** `GET /dashboard/faturamento?de=&ate=` (datas `yyyy-MM-dd`, inclusivas). `null` = intervalo inválido (não consulta). */
export function useFaturamento(intervalo: IntervaloDatas | null) {
  return useQuery({
    queryKey: qk.dashboard.faturamento(intervalo ? `${intervalo.de}_${intervalo.ate}` : 'invalido'),
    enabled: intervalo !== null,
    placeholderData: keepPreviousData, // troca de período mantém o gráfico anterior (esmaecido) em vez de piscar
    queryFn: async () => {
      const { de, ate } = intervalo!;
      const { data } = await api.get<FaturamentoResponse>('/dashboard/faturamento', { params: { de, ate } });
      return { de, ate, dias: data.porDia }; // só dias com pagamento; o cartão completa o intervalo com zeros
    },
  });
}

export const useServicosMaisVendidos = () =>
  useQuery({
    queryKey: qk.dashboard.servicos,
    queryFn: async () => (await api.get<ServicoMaisVendido[]>('/dashboard/servicos-mais-vendidos')).data,
  });

/** Em **horas** (não minutos), sem comparação com o período anterior. */
export const useTempoMedio = () =>
  useQuery({
    queryKey: qk.dashboard.tempoMedio,
    queryFn: async () => (await api.get<TempoMedioProducao>('/dashboard/tempo-medio-producao')).data,
  });

/** Origem dos pedidos: sem endpoint de dashboard, agrega no front os pedidos dos últimos 7 dias. */
export function useOrigemDosPedidos() {
  const { de } = intervaloUltimosDias(7);
  return usePedidos({ de, size: 500 });
}

/**
 * Fila de produção: RECEBIDO + EM_PROCESSAMENTO + PLACA_PRONTA (o que falta produzir e o que aguarda retirada).
 * O filtro `status` só aceita um valor → uma chamada por status; mais antigos primeiro.
 */
export function useFilaDeProducao() {
  const recebidos = usePedidos({ status: 'RECEBIDO', size: 50 });
  const emProcessamento = usePedidos({ status: 'EM_PROCESSAMENTO', size: 50 });
  const prontos = usePedidos({ status: 'PLACA_PRONTA', size: 50 });
  const consultas = [recebidos, emProcessamento, prontos];
  return {
    isPending: consultas.some((c) => c.isPending),
    isError: consultas.some((c) => c.isError),
    refetch: () => consultas.forEach((c) => void c.refetch()),
    pedidos: consultas.flatMap((c) => c.data?.content ?? []).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
  };
}
