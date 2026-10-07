import type { Cliente, ItemEstoque, Pagamento, Pedido, Servico, Usuario, Veiculo, MovimentacaoEstoque, RegistroAuditoria } from '@/api/types';
import type { Papel } from '@/auth/papeis';
import type { FormaPagamento, StatusPedido } from '@/components/status';

/** Dados do protótipo (pedidos 1048–1058, clientes, serviços, estoque) como fixtures do MSW. */

/**
 * "12 min", "2h 10min" → minutos atrás, mas nunca antes da meia-noite local (senão, de madrugada,
 * pedidos "de hoje" cairiam em ontem). "ontem" = ontem às 14h, sempre.
 */
const minutos = (t: string, agora: number): number => {
  const d = new Date(agora);
  if (t === 'ontem') {
    const ontem14 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 14, 0, 0).getTime();
    return Math.round((agora - ontem14) / 60_000);
  }
  const desdeMeiaNoite = Math.max(2, Math.floor((agora - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 60_000));
  const h = /(\d+)h/.exec(t);
  const m = /(\d+)\s*min/.exec(t);
  return Math.min((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0), desdeMeiaNoite - 1);
};
const iso = (minAtras: number, agora: number) => new Date(agora - minAtras * 60_000).toISOString();

export const SERVICOS: Servico[] = [
  { id: 1, nome: 'Par de placas Mercosul (carro)', descricao: '', categoria: 'EMPLACAMENTO', precoCentavos: 31690, ativo: true },
  { id: 2, nome: 'Placa Mercosul (moto)', descricao: '', categoria: 'EMPLACAMENTO', precoCentavos: 19890, ativo: true },
  { id: 3, nome: 'Segunda via de placa', descricao: '', categoria: 'SEGUNDA VIA', precoCentavos: 24900, ativo: true },
  { id: 4, nome: 'Transferência + emplacamento', descricao: '', categoria: 'DOCUMENTAÇÃO', precoCentavos: 44900, ativo: true },
  { id: 5, nome: 'Lacre / desamassamento', descricao: '', categoria: 'SERVIÇOS', precoCentavos: 8900, ativo: true },
];

export const ESTOQUE: ItemEstoque[] = [
  { id: 1, nome: 'Placa Mercosul carro (par)', sku: 'PLC-CAR-PAR', unidade: 'par', quantidade: 34, quantidadeMinima: 20 },
  { id: 2, nome: 'Placa Mercosul moto', sku: 'PLC-MOT-UNI', unidade: 'un', quantidade: 12, quantidadeMinima: 15 },
  { id: 3, nome: 'Lacre inviolável', sku: 'LAC-STD', unidade: 'un', quantidade: 8, quantidadeMinima: 25 },
  { id: 4, nome: 'Suporte de placa (moldura)', sku: 'SUP-MOLD', unidade: 'un', quantidade: 57, quantidadeMinima: 30 },
  { id: 5, nome: 'Parafuso anti-furto (kit)', sku: 'PAR-KIT4', unidade: 'kit', quantidade: 22, quantidadeMinima: 20 },
  { id: 6, nome: 'Película refletiva', sku: null, unidade: 'rolo', quantidade: 3, quantidadeMinima: 10 },
];

// serviço → item de estoque consumido na baixa automática (GET /estoque/vinculos?servicoId=)
export const VINCULOS = [
  { id: 1, servicoId: 1, servicoNome: 'Par de placas Mercosul (carro)', itemEstoqueId: 1, itemEstoqueNome: 'Placa Mercosul carro (par)', quantidadeNecessaria: 1 },
  { id: 2, servicoId: 2, servicoNome: 'Placa Mercosul (moto)', itemEstoqueId: 2, itemEstoqueNome: 'Placa Mercosul moto', quantidadeNecessaria: 1 },
  { id: 3, servicoId: 1, servicoNome: 'Par de placas Mercosul (carro)', itemEstoqueId: 3, itemEstoqueNome: 'Lacre inviolável', quantidadeNecessaria: 2 },
];

export const USUARIOS: (Usuario & { senha: string })[] = [
  { id: 1, nome: 'Bruna Costa', email: 'atendente@sap.com', papel: 'ATENDENTE', ativo: true, senha: '123456' },
  { id: 2, nome: 'Carlos Menezes', email: 'gerente@sap.com', papel: 'GERENTE', ativo: true, senha: '123456' },
  { id: 3, nome: 'Admin SAP', email: 'admin@sap.com', papel: 'ADMIN', ativo: true, senha: '123456' },
];

