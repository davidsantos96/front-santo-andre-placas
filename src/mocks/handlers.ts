import { http, HttpResponse } from 'msw';
import type { LoginRequest, LoginResponse, Paginado, Pedido } from '@/api/types';
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
];
