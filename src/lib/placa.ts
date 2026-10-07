/** Remove hífen/espaço/símbolos e põe em maiúsculas: "abc-1d23" → "ABC1D23". */
export const normalizarPlaca = (s: string): string =>
  s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);

// Antigo (ABC1234) ou Mercosul (ABC1D23).
const RE_PLACA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

export const placaValida = (s: string): boolean => RE_PLACA.test(normalizarPlaca(s));
