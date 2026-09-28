import { http, HttpResponse } from 'msw';
import type { LoginRequest, LoginResponse } from '@/api/types';
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

export const handlers = [
  http.post(url('/auth/login'), async ({ request }) => {
    const { email, senha } = (await request.json()) as LoginRequest;
    const u = db.usuarios.find((x) => x.email === email && x.senha === senha && x.ativo);
    if (!u) return HttpResponse.json({ mensagem: 'Credenciais inválidas' }, { status: 401 });
    const token = `mock-${u.id}-${++seq}`;
    db.tokens.set(token, u.papel);
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
];
