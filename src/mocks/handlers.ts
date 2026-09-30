import { http, HttpResponse } from 'msw';
import type { AtualizarUsuarioRequest, NovoUsuarioRequest, Usuario, FaturamentoResponse, ResumoDashboard, ServicoMaisVendido, TempoMedioProducao, FechamentoCaixa, MovimentacaoRequest, NovoServicoRequest, PagamentoListagem, Servico, Cliente, LoginRequest, LoginResponse, NovoClienteRequest, NovoPedidoRequest, NovoVeiculoRequest, Pagamento, PagamentoRequest, Paginado, Pedido, Veiculo } from '@/api/types';
import type { StatusPedido } from '@/components/status';
import { db } from './db';
import { gerarJwt } from './jwt';

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080/api';
const url = (p: string) => `${base}${p}`;

/** `authenticationEntryPoint` do backend: token ausente/inválido/expirado (ou usuário desativado) → **401** com `mensagem`. */
const naoAutorizado = () => HttpResponse.json({ mensagem: 'Não autenticado. Faça login novamente.' }, { status: 401 });
const naoEncontradoMock = (o: string, id: unknown) => HttpResponse.json({ mensagem: `${o} não encontrado: ${id}` }, { status: 400 }); // IllegalArgumentException → 400
const autenticado = (req: Request) => {
  const t = req.headers.get('Authorization')?.replace('Bearer ', '');
  const sessao = t ? db.tokens.get(t) : undefined;
  if (!sessao) return null;
  // usuário desativado depois do login: o token continua assinado, mas não autentica mais (→ 401)
  return db.usuarios.find((u) => u.email === sessao.email)?.ativo ? sessao : null;
};

