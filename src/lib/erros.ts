import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ApiError } from '@/api/types';

/** Erros de campo vindos do backend (`campos`) alimentam o `setError` do RHF. Retorna true se aplicou algum. */
export function aplicarErrosDeCampos<T extends FieldValues>(e: ApiError, setError: UseFormSetError<T>): boolean {
  const entradas = Object.entries(e.campos ?? {});
  entradas.forEach(([campo, message]) => setError(campo as Path<T>, { type: 'server', message }));
  return entradas.length > 0;
}
