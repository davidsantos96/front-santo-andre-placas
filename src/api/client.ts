import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from './types';
import { aguardarRelogin } from './sessaoEventos';

let accessToken: string | null = null;
/** Token só em memória (spec §4.1). */
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;


export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api' });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

type Retentavel = InternalAxiosRequestConfig & { _retentado?: boolean };

/** Texto padrão (em português) quando a API não manda `mensagem` — ex.: 500 ou o "Bad Request" genérico do Spring. */
export function mensagemPadrao(status: number): string {
  if (status === 0) return 'Sem conexão com o servidor. Verifique a rede e tente novamente.';
  if (status === 401) return 'Sessão expirada. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Não encontrado.';
  if (status >= 500) return 'Erro no servidor. Tente novamente em instantes.';
  return 'Não foi possível concluir a operação. Confira os dados e tente novamente.';
}

export function normalizarErro(e: unknown): ApiError {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status ?? 0;
    const corpo = e.response?.data as
      | { message?: string; mensagem?: string; campos?: Record<string, string>; errors?: Record<string, string> }
      | undefined;
    // `error` do corpo padrão do Spring ("Bad Request", "Internal Server Error") é ignorado de propósito.
    const mensagem = corpo?.mensagem?.trim() || corpo?.message?.trim() || mensagemPadrao(status);
    return { status, mensagem, campos: corpo?.campos ?? corpo?.errors };
  }
  if (e && typeof e === 'object' && 'status' in e && 'mensagem' in e) return e as ApiError;
  return { status: 0, mensagem: e instanceof Error ? e.message : 'Erro inesperado.' };
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const cfg = err.config as Retentavel | undefined;
    const ehLogin = cfg?.url?.includes('/auth/login');
    // 401 = token ausente/inválido/expirado ou usuário desativado; 403 = sem permissão (não abre o modal).
    if (err.response?.status === 401 && cfg && !ehLogin && !cfg._retentado) {
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
