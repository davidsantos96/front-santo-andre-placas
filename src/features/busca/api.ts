import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Cliente, Paginado, Pedido, Veiculo } from '@/api/types';
import { normalizarPlaca, placaValida } from '@/lib/placa';

export const MIN_CARACTERES = 2;
export const LIMITE_POR_GRUPO = 5;

/**
 * Uma consulta por tipo, em paralelo (spec §5.13):
 * - veículos: `GET /veiculos?placa=` (placa normalizada: sem hífen/espaço, maiúscula);
 * - clientes: `GET /clientes?busca=`;
 * - pedidos: `GET /pedidos?busca=` — o backend casa placa, nome do cliente e nº do pedido (no lugar de `/pedidos/{n}`).
 */
export function useBuscaGlobal(termo: string) {
  const t = termo.trim().replace(/^#/, '');
  const placa = normalizarPlaca(t);
  // "dpt-7b02" é uma placa: o pedido é buscado por "DPT7B02" (o backend compara o texto como está gravado)
  const termoPedido = placaValida(t) ? placa : t;
  const opcoes = { staleTime: 30_000, retry: false } as const;

  const veiculos = useQuery({
    ...opcoes, queryKey: ['busca', 'veiculos', placa], enabled: placa.length >= MIN_CARACTERES,
    queryFn: async () => (await api.get<Veiculo[]>('/veiculos', { params: { placa } })).data.slice(0, LIMITE_POR_GRUPO),
  });
  const clientes = useQuery({
    ...opcoes, queryKey: ['busca', 'clientes', t], enabled: t.length >= MIN_CARACTERES,
    queryFn: async () => (await api.get<Cliente[]>('/clientes', { params: { busca: t } })).data.slice(0, LIMITE_POR_GRUPO),
  });
  const pedidos = useQuery({
    ...opcoes, queryKey: ['busca', 'pedidos', termoPedido], enabled: t.length >= MIN_CARACTERES,
    queryFn: async () => (await api.get<Paginado<Pedido>>('/pedidos', { params: { busca: termoPedido, size: LIMITE_POR_GRUPO } })).data.content,
  });
  return { veiculos, clientes, pedidos, ativa: t.length >= MIN_CARACTERES };
}
