import { http, HttpResponse } from 'msw';
import type { FechamentoCaixa, MovimentacaoRequest, NovoServicoRequest, PagamentoListagem, Servico, Cliente, LoginRequest, LoginResponse, NovoClienteRequest, NovoPedidoRequest, NovoVeiculoRequest, Pagamento, PagamentoRequest, Paginado, Pedido, Veiculo } from '@/api/types';
import type { StatusPedido } from '@/components/status';
import { db } from './db';

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080/api';
const url = (p: string) => `${base}${p}`;

const naoAutorizado = () => HttpResponse.json({ mensagem: 'Não autenticado' }, { status: 401 });
const autenticado = (req: Request) => {
  const t = req.headers.get('Authorization')?.replace('Bearer ', '');
  return t && db.tokens.has(t) ? db.tokens.get(t)! : null;
};

/** Invalida todos os tokens (simula JWT de 8h expirado). */
export const expirarSessoes = () => db.tokens.clear();

let seq = 0;

const dia = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const handlers = [
  http.post(url('/auth/login'), async ({ request }) => {
    const { email, senha } = (await request.json()) as LoginRequest;
    const u = db.usuarios.find((x) => x.email === email && x.senha === senha && x.ativo);
    if (!u) return HttpResponse.json({ mensagem: 'Credenciais inválidas' }, { status: 401 });
    const token = `mock-${u.id}-${++seq}`;
    db.tokens.set(token, { papel: u.papel, nome: u.nome });
    const corpo: LoginResponse = { token, papel: u.papel, nome: u.nome };
    return HttpResponse.json(corpo);
  }),

  http.get(url('/estoque/itens'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    return HttpResponse.json(db.estoque);
  }),
  http.get(url('/estoque/itens/baixo-estoque'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    return HttpResponse.json(db.estoque.filter((i) => i.quantidade <= i.quantidadeMinima));
  }),

  http.get(url('/pedidos'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    const q = new URL(request.url).searchParams;
    const status = q.get('status');
    const clienteId = q.get('clienteId');
    const de = q.get('de');
    const ate = q.get('ate');
    const size = Number(q.get('size') ?? 50);
    const page = Number(q.get('page') ?? 0);

    const filtrados = db.pedidos
      .filter((p) => !status || p.status === status)
      .filter((p) => !clienteId || p.cliente.id === Number(clienteId))
      .filter((p) => !de || dia(p.criadoEm) >= de)
      .filter((p) => !ate || dia(p.criadoEm) <= ate)
      .sort((a, b) => b.id - a.id);

    const corpo: Paginado<Pedido> = {
      content: filtrados.slice(page * size, page * size + size),
      page: { size, number: page, totalElements: filtrados.length, totalPages: Math.max(1, Math.ceil(filtrados.length / size)) },
    };
    return HttpResponse.json(corpo);
  }),

  http.get(url('/pedidos/:id'), ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    const p = db.pedidos.find((x) => x.id === Number(params.id));
    return p ? HttpResponse.json(p) : HttpResponse.json({ mensagem: 'Pedido não encontrado' }, { status: 404 });
  }),

  http.patch(url('/pedidos/:id/status'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    const p = db.pedidos.find((x) => x.id === Number(params.id));
    if (!p) return HttpResponse.json({ mensagem: 'Pedido não encontrado' }, { status: 404 });
    const { novoStatus } = (await request.json()) as { novoStatus: StatusPedido };
    const anterior = p.status;
    p.status = novoStatus;
    p.atualizadoEm = new Date().toISOString();
    db.historico.push({
      id: db.historico.length + 1, pedidoId: p.id, statusAnterior: anterior, statusNovo: novoStatus,
      alteradoPor: u.nome, alteradoEm: p.atualizadoEm,
    });
    // baixa automática de estoque ao entrar em EM_PROCESSAMENTO
    if (novoStatus === 'EM_PROCESSAMENTO' && anterior !== 'EM_PROCESSAMENTO') {
      const item = db.estoque.find((i) => i.id === (p.servico.id === 2 ? 2 : 1));
      if (item) item.quantidade = Math.max(0, item.quantidade - 1);
    }
    return HttpResponse.json(p);
  }),

  http.get(url('/pedidos/:id/historico'), ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    return HttpResponse.json(
      db.historico.filter((h) => h.pedidoId === Number(params.id)).sort((a, b) => a.id - b.id)
        .map(({ pedidoId: _p, ...h }) => h),
    );
  }),

  http.get(url('/pedidos/:id/pagamentos'), ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    return HttpResponse.json(db.pagamentos.filter((p) => p.pedidoId === Number(params.id)));
  }),

  http.post(url('/pedidos/:id/pagamento'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    const pedido = db.pedidos.find((x) => x.id === Number(params.id));
    if (!pedido) return HttpResponse.json({ mensagem: 'Pedido não encontrado' }, { status: 404 });
    const dados = (await request.json()) as PagamentoRequest;
    if (db.pagamentos.some((p) => p.pedidoId === pedido.id && p.status === 'PAGO')) {
      return HttpResponse.json({ mensagem: 'Pedido já possui pagamento registrado' }, { status: 400 });
    }
    const pg: Pagamento = {
      id: db.pagamentos.length + 1, pedidoId: pedido.id, valorCentavos: dados.valorCentavos,
      formaPagamento: dados.formaPagamento, status: 'PAGO', pagoEm: new Date().toISOString(), registradoPor: u.nome,
    };
    db.pagamentos.push(pg);
    pedido.pago = true;
    return HttpResponse.json(pg, { status: 201 });
  }),

  http.post(url('/pedidos'), async ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    const d = (await request.json()) as NovoPedidoRequest;
    const cliente = db.clientes.find((c) => c.id === d.clienteId);
    const veiculo = db.veiculos.find((v) => v.id === d.veiculoId);
    const servico = db.servicos.find((s) => s.id === d.servicoId && s.ativo);
    if (!cliente) return HttpResponse.json({ mensagem: 'Cliente não encontrado' }, { status: 400 });
    if (!veiculo) return HttpResponse.json({ mensagem: 'Veículo não encontrado' }, { status: 400 });
    if (!servico) return HttpResponse.json({ mensagem: 'Serviço não encontrado' }, { status: 400 });
    const agora = new Date().toISOString();
    const pedido: Pedido = {
      id: Math.max(...db.pedidos.map((p) => p.id)) + 1, status: 'RECEBIDO', origem: d.origem, criadoEm: agora,
      atualizadoEm: agora, cliente, veiculo, servico, pago: false,
    };
    db.pedidos.push(pedido);
    db.historico.push({ id: db.historico.length + 1, pedidoId: pedido.id, statusAnterior: null, statusNovo: 'RECEBIDO', alteradoPor: u.nome, alteradoEm: agora });
    return HttpResponse.json(pedido, { status: 201 });
  }),

  http.get(url('/clientes'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    const busca = new URL(request.url).searchParams.get('busca')?.trim().toLowerCase();
    const digitos = busca?.replace(/\D/g, '');
    const lista = !busca ? db.clientes : db.clientes.filter((c) =>
      c.nome.toLowerCase().includes(busca) ||
      (!!digitos && (c.telefone.replace(/\D/g, '').includes(digitos) || c.cpfCnpj.replace(/\D/g, '').includes(digitos))));
    return HttpResponse.json(lista);
  }),

  http.post(url('/clientes'), async ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    const d = (await request.json()) as NovoClienteRequest;
    const igual = (a: string, b: string) => a.replace(/\D/g, '') === b.replace(/\D/g, '');
    if (db.clientes.some((c) => igual(c.cpfCnpj, d.cpfCnpj))) {
      return HttpResponse.json({ mensagem: 'Dados inválidos', campos: { cpfCnpj: 'CPF/CNPJ já cadastrado' } }, { status: 400 });
    }
    const c: Cliente = { id: Math.max(0, ...db.clientes.map((x) => x.id)) + 1, ...d, criadoEm: new Date().toISOString() };
    db.clientes.push(c);
    return HttpResponse.json(c, { status: 201 });
  }),

  http.get(url('/veiculos'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    const q = new URL(request.url).searchParams;
    const placa = q.get('placa')?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const clienteId = q.get('clienteId');
    return HttpResponse.json(
      db.veiculos.filter((v) => (!placa || v.placa.includes(placa)) && (!clienteId || v.clienteId === Number(clienteId))),
    );
  }),

  http.post(url('/veiculos'), async ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    const d = (await request.json()) as NovoVeiculoRequest;
    const cliente = db.clientes.find((c) => c.id === d.clienteId);
    if (!cliente) return HttpResponse.json({ mensagem: 'Cliente não encontrado' }, { status: 400 });
    if (db.veiculos.some((v) => v.placa === d.placa)) {
      return HttpResponse.json({ mensagem: 'Dados inválidos', campos: { placa: 'Placa já cadastrada' } }, { status: 400 });
    }
    const v: Veiculo = { id: Math.max(0, ...db.veiculos.map((x) => x.id)) + 1, ...d, clienteNome: cliente.nome };
    db.veiculos.push(v);
    return HttpResponse.json(v, { status: 201 });
  }),

  http.post(url('/veiculos/:id/consultar'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    return HttpResponse.json({ mensagem: 'Consulta veicular ainda não está disponível.' }, { status: 400 });
  }),

  http.get(url('/servicos'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    return HttpResponse.json(db.servicos.filter((s) => s.ativo));
  }),

  http.get(url('/clientes/:id'), ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    const c = db.clientes.find((x) => x.id === Number(params.id));
    return c ? HttpResponse.json(c) : HttpResponse.json({ mensagem: 'Cliente não encontrado' }, { status: 404 });
  }),

  http.put(url('/clientes/:id'), async ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    const c = db.clientes.find((x) => x.id === Number(params.id));
    if (!c) return HttpResponse.json({ mensagem: 'Cliente não encontrado' }, { status: 404 });
    const d = (await request.json()) as NovoClienteRequest;
    const igual = (a: string, b: string) => a.replace(/\D/g, '') === b.replace(/\D/g, '');
    if (db.clientes.some((x) => x.id !== c.id && igual(x.cpfCnpj, d.cpfCnpj))) {
      return HttpResponse.json({ mensagem: 'Dados inválidos', campos: { cpfCnpj: 'CPF/CNPJ já cadastrado' } }, { status: 400 });
    }
    Object.assign(c, d); // pedidos e veículos referenciam o mesmo objeto
    db.veiculos.filter((v) => v.clienteId === c.id).forEach((v) => { v.clienteNome = c.nome; });
    return HttpResponse.json(c);
  }),

  http.get(url('/veiculos/:id'), ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    const v = db.veiculos.find((x) => x.id === Number(params.id));
    return v ? HttpResponse.json(v) : HttpResponse.json({ mensagem: 'Veículo não encontrado' }, { status: 404 });
  }),

  http.get(url('/veiculos/:id/historico-consultas'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    return HttpResponse.json([]);
  }),

  http.post(url('/servicos'), async ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const d = (await request.json()) as NovoServicoRequest;
    const s: Servico = { id: Math.max(0, ...db.servicos.map((x) => x.id)) + 1, ...d };
    db.servicos.push(s);
    return HttpResponse.json(s, { status: 201 });
  }),

  http.put(url('/servicos/:id'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const s = db.servicos.find((x) => x.id === Number(params.id));
    if (!s) return HttpResponse.json({ mensagem: 'Serviço não encontrado' }, { status: 404 });
    Object.assign(s, (await request.json()) as NovoServicoRequest);
    return HttpResponse.json(s);
  }),

  http.post(url('/estoque/movimentacoes'), async ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    const d = (await request.json()) as MovimentacaoRequest;
    const item = db.estoque.find((i) => i.id === d.itemId);
    if (!item) return HttpResponse.json({ mensagem: 'Item não encontrado' }, { status: 400 });
    if (!Number.isInteger(d.quantidade) || d.quantidade <= 0) return HttpResponse.json({ mensagem: 'Quantidade inválida' }, { status: 400 });
    if (d.tipo === 'SAIDA' && d.quantidade > item.quantidade) return HttpResponse.json({ mensagem: 'Saldo insuficiente' }, { status: 400 });
    item.quantidade += d.tipo === 'ENTRADA' ? d.quantidade : -d.quantidade;
    return HttpResponse.json(item, { status: 201 });
  }),

  http.get(url('/pagamentos'), ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    return HttpResponse.json(listarPagamentos(new URL(request.url).searchParams));
  }),

  http.get(url('/financeiro/fechamento-caixa'), ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const q = new URL(request.url).searchParams;
    const hoje = dia(new Date().toISOString());
    const de = q.get('de') ?? hoje;
    const ate = q.get('ate') ?? hoje;
    const lista = listarPagamentos(new URLSearchParams({ de, ate }));
    const porForma = new Map<string, { totalCentavos: number; quantidade: number }>();
    lista.forEach((p) => {
      const a = porForma.get(p.formaPagamento) ?? { totalCentavos: 0, quantidade: 0 };
      porForma.set(p.formaPagamento, { totalCentavos: a.totalCentavos + p.valorCentavos, quantidade: a.quantidade + 1 });
    });
    const corpo: FechamentoCaixa = {
      de, ate,
      totalGeral: lista.reduce((t, p) => t + p.valorCentavos, 0),
      quantidadePagamentos: lista.length,
      porFormaPagamento: [...porForma].map(([formaPagamento, v]) => ({ formaPagamento: formaPagamento as FechamentoCaixa['porFormaPagamento'][number]['formaPagamento'], ...v })),
    };
    return HttpResponse.json(corpo);
  }),
];

function listarPagamentos(q: URLSearchParams): PagamentoListagem[] {
  const de = q.get('de');
  const ate = q.get('ate');
  const forma = q.get('forma');
  return db.pagamentos
    .filter((p) => p.status === 'PAGO')
    .filter((p) => !de || dia(p.pagoEm) >= de)
    .filter((p) => !ate || dia(p.pagoEm) <= ate)
    .filter((p) => !forma || p.formaPagamento === forma)
    .sort((a, b) => b.pagoEm.localeCompare(a.pagoEm))
    .map((p) => {
      const ped = db.pedidos.find((x) => x.id === p.pedidoId)!;
      return {
        id: p.id, pedidoId: p.pedidoId, placa: ped.veiculo.placa, clienteNome: ped.cliente.nome, servicoNome: ped.servico.nome,
        formaPagamento: p.formaPagamento, valorCentavos: p.valorCentavos, pagoEm: p.pagoEm, registradoPor: p.registradoPor,
      };
    });
}