/** `PedidoResponse.pago` do backend: soma dos pagamentos PAGO ≥ preço do serviço. */
const comPago = (p: Pedido): Pedido => ({
  ...p,
  pago: db.pagamentos.filter((x) => x.pedidoId === p.id && x.status === 'PAGO').reduce((t, x) => t + x.valorCentavos, 0) >= p.servico.precoCentavos,
});

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
    // Como o backend: credencial errada → 400 "Email ou senha inválidos"; usuário inativo → 400 "Usuário inativo…".
    const u = db.usuarios.find((x) => x.email === email && x.senha === senha);
    if (!u) return HttpResponse.json({ mensagem: 'Email ou senha inválidos' }, { status: 400 });
    if (!u.ativo) return HttpResponse.json({ mensagem: 'Usuário inativo. Contate um administrador.' }, { status: 400 });
    const token = `${gerarJwt(u.email, u.papel)}.${++seq}`;
    db.tokens.set(token, { papel: u.papel, nome: u.nome, email: u.email });
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
      content: filtrados.slice(page * size, page * size + size).map(comPago),
      page: { size, number: page, totalElements: filtrados.length, totalPages: Math.max(1, Math.ceil(filtrados.length / size)) },
    };
    return HttpResponse.json(corpo);
  }),

  http.get(url('/pedidos/:id'), ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    const p = db.pedidos.find((x) => x.id === Number(params.id));
    return p ? HttpResponse.json(comPago(p)) : naoEncontradoMock('Pedido', params.id);
  }),

  http.patch(url('/pedidos/:id/status'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    const p = db.pedidos.find((x) => x.id === Number(params.id));
    if (!p) return naoEncontradoMock('Pedido', params.id);
    const { novoStatus } = (await request.json()) as { novoStatus: StatusPedido };
    const anterior = p.status;
    // Única regra de transição do backend: ENTREGUE e CANCELADO são finais.
    if (anterior === 'ENTREGUE' || anterior === 'CANCELADO') {
      return HttpResponse.json({ mensagem: `Pedido em status final (${anterior}) não pode mudar de status.` }, { status: 400 });
    }
    // Baixa automática (vínculos serviço↔item): estoque insuficiente aborta a mudança de status.
    const baixas = novoStatus === 'EM_PROCESSAMENTO' ? db.vinculos.filter((v) => v.servicoId === p.servico.id) : [];
    for (const v of baixas) {
      const item = db.estoque.find((i) => i.id === v.itemEstoqueId)!;
      if (item.quantidade < v.quantidadeNecessaria) {
        return HttpResponse.json({ mensagem: `Estoque insuficiente para "${item.nome}": disponível ${item.quantidade}, necessário ${v.quantidadeNecessaria}` }, { status: 400 });
      }
    }
    baixas.forEach((v) => { db.estoque.find((i) => i.id === v.itemEstoqueId)!.quantidade -= v.quantidadeNecessaria; });
    p.status = novoStatus;
    p.atualizadoEm = new Date().toISOString();
    db.historico.push({
      id: db.historico.length + 1, pedidoId: p.id, statusAnterior: anterior, statusNovo: novoStatus,
      alteradoPor: u.nome, alteradoEm: p.atualizadoEm,
    });
    return HttpResponse.json(comPago(p));
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
    if (!pedido) return naoEncontradoMock('Pedido', params.id);
    const dados = (await request.json()) as PagamentoRequest;
    // O backend aceita vários pagamentos por pedido (parcelas); `pago` só fica true quando a soma chega ao preço.
    const pg: Pagamento = {
      id: db.pagamentos.length + 1, pedidoId: pedido.id, valorCentavos: dados.valorCentavos,
      formaPagamento: dados.formaPagamento, status: 'PAGO', pagoEm: new Date().toISOString(), registradoPor: u.nome,
    };
    db.pagamentos.push(pg);
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
    return HttpResponse.json(comPago(pedido), { status: 201 });
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
    // O backend (entidade crua) não valida CPF/CNPJ duplicado.
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
    if (!cliente) return naoEncontradoMock('Cliente', d.clienteId);
    // Validações dos setters da entidade (o `chassi` voltou a ser opcional).
    if (!d.placa?.trim()) return HttpResponse.json({ mensagem: 'Digite a placa do veiculo' }, { status: 400 });
    if (!d.marcaModelo?.trim()) return HttpResponse.json({ mensagem: 'Marca e modelo não pode ser vazio' }, { status: 400 });
    if (!(d.anoFabricacao >= 1900)) return HttpResponse.json({ mensagem: 'Ano de fabricação inválido.' }, { status: 400 });
    if (!(d.anoModelo >= 1900)) return HttpResponse.json({ mensagem: 'Ano do modelo inválido.' }, { status: 400 });
    const v: Veiculo = {
      id: Math.max(0, ...db.veiculos.map((x) => x.id)) + 1, placa: d.placa, marcaModelo: d.marcaModelo, anoFabricacao: d.anoFabricacao,
      anoModelo: d.anoModelo, chassi: d.chassi ?? null, clienteId: cliente.id, clienteNome: cliente.nome,
    };
    db.veiculos.push(v);
    return HttpResponse.json(v);
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
    return c ? HttpResponse.json(c) : naoEncontradoMock('Cliente', params.id);
  }),

  http.put(url('/clientes/:id'), async ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    const c = db.clientes.find((x) => x.id === Number(params.id));
    if (!c) return naoEncontradoMock('Cliente', params.id);
    const d = (await request.json()) as NovoClienteRequest;
    Object.assign(c, d); // pedidos e veículos referenciam o mesmo objeto
    db.veiculos.filter((v) => v.clienteId === c.id).forEach((v) => { v.clienteNome = c.nome; });
    return HttpResponse.json(c);
  }),

  http.get(url('/veiculos/:id'), ({ request, params }) => {
    if (!autenticado(request)) return naoAutorizado();
    const v = db.veiculos.find((x) => x.id === Number(params.id));
    return v ? HttpResponse.json(v) : naoEncontradoMock('Veiculo', params.id);
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
    const s: Servico = { id: Math.max(0, ...db.servicos.map((x) => x.id)) + 1, ...d, ativo: true }; // criar sempre ativa
    db.servicos.push(s);
    return HttpResponse.json(s, { status: 201 });
  }),

  http.put(url('/servicos/:id'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const s = db.servicos.find((x) => x.id === Number(params.id));
    if (!s) return naoEncontradoMock('Serviço', params.id);
    // O backend (`ServicoService.atualizar`) copia nome/descrição/preço/categoria e **ignora `ativo`**.
    const { ativo: _ignorado, ...resto } = (await request.json()) as NovoServicoRequest;
    Object.assign(s, resto);
    return HttpResponse.json({ ...s, codigoExterno: null });
  }),

  http.patch(url('/servicos/:id/status'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const s = db.servicos.find((x) => x.id === Number(params.id));
    if (!s) return naoEncontradoMock('Serviço', params.id);
    s.ativo = ((await request.json()) as { ativo: boolean }).ativo;
    return HttpResponse.json({ ...s, codigoExterno: null });
  }),

  http.post(url('/estoque/movimentacoes'), async ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    const d = (await request.json()) as MovimentacaoRequest;
    const item = db.estoque.find((i) => i.id === d.itemEstoqueId);
    if (!item) return HttpResponse.json({ mensagem: `Item de estoque não encontrado: ${d.itemEstoqueId}` }, { status: 400 });
    if (!Number.isInteger(d.quantidade) || d.quantidade <= 0) return HttpResponse.json({ mensagem: 'A quantidade movimentada deve ser maior que zero' }, { status: 400 });
    if (d.tipo === 'SAIDA' && item.quantidade < d.quantidade) {
      return HttpResponse.json({ mensagem: `Estoque insuficiente para "${item.nome}": disponível ${item.quantidade}, necessário ${d.quantidade}` }, { status: 400 });
    }
    item.quantidade += d.tipo === 'ENTRADA' ? d.quantidade : -d.quantidade;
    return HttpResponse.json({ id: 1, itemEstoqueId: item.id, itemEstoqueNome: item.nome, tipo: d.tipo, quantidade: d.quantidade, pedidoId: d.pedidoId ?? null, criadoEm: new Date().toISOString() });
  }),

  http.post(url('/estoque/itens'), async ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const d = (await request.json()) as { nome: string; sku?: string; unidade?: string; quantidade: number; quantidadeMinima: number };
    if (!d.nome?.trim()) return HttpResponse.json({ mensagem: 'O nome do item de estoque não pode ser vazio' }, { status: 400 });
    if (d.quantidade < 0) return HttpResponse.json({ mensagem: 'A quantidade em estoque não pode ser negativa' }, { status: 400 });
    if (d.quantidadeMinima < 0) return HttpResponse.json({ mensagem: 'A quantidade mínima não pode ser negativa' }, { status: 400 });
    const item = { id: Math.max(0, ...db.estoque.map((i) => i.id)) + 1, nome: d.nome, sku: d.sku ?? null, unidade: d.unidade ?? null, quantidade: d.quantidade, quantidadeMinima: d.quantidadeMinima };
    db.estoque.push(item);
    return HttpResponse.json(item);
  }),

  http.get(url('/estoque/vinculos'), ({ request }) => {
    if (!autenticado(request)) return naoAutorizado();
    const servicoId = Number(new URL(request.url).searchParams.get('servicoId'));
    return HttpResponse.json(db.vinculos.filter((v) => v.servicoId === servicoId));
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

  http.get(url('/usuarios'), ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel !== 'ADMIN') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    return HttpResponse.json(db.usuarios.map(semSenha));
  }),

  http.post(url('/usuarios'), async ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel !== 'ADMIN') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const d = (await request.json()) as NovoUsuarioRequest;
    if (db.usuarios.some((x) => x.email === d.email)) { // backend: findByEmail exato (diferencia maiúsculas) e só `mensagem`
      return HttpResponse.json({ mensagem: `Já existe um usuário com o e-mail ${d.email}` }, { status: 400 });
    }
    const novo = { id: Math.max(0, ...db.usuarios.map((x) => x.id)) + 1, nome: d.nome, email: d.email, papel: d.papel, ativo: true, senha: d.senha };
    db.usuarios.push(novo);
    return HttpResponse.json(semSenha(novo), { status: 201 });
  }),

  http.put(url('/usuarios/:id'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel !== 'ADMIN') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const alvo = db.usuarios.find((x) => x.id === Number(params.id));
    if (!alvo) return naoEncontradoMock('Usuário', params.id);
    const d = (await request.json()) as AtualizarUsuarioRequest;
    if (db.usuarios.some((x) => x.id !== alvo.id && x.email === d.email)) {
      return HttpResponse.json({ mensagem: `Já existe um usuário com o e-mail ${d.email}` }, { status: 400 });
    }
    Object.assign(alvo, d); // a senha não muda pelo PUT
    return HttpResponse.json(semSenha(alvo));
  }),

  http.patch(url('/usuarios/:id/senha'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel !== 'ADMIN') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const alvo = db.usuarios.find((x) => x.id === Number(params.id));
    if (!alvo) return naoEncontradoMock('Usuário', params.id);
    const { novaSenha } = (await request.json()) as { novaSenha?: string };
    if (!novaSenha?.trim()) return HttpResponse.json({ mensagem: 'Informe a nova senha.' }, { status: 400 });
    alvo.senha = novaSenha;
    return HttpResponse.json(semSenha(alvo));
  }),

  http.patch(url('/usuarios/:id/status'), async ({ request, params }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel !== 'ADMIN') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const alvo = db.usuarios.find((x) => x.id === Number(params.id));
    if (!alvo) return naoEncontradoMock('Usuário', params.id);
    alvo.ativo = ((await request.json()) as { ativo: boolean }).ativo;
    return HttpResponse.json(semSenha(alvo));
  }),

  http.get(url('/dashboard/resumo'), ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const hoje = dia(new Date().toISOString());
    const porStatus: Record<StatusPedido, number> = { RECEBIDO: 0, EM_PROCESSAMENTO: 0, PLACA_PRONTA: 0, ENTREGUE: 0, CANCELADO: 0 };
    db.pedidos.forEach((p) => { porStatus[p.status] += 1; });
    const corpo: ResumoDashboard = {
      pedidosHoje: db.pedidos.filter((p) => dia(p.criadoEm) === hoje).length,
      pedidosPorStatus: porStatus,
      faturamentoHojeCentavos: db.pagamentos.filter((p) => p.status === 'PAGO' && dia(p.pagoEm) === hoje).reduce((t, p) => t + p.valorCentavos, 0),
      itensBaixoEstoque: db.estoque.filter((i) => i.quantidade <= i.quantidadeMinima).length,
    };
    return HttpResponse.json(corpo);
  }),

  http.get(url('/dashboard/faturamento'), ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const q = new URL(request.url).searchParams;
    const de = q.get('de') ?? '0000-00-00';
    const ate = q.get('ate') ?? '9999-99-99';
    const porDia = new Map<string, number>(); // só dias com pagamento (o front completa os dias sem faturamento)
    db.pagamentos.filter((p) => p.status === 'PAGO' && dia(p.pagoEm) >= de && dia(p.pagoEm) <= ate)
      .forEach((p) => porDia.set(dia(p.pagoEm), (porDia.get(dia(p.pagoEm)) ?? 0) + p.valorCentavos));
    const lista = [...porDia].sort(([a], [b]) => a.localeCompare(b)).map(([data, totalCentavos]) => ({ data, totalCentavos }));
    const corpo: FaturamentoResponse = { de, ate, totalCentavos: lista.reduce((t, d) => t + d.totalCentavos, 0), porDia: lista };
    return HttpResponse.json(corpo);
  }),

  http.get(url('/dashboard/servicos-mais-vendidos'), ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const mapa = new Map<number, ServicoMaisVendido>();
    db.pedidos.filter((p) => p.status !== 'CANCELADO').forEach((p) => {
      const a = mapa.get(p.servico.id) ?? { servicoId: p.servico.id, servicoNome: p.servico.nome, quantidadePedidos: 0, faturamentoNominalCentavos: 0 };
      a.quantidadePedidos += 1;
      a.faturamentoNominalCentavos += p.servico.precoCentavos; // preço ATUAL do serviço, como o backend
      mapa.set(p.servico.id, a);
    });
    return HttpResponse.json([...mapa.values()].sort((a, b) => b.quantidadePedidos - a.quantidadePedidos));
  }),

  http.get(url('/dashboard/tempo-medio-producao'), ({ request }) => {
    const u = autenticado(request);
    if (!u) return naoAutorizado();
    if (u.papel === 'ATENDENTE') return HttpResponse.json({ mensagem: 'Acesso negado' }, { status: 403 });
    const duracoes: number[] = [];
    db.pedidos.forEach((p) => {
      const h = db.historico.filter((x) => x.pedidoId === p.id);
      const ini = h.find((x) => x.statusNovo === 'RECEBIDO');
      const fim = h.find((x) => x.statusNovo === 'PLACA_PRONTA');
      if (ini && fim) duracoes.push((new Date(fim.alteradoEm).getTime() - new Date(ini.alteradoEm).getTime()) / 3_600_000);
    });
    const corpo: TempoMedioProducao = {
      horasMedia: duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : 0,
      pedidosConsiderados: duracoes.length,
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
    .map((p) => { // sem ordenação, como o backend (o front ordena)
      const ped = db.pedidos.find((x) => x.id === p.pedidoId)!;
      return {
        id: p.id, pedidoId: p.pedidoId, placa: ped.veiculo.placa, clienteNome: ped.cliente.nome, servicoNome: ped.servico.nome,
        formaPagamento: p.formaPagamento, valorCentavos: p.valorCentavos, pagoEm: p.pagoEm, registradoPor: p.registradoPor,
      };
    });
}

function semSenha({ senha: _senha, ...u }: Usuario & { senha: string }): Usuario {
  return u;
}

