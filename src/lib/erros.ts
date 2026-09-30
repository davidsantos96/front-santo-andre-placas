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
