const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos → "R$ 1.234,56". */
export const fmt = (centavos: number): string => brl.format(centavos / 100);

/** "1.234,56" (ou "R$ 1.234,56") → 123456 centavos. Nunca trafegar float. */
export const reaisParaCentavos = (s: string): number => {
  const limpo = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Apenas dígitos → centavos (usado pelo MoneyInput). */
export const digitosParaCentavos = (s: string): number => {
  const d = s.replace(/\D/g, '');
  return d ? Number(d) : 0;
};
