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

/** Janela dos cartões "Serviços mais vendidos" (dias, ignora cancelados) e "Tempo médio" (dias, com comparação). */
export const DIAS_MAIS_VENDIDOS = 30;
export const DIAS_TEMPO_MEDIO = 7;

export function useServicosMaisVendidos() {
  const { de, ate } = intervaloUltimosDias(DIAS_MAIS_VENDIDOS);
  return useQuery({
    queryKey: qk.dashboard.servicos(`${de}_${ate}`),
    queryFn: async () => (await api.get<ServicoMaisVendido[]>('/dashboard/servicos-mais-vendidos', { params: { de, ate } })).data,
  });
}

/**
 * Em **horas** (Em produção → placa pronta) dos pedidos que ficaram prontos nos últimos 7 dias;
 * `horasMediaPeriodoAnterior` é a média dos 7 dias imediatamente anteriores (base da tendência).
 */
export function useTempoMedio() {
  const { de, ate } = intervaloUltimosDias(DIAS_TEMPO_MEDIO);
  return useQuery({
    queryKey: qk.dashboard.tempoMedio(`${de}_${ate}`),
    queryFn: async () => (await api.get<TempoMedioProducao>('/dashboard/tempo-medio-producao', { params: { de, ate } })).data,
  });
}

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
