import type { FiltroPagamentos, FiltroPedidos } from './types';

export const qk = {
  pedidos: (f?: FiltroPedidos) => ['pedidos', f] as const,
  pedido: (id: number) => ['pedido', id] as const,
  historico: (id: number) => ['pedido', id, 'historico'] as const,
  pagamentosDoPedido: (id: number) => ['pedido', id, 'pagamentos'] as const,
  clientes: (busca?: string) => ['clientes', busca] as const,
  cliente: (id: number) => ['cliente', id] as const,
  veiculos: (f?: { placa?: string; clienteId?: number }) => ['veiculos', f] as const,
  servicos: ['servicos'] as const,
  estoque: ['estoque'] as const,
  estoqueBaixo: ['estoque', 'baixo'] as const,
  pagamentos: (f: FiltroPagamentos) => ['pagamentos', f] as const,
  // Caixa é sempre um período (de/ate), não um dia único.
  caixa: (de: string, ate: string) => ['caixa', de, ate] as const,
  dashboard: {
    resumo: ['dash', 'resumo'] as const,
    faturamento: (p: string) => ['dash', 'fat', p] as const,
  },
};
