import type { FormaPagamento, StatusPedido } from '@/components/status';
import type { Papel } from '@/auth/papeis';

/** DTOs da API — espelho dos records Java (spec §11). Sem tradução de nomes. */

/**
 * Autoria (rastreabilidade): `<x>Por` é o NOME congelado na hora da ação (snapshot — não resolver pelo id) e `<x>PorId` o id
 * do usuário. Ambos podem ser `null`; registros criados fora de uma requisição vêm como "sistema". `atualizadoEm === null`
 * = nunca editado.
 */
export type Autoria = {
  criadoEm?: string | null; criadoPor?: string | null; criadoPorId?: number | null;
  atualizadoEm?: string | null; atualizadoPor?: string | null; atualizadoPorId?: number | null;
};

/** `totalPedidos` (inclui cancelados) só vem nas leituras de `/clientes`; fica `null` quando o cliente vem embutido em outra resposta. */
export type Cliente = Autoria & { id: number; nome: string; telefone: string; cpfCnpj: string; email: string; criadoEm: string; totalPedidos?: number | null };
export type Veiculo = Autoria & {
  id: number; placa: string; marcaModelo: string | null; anoFabricacao: number | null; anoModelo: number | null;
  chassi: string | null; clienteId: number; clienteNome: string;
};
/** `pedidosNoMes` (não cancelados, mês de São Paulo) só vem nas leituras de `/servicos`. */
export type Servico = { id: number; nome: string; descricao: string; precoCentavos: number; categoria: string; ativo: boolean; pedidosNoMes?: number | null };

export type Pedido = {
  id: number; status: StatusPedido; origem: string; criadoEm: string; atualizadoEm: string;
  /** Preço cobrado NESTE pedido (snapshot). `servico.precoCentavos` é o preço de tabela de hoje e pode ter mudado. */
  precoCentavos: number;
  cliente: Cliente; veiculo: Veiculo; servico: Servico;
  /** Vem da API: soma dos pagamentos `PAGO` ≥ preço do serviço (`PedidoService.estaPago`). */
  pago: boolean;
};

export type Pagamento = {
  id: number; pedidoId: number; valorCentavos: number; formaPagamento: FormaPagamento;
  status: 'PAGO' | 'CANCELADO'; pagoEm: string; registradoPor: string; registradoPorId?: number | null;
};
export type PagamentoListagem = {
  id: number; pedidoId: number; placa: string; clienteNome: string; servicoNome: string;
  formaPagamento: FormaPagamento; valorCentavos: number; pagoEm: string; registradoPor: string; registradoPorId?: number | null;
};

export type HistoricoStatus = {
  id: number; statusAnterior: StatusPedido | null; statusNovo: StatusPedido; alteradoPor: string; alteradoPorId?: number | null; alteradoEm: string;
};

export type ItemEstoque = {
  id: number; nome: string; sku: string | null; unidade: string | null; quantidade: number; quantidadeMinima: number;
  /** Item de estoque só tem autoria de criação (não há edição); a mudança de quantidade fica nas movimentações. */
  criadoEm?: string | null; criadoPor?: string | null; criadoPorId?: number | null;
};

/** `GET /estoque/movimentacoes` (mais recente primeiro): entradas, saídas manuais e baixas automáticas (com `pedidoId`). */
export type MovimentacaoEstoque = {
  id: number; itemEstoqueId: number; itemEstoqueNome: string; tipo: 'ENTRADA' | 'SAIDA'; quantidade: number;
  pedidoId: number | null; registradoPor: string | null; registradoPorId: number | null; criadoEm: string;
};

export type EntidadeAuditada = 'SERVICO' | 'USUARIO';
export type AcaoAuditada = 'CRIACAO' | 'ATUALIZACAO' | 'ATIVACAO' | 'DESATIVACAO' | 'RESET_SENHA';
/** `GET /auditoria` (ADMIN/GERENTE). Uma linha por campo alterado; `valorAnterior`/`valorNovo` são sempre texto (inclusive `precoCentavos`). */
export type RegistroAuditoria = {
  id: number; entidade: EntidadeAuditada; entidadeId: number; entidadeDescricao: string | null; acao: AcaoAuditada;
  campo: string | null; valorAnterior: string | null; valorNovo: string | null;
  feitoPor: string | null; feitoPorId: number | null; feitoEm: string;
};

