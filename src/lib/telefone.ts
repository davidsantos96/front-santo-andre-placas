import { somenteDigitos } from './documento';

/** "11988771234" → "(11) 98877-1234" (fixo: "(11) 3877-1234"). */
export function mascararTelefone(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const telefoneValido = (valor: string): boolean => {
  const n = somenteDigitos(valor).length;
  return n === 10 || n === 11;
};
