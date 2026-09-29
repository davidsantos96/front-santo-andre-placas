import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ApiError, NovoServicoRequest, Paginado, Pedido, Servico } from '@/api/types';
import { useToast } from '@/components/Toast';
import { paraISOData } from '@/lib/datas';

/** `GET /servicos` devolve só os ativos (limitação aceita, ver PENDENCIAS.md). */
export const useServicos = () =>
  useQuery({ queryKey: qk.servicos, queryFn: async () => (await api.get<Servico[]>('/servicos')).data });

export const CATEGORIAS = ['EMPLACAMENTO', 'SEGUNDA VIA', 'DOCUMENTAÇÃO', 'SERVIÇOS'] as const;

const corpo = (s: Servico, sobre: Partial<NovoServicoRequest> = {}): NovoServicoRequest => ({
  nome: s.nome, descricao: s.descricao ?? '', categoria: s.categoria, precoCentavos: s.precoCentavos, ativo: s.ativo, ...sobre,
});

function invalidarServico(qc: ReturnType<typeof useQueryClient>) {
  // o pedido embute o serviço (nome/preço), então as telas de pedido também recarregam
  for (const k of [['servicos'], ['pedidos'], ['pedido']]) void qc.invalidateQueries({ queryKey: k });
}

export function useCriarServico() {
  const qc = useQueryClient();
  return useMutation<Servico, ApiError, NovoServicoRequest>({
    mutationFn: async (d) => (await api.post<Servico>('/servicos', d)).data,
    onSuccess: () => invalidarServico(qc),
  });
}

export function useAtualizarServico(id: number) {
  const qc = useQueryClient();
  return useMutation<Servico, ApiError, NovoServicoRequest>({
    mutationFn: async (d) => (await api.put<Servico>(`/servicos/${id}`, d)).data,
    onSuccess: () => invalidarServico(qc),
  });
}

/**
 * Ativar/desativar — otimista (spec §7.7). Não refaz o GET ao final: como `GET /servicos` só devolve
 * ativos (limitação aceita), um refetch faria a linha desativada sumir e impediria reativá-la na sessão.
 */
export function useAlternarServico() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<Servico, ApiError, { servico: Servico; ativo: boolean }, { anterior?: Servico[] }>({
    mutationFn: async ({ servico, ativo }) => (await api.put<Servico>(`/servicos/${servico.id}`, corpo(servico, { ativo }))).data,
    onMutate: async ({ servico, ativo }) => {
      await qc.cancelQueries({ queryKey: qk.servicos });
      const anterior = qc.getQueryData<Servico[]>(qk.servicos);
      qc.setQueryData<Servico[]>(qk.servicos, (l) => l?.map((s) => (s.id === servico.id ? { ...s, ativo } : s)));
      return { anterior };
    },
    onError: (e, { servico }, ctx) => {
      if (ctx?.anterior) qc.setQueryData(qk.servicos, ctx.anterior);
      toast(`Não foi possível alterar "${servico.nome}": ${e.mensagem}`, 'erro');
    },
    onSuccess: (_d, { servico, ativo }) => {
      toast(`${servico.nome} ${ativo ? 'ativado' : 'desativado'}`);
      for (const k of [['pedidos'], ['pedido']]) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

/** Pedidos do mês por serviço (não cancelados), contados no front a partir de `GET /pedidos?de=` — ver PENDENCIAS.md. */
export function usePedidosNoMes() {
  const inicio = new Date();
  inicio.setDate(1);
  const de = paraISOData(inicio);
  return useQuery({
    queryKey: ['pedidos', 'no-mes', de],
    queryFn: async () => {
      const { data } = await api.get<Paginado<Pedido>>('/pedidos', { params: { de, size: 500 } });
      const porServico = new Map<number, number>();
      data.content.filter((p) => p.status !== 'CANCELADO').forEach((p) => porServico.set(p.servico.id, (porServico.get(p.servico.id) ?? 0) + 1));
      return { porServico, truncado: data.page.totalElements > data.content.length };
    },
  });
}
