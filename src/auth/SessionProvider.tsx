import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { EVENTO_SESSAO_EXPIRADA, reloginCancelado, reloginConcluido } from '@/api/sessaoEventos';
import type { LoginRequest, LoginResponse } from '@/api/types';
import type { Papel } from './papeis';

export type Usuario = { nome: string; papel: Papel; email: string };

type Sessao = {
  usuario: Usuario | null;
  /** true enquanto o modal de re-login está aberto sobre a tela atual. */
  sessaoExpirada: boolean;
  login: (dados: LoginRequest) => Promise<Usuario>;
  logout: () => void;
};

const Ctx = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSessao fora do SessionProvider');
  return c;
}

/** Papel do usuário logado; só chamar em rotas protegidas. */
export function usePapel(): Papel {
  const { usuario } = useSessao();
  if (!usuario) throw new Error('Sem sessão');
  return usuario.papel;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  useEffect(() => {
    const abrir = () => setSessaoExpirada(true);
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, abrir);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, abrir);
  }, []);

  const login = useCallback(async ({ email, senha }: LoginRequest) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, senha });
    setAccessToken(data.token);
    const u: Usuario = { nome: data.nome, papel: data.papel, email };
    setUsuario(u);
    if (sessaoExpirada) {
      setSessaoExpirada(false);
      reloginConcluido();
    }
    return u;
  }, [sessaoExpirada]);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUsuario(null);
    setSessaoExpirada(false);
    reloginCancelado();
    queryClient.clear();
  }, []);

  const valor = useMemo(() => ({ usuario, sessaoExpirada, login, logout }), [usuario, sessaoExpirada, login, logout]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