export type FechamentoCaixa = {
  de: string; ate: string; totalGeral: number; quantidadePagamentos: number;
  porFormaPagamento: { formaPagamento: FormaPagamento; totalCentavos: number; quantidade: number }[];
};

export type ResumoDashboard = {
  pedidosHoje: number; pedidosPorStatus: Record<StatusPedido, number>;
  faturamentoHojeCentavos: number; itensBaixoEstoque: number;
};
/** `horasMediaPeriodoAnterior`: média do período de mesma duração imediatamente anterior (só com `de`/`ate`; `null` sem dados). */
export type TempoMedioProducao = { horasMedia: number; pedidosConsiderados: number; horasMediaPeriodoAnterior?: number | null };

export type Usuario = { id: number; nome: string; email: string; papel: Papel; ativo: boolean; ultimoAcessoEm?: string | null };

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
  status?: StatusPedido; clienteId?: number; de?: string; ate?: string; busca?: string; page?: number; size?: number;
};
export type FiltroPagamentos = { de: string; ate: string; forma?: FormaPagamento };

/** Erro normalizado que sai do cliente HTTP. */
export type ApiError = { status: number; mensagem: string; campos?: Record<string, string> };

/** Corpos de POST assumidos (o backend ainda usa a entidade crua — ver PENDENCIAS.md). */
export type NovoClienteRequest = { nome: string; telefone: string; cpfCnpj: string; email: string };
/** `chassi` é opcional (o backend aceita em branco). */
/** Só a `placa` (e o cliente) é obrigatória; o restante pode ser completado depois com `PUT /veiculos/{id}`. */
export type NovoVeiculoRequest = {
  clienteId: number; placa: string; marcaModelo?: string; anoFabricacao?: number; anoModelo?: number; chassi?: string;
};
/** `PUT /veiculos/{id}` aplica só os campos enviados (não nulos). */
export type AtualizarVeiculoRequest = { marcaModelo?: string; anoFabricacao?: number; anoModelo?: number; chassi?: string };
export type PagamentoRequest = { valorCentavos: number; formaPagamento: import('@/components/status').FormaPagamento };

/** Histórico de consultas veiculares (sempre vazio até haver provedor). Formato assumido — ver PENDENCIAS.md. */
export type ConsultaHistorico = { id: number; consultadoEm: string; fonte: string; resultado: string };

/** Corpos assumidos (contratos ainda não documentados — ver PENDENCIAS.md). */
export type NovoServicoRequest = { nome: string; descricao: string; categoria: string; precoCentavos: number; ativo: boolean };
/** Contrato real (`NovaMovimentacaoRequest`): não existe campo de observação. */
export type MovimentacaoRequest = { itemEstoqueId: number; tipo: 'ENTRADA' | 'SAIDA'; quantidade: number; pedidoId?: number };

/** Contratos do dashboard (conferidos contra o backend). */
export type FaturamentoDia = { data: string; totalCentavos: number };
export type FaturamentoResponse = { de: string; ate: string; totalCentavos: number; porDia: FaturamentoDia[] };
export type VinculoServicoItem = {
  id: number; servicoId: number; servicoNome: string; itemEstoqueId: number; itemEstoqueNome: string; quantidadeNecessaria: number;
  criadoEm?: string | null; criadoPor?: string | null; criadoPorId?: number | null;
};
export type ServicoMaisVendido = { servicoId: number; servicoNome: string; quantidadePedidos: number; faturamentoNominalCentavos: number };

/** Corpos assumidos de /usuarios (contrato não documentado — ver PENDENCIAS.md). `senha` só na criação. */
export type NovoUsuarioRequest = { nome: string; email: string; papel: Usuario['papel']; senha: string };
export type AtualizarUsuarioRequest = { nome: string; email: string; papel: Usuario['papel'] };
