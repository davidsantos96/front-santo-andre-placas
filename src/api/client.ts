import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from './types';
import { aguardarRelogin } from './sessaoEventos';

let accessToken: string | null = null;
/** Token só em memória (spec §4.1). */
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;

/** `exp` (segundos) do JWT, ou null se o token não for um JWT legível. */
function expDoToken(token: string): number | null {
  try {
    const corpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(corpo)) as { exp?: number };
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/** Sem token, ou com o `exp` do JWT no passado. Token ilegível não conta como expirado. */
export function tokenExpirado(agora = Date.now()): boolean {
  if (!accessToken) return true;
  const exp = expDoToken(accessToken);
  return exp !== null && exp * 1000 <= agora;
}

/**
 * A API (Spring Security sem `authenticationEntryPoint`) responde **403** — não 401 — quando o token
 * está ausente ou expirado. Só o status não distingue "sem permissão" de "sessão expirada", então
 * o 403 conta como expiração apenas quando o token local já expirou (ou não existe).
 */
export const sessaoExpirou = (status: number | undefined): boolean =>
  status === 401 || (status === 403 && tokenExpirado());

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api' });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

type Retentavel = InternalAxiosRequestConfig & { _retentado?: boolean };

export function normalizarErro(e: unknown): ApiError {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status ?? 0;
    const corpo = e.response?.data as
      | { message?: string; mensagem?: string; erro?: string; campos?: Record<string, string>; errors?: Record<string, string> }
      | undefined;
    const mensagem =
      corpo?.mensagem ?? corpo?.message ?? corpo?.erro ??
      (status === 0 ? 'Sem conexão com o servidor.' : `Erro ${status}`);
    return { status, mensagem, campos: corpo?.campos ?? corpo?.errors };
  }
  if (e && typeof e === 'object' && 'status' in e && 'mensagem' in e) return e as ApiError;
  return { status: 0, mensagem: e instanceof Error ? e.message : 'Erro inesperado' };
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const cfg = err.config as Retentavel | undefined;
    const ehLogin = cfg?.url?.includes('/auth/login');
    if (sessaoExpirou(err.response?.status) && cfg && !ehLogin && !cfg._retentado) {
      try {
        await aguardarRelogin();
      } catch (e) {
        return Promise.reject(normalizarErro(e));
      }
      cfg._retentado = true;
      if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
      return api.request(cfg);
    }
    return Promise.reject(normalizarErro(err));
  },
);
