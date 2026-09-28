import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ItemEstoque } from '@/api/types';

export const useEstoque = () =>
  useQuery({ queryKey: qk.estoque, queryFn: async () => (await api.get<ItemEstoque[]>('/estoque/itens')).data });

export const useEstoqueBaixo = (enabled = true) =>
  useQuery({
    queryKey: qk.estoqueBaixo,
    enabled,
    queryFn: async () => (await api.get<ItemEstoque[]>('/estoque/itens/baixo-estoque')).data,
  });
