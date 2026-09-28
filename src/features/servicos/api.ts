import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { Servico } from '@/api/types';

/** `GET /servicos` devolve só os ativos (limitação aceita, ver PENDENCIAS.md). */
export const useServicos = () =>
  useQuery({ queryKey: qk.servicos, queryFn: async () => (await api.get<Servico[]>('/servicos')).data });
