import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ApiError, NovoServicoRequest, Servico } from '@/api/types';
import { useToast } from '@/components/Toast';

/** `GET /servicos` lista só os ativos; com `incluirInativos` (tela de Serviços) vêm todos, para poder reativar após recarregar. */
export const useServicos = (opts: { incluirInativos?: boolean } = {}) => {
  const incluirInativos = opts.incluirInativos ?? false;
  return useQuery({
    queryKey: [...qk.servicos, { incluirInativos }],
    queryFn: async () => (await api.get<Servico[]>('/servicos', { params: incluirInativos ? { incluirInativos: true } : {} })).data,
  });
};

export const CATEGORIAS = ['EMPLACAMENTO', 'SEGUNDA VIA', 'DOCUMENTAÇÃO', 'SERVIÇOS'] as const;

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

/** Ativar/desativar (`PATCH /servicos/{id}/status`) — otimista (spec §7.7), com conferência da resposta. */
export function useAlternarServico() {
  const qc = useQueryClient();
  const toast = useToast();
  type Ctx = { anteriores: [readonly unknown[], Servico[] | undefined][] };
  return useMutation<Servico, ApiError, { servico: Servico; ativo: boolean }, Ctx>({
    mutationFn: async ({ servico, ativo }) => (await api.patch<Servico>(`/servicos/${servico.id}/status`, { ativo })).data,
    onMutate: async ({ servico, ativo }) => {
      await qc.cancelQueries({ queryKey: qk.servicos });
      const anteriores = qc.getQueriesData<Servico[]>({ queryKey: qk.servicos });
      qc.setQueriesData<Servico[]>({ queryKey: qk.servicos }, (l) => l?.map((s) => (s.id === servico.id ? { ...s, ativo } : s)));
      return { anteriores };
    },
    onError: (e, { servico }, ctx) => {
      ctx?.anteriores.forEach(([k, d]) => qc.setQueryData(k, d));
      toast(`Não foi possível alterar "${servico.nome}": ${e.mensagem}`, 'erro');
    },
    onSuccess: (salvo, { servico, ativo }, ctx) => {
      // Confere a resposta: se o servidor não aplicou o status pedido, desfaz a mudança otimista.
      if (salvo.ativo !== ativo) {
        ctx?.anteriores.forEach(([k, d]) => qc.setQueryData(k, d));
        toast(`O servidor não aplicou a mudança de status de "${servico.nome}".`, 'erro');
        return;
      }
      toast(`${servico.nome} ${ativo ? 'ativado' : 'desativado'}`);
      for (const k of [qk.servicos, ['pedidos'], ['pedido']]) void qc.invalidateQueries({ queryKey: k });
    },
  });
}
