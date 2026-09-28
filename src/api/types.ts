import type { FormaPagamento, StatusPedido } from '@/components/status';
import type { Papel } from '@/auth/papeis';

/** DTOs da API — espelho dos records Java (spec §11). Sem tradução de nomes. */

export type Cliente = { id: number; nome: string; telefone: string; cpfCnpj: string; email: string; criadoEm: string };
export type Veiculo = {
  id: number; placa: string; marcaModelo: string; anoFabricacao: number; anoModelo: number;
  chassi: string; clienteId: number; clienteNome: string;
};
export type Servico = { id: number; nome: string; descricao: string; precoCentavos: number; categoria: string; ativo: boolean };

export type Pedido = {
  id: number; status: StatusPedido; origem: string; criadoEm: string; atualizadoEm: string;
  cliente: Cliente; veiculo: Veiculo; servico: Servico;
  /**
   * NÃO existe no PedidoResponse atual (spec §11) — o Kanban precisa dele para o
   * "$ pendente" sem N+1. Opcional: se o backend não enviar, a tag simplesmente não aparece.
   */
  pago?: boolean;
};

export type Pagamento = {
  id: number; pedidoId: number; valorCentavos: number; formaPagamento: FormaPagamento;
  status: 'PAGO' | 'CANCELADO'; pagoEm: string; registradoPor: string;
};
export type PagamentoListagem = {
  id: number; pedidoId: number; placa: string; clienteNome: string; servicoNome: string;
  formaPagamento: FormaPagamento; valorCentavos: number; pagoEm: string; registradoPor: string;
};

export type HistoricoStatus = {
  id: number; statusAnterior: StatusPedido | null; statusNovo: StatusPedido; alteradoPor: string; alteradoEm: string;
};

export type ItemEstoque = {
  id: number; nome: string; sku: string | null; unidade: string | null; quantidade: number; quantidadeMinima: number;
};

export type FechamentoCaixa = {
  de: string; ate: string; totalGeral: number; quantidadePagamentos: number;
  porFormaPagamento: { formaPagamento: FormaPagamento; totalCentavos: number; quantidade: number }[];
};

export type ResumoDashboard = {
  pedidosHoje: number; pedidosPorStatus: Record<StatusPedido, number>;
  faturamentoHojeCentavos: number; itensBaixoEstoque: number;
};
export type TempoMedioProducao = { horasMedia: number; pedidosConsiderados: number };

export type Usuario = { id: number; nome: string; email: string; papel: Papel; ativo: boolean };

export type LoginRequest = { email: string; senha: string };
export type LoginResponse = { token: string; papel: Papel; nome: string };

export type NovoPedidoRequest = { clienteId: number; veiculoId: number; servicoId: number; origem: string };
export type ConsultaVeicularResultado = { marcaModelo: string; anoFabricacao: number; anoModelo: number; chassi: string };

/** Formato padrão do Spring PagedModel. */
export type Paginado<T> = {
  content: T[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
};

export type FiltroPedidos = {
  status?: StatusPedido; clienteId?: number; de?: string; ate?: string; page?: number; size?: number;
};
export type FiltroPagamentos = { de: string; ate: string; forma?: FormaPagamento };

/** Erro normalizado que sai do cliente HTTP. */
export type ApiError = { status: number; mensagem: string; campos?: Record<string, string> };
