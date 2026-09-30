import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ApiError } from '@/api/types';

/** Erros de campo vindos do backend (`campos`) alimentam o `setError` do RHF. Retorna true se aplicou algum. */
export function aplicarErrosDeCampos<T extends FieldValues>(e: ApiError, setError: UseFormSetError<T>): boolean {
  const entradas = Object.entries(e.campos ?? {});
  entradas.forEach(([campo, message]) => setError(campo as Path<T>, { type: 'server', message }));
  return entradas.length > 0;
}

/**
 * "Não encontrado": o backend lança `IllegalArgumentException("... não encontrado: id")`, que vira **400**
 * (não 404). Aceita os dois para continuar certo se o backend passar a responder 404.
 */
export const naoEncontrado = (e: unknown): boolean => {
  const { status, mensagem } = (e ?? {}) as Partial<ApiError>;
  return status === 404 || (status === 400 && /não encontrad/i.test(mensagem ?? ''));
};

/**
 * Mensagem do login. A API responde 400 "Email ou senha inválidos" (credencial) ou 400 "Usuário inativo…";
 * mostramos o texto do servidor só para o inativo e uma frase padrão para credencial errada.
 */
export function mensagemDeLogin(e: unknown): string {
  const { status, mensagem } = (e ?? {}) as Partial<ApiError>;
  if (status === 400 && /inativo/i.test(mensagem ?? '')) return mensagem!;
  if (status === 400 || status === 401 || status === 403) return 'E-mail ou senha incorretos';
  return mensagem ?? 'Não foi possível entrar';
}
