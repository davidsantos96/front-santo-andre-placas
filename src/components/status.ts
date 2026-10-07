export const STATUS = {
  RECEBIDO:         { label: 'Recebido',         cor: '#003399', bg: '#E8EDF9' },
  EM_PROCESSAMENTO: { label: 'Em processamento', cor: '#003399', bg: '#E8EDF9' },
  PLACA_PRONTA:     { label: 'Placa pronta',     cor: '#B45309', bg: '#FBF0E4' },
  ENTREGUE:         { label: 'Entregue',         cor: '#1E7F4F', bg: '#E7F3ED' },
  CANCELADO:        { label: 'Cancelado',        cor: '#B91C1C', bg: '#FBEAEA' },
} as const;
export type StatusPedido = keyof typeof STATUS;
export const FLUXO: StatusPedido[] = ['RECEBIDO', 'EM_PROCESSAMENTO', 'PLACA_PRONTA', 'ENTREGUE'];
export const PROXIMO_PASSO: Partial<Record<StatusPedido, string>> = {
  RECEBIDO: 'Iniciar processamento',
  EM_PROCESSAMENTO: 'Marcar placa pronta',
  PLACA_PRONTA: 'Registrar entrega',
};

// Os 5 valores precisam bater 1:1 com o enum FormaPagamento do backend.
export const FORMA_PAGAMENTO = {
  PIX:            { label: 'Pix',               cor: '#003399' },
  CARTAO_CREDITO: { label: 'Cartão de crédito', cor: '#6B8BC9' },
  CARTAO_DEBITO:  { label: 'Cartão de débito',  cor: '#93A9D1' },
  DINHEIRO:       { label: 'Dinheiro',          cor: '#1E7F4F' },
  BOLETO:         { label: 'Boleto',            cor: '#5C6470' },
} as const;
export type FormaPagamento = keyof typeof FORMA_PAGAMENTO;

export const ORIGEM = { WHATSAPP: 'WhatsApp', BALCAO: 'Balcão', TELEFONE: 'Telefone' } as const;
export type Origem = keyof typeof ORIGEM;