// [id, placa, cliente, cpfCnpj, tel, servicoId, origem, status, tempo, pago, marca+modelo, ano, forma]
type Linha = [number, string, string, string, string, number, string, StatusPedido, string, boolean, string, number, FormaPagamento?];
const LINHAS: Linha[] = [
  [1058, 'FZR4C71', 'Marcos Vilela', '412.688.301-00', '(11) 98877-1234', 1, 'WHATSAPP', 'RECEBIDO', '12 min', false, 'Fiat Argo Drive 1.0', 2022],
  [1057, 'GHK2D18', 'Auto Escola Horizonte LTDA', '12.345.678/0001-95', '(11) 4433-2210', 4, 'TELEFONE', 'RECEBIDO', '38 min', false, 'Chevrolet Onix LT 1.0', 2023],
  [1056, 'DPT7B02', 'Renata Sampaio', '318.554.902-34', '(11) 97712-0983', 3, 'BALCAO', 'RECEBIDO', '1h 05min', true, 'Volkswagen T-Cross 200 TSI', 2021, 'PIX'],
  [1055, 'EBX9A55', 'Marcos Vilela', '412.688.301-00', '(11) 98877-1234', 2, 'BALCAO', 'EM_PROCESSAMENTO', '2h 10min', false, 'Honda CG 160 Fan', 2019],
  [1054, 'BRA2E19', 'José Aparecido Nunes', '201.377.415-02', '(11) 96401-5520', 1, 'WHATSAPP', 'EM_PROCESSAMENTO', '3h 25min', true, 'Toyota Corolla XEi', 2020, 'CARTAO_CREDITO'],
  [1053, 'JKL3F44', 'Transportes Iguaçu ME', '23.980.114/0001-40', '(11) 4002-8933', 1, 'TELEFONE', 'EM_PROCESSAMENTO', '4h 02min', false, 'Mercedes-Benz Sprinter 314', 2018],
  [1052, 'MNO5G88', 'Célia Regina Prado', '287.410.663-16', '(11) 95530-4417', 3, 'WHATSAPP', 'PLACA_PRONTA', '5h 40min', true, 'Hyundai HB20 Sense', 2020, 'PIX'],
  [1051, 'PQR8H21', 'Douglas Ferreira', '354.902.118-65', '(11) 98104-7762', 2, 'BALCAO', 'PLACA_PRONTA', '6h 15min', false, 'Yamaha Fazer 250', 2021],
  [1050, 'STU1J09', 'Vanessa Okamoto', '390.114.552-40', '(11) 99218-3345', 1, 'BALCAO', 'ENTREGUE', 'ontem', true, 'Jeep Renegade Sport', 2022, 'CARTAO_DEBITO'],
  [1049, 'VWX6K33', 'Locadora Drive+ LTDA', '44.120.907/0001-60', '(11) 3311-9080', 4, 'WHATSAPP', 'ENTREGUE', 'ontem', true, 'Renault Kwid Zen', 2023, 'BOLETO'],
  [1048, 'YZA9L77', 'Paulo Sérgio Lima', '150.336.481-01', '(11) 97460-2291', 5, 'BALCAO', 'ENTREGUE', 'ontem', true, 'Ford Ka SE 1.0', 2017, 'DINHEIRO'],
];

const ORDEM: StatusPedido[] = ['RECEBIDO', 'EM_PROCESSAMENTO', 'PLACA_PRONTA', 'ENTREGUE'];

export type HistoricoMock = { id: number; pedidoId: number; statusAnterior: StatusPedido | null; statusNovo: StatusPedido; alteradoPor: string; alteradoPorId: number | null; alteradoEm: string };

export function criarBanco(agora = Date.now()) {
  const clientes: Cliente[] = [];
  const veiculos: Veiculo[] = [];
  const pedidos: Pedido[] = [];
  const pagamentos: Pagamento[] = [];
  const historico: HistoricoMock[] = [];

  for (const [id, placa, nome, cpfCnpj, telefone, servicoId, origem, status, tempo, pago, mm, ano, forma] of LINHAS) {
    let cliente = clientes.find((c) => c.cpfCnpj === cpfCnpj);
    if (!cliente) {
      cliente = { id: clientes.length + 1, nome, telefone, cpfCnpj, email: '', criadoEm: iso(60 * 24 * 30, agora), criadoPor: 'Bruna Costa', criadoPorId: 1, atualizadoEm: null, atualizadoPor: null, atualizadoPorId: null };
      clientes.push(cliente);
    }
    const veiculo: Veiculo = {
      id: veiculos.length + 1, placa, marcaModelo: mm, anoFabricacao: ano, anoModelo: ano + 1,
      chassi: `9BW${String(id).padStart(14, '0')}`, clienteId: cliente.id, clienteNome: cliente.nome,
      criadoEm: iso(60 * 24 * 20, agora), criadoPor: 'Bruna Costa', criadoPorId: 1, atualizadoEm: null, atualizadoPor: null, atualizadoPorId: null,
    };
    veiculos.push(veiculo);

    const criado = iso(minutos(tempo, agora), agora);
    pedidos.push({
      id, status, origem, criadoEm: criado, atualizadoEm: criado, cliente, veiculo, pago,
      servico: SERVICOS.find((s) => s.id === servicoId)!,
      precoCentavos: SERVICOS.find((s) => s.id === servicoId)!.precoCentavos, // snapshot do preço cobrado
    });

    // Histórico: um passo por status atingido.
    const ate = ORDEM.indexOf(status);
    ORDEM.slice(0, ate + 1).forEach((s, i) => {
      historico.push({
        id: historico.length + 1, pedidoId: id, statusAnterior: i === 0 ? null : ORDEM[i - 1], statusNovo: s,
        alteradoPor: 'Bruna Costa', alteradoPorId: 1, alteradoEm: iso(Math.max(minutos(tempo, agora) - i * 25, 1), agora),
      });
    });

    if (pago && forma) {
      const servico = SERVICOS.find((s) => s.id === servicoId)!;
      pagamentos.push({
        id: pagamentos.length + 1, pedidoId: id, valorCentavos: servico.precoCentavos, formaPagamento: forma,
        status: 'PAGO', pagoEm: iso(Math.max(minutos(tempo, agora) - 5, 1), agora), registradoPor: 'Bruna Costa', registradoPorId: 1,
      });
    }
  }

  return {
    clientes, veiculos, pedidos, pagamentos, historico,
    movimentacoes: [] as MovimentacaoEstoque[],
    auditoria: [] as RegistroAuditoria[],
    servicos: structuredClone(SERVICOS),
    estoque: structuredClone(ESTOQUE),
    vinculos: structuredClone(VINCULOS),
    usuarios: structuredClone(USUARIOS),
    tokens: new Map<string, { papel: Papel; nome: string; email: string }>(),
  };
}

export type Banco = ReturnType<typeof criarBanco>;
