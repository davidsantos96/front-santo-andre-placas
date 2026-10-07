export type Papel = 'ATENDENTE' | 'GERENTE' | 'ADMIN';
export const RANK: Record<Papel, number> = { ATENDENTE: 0, GERENTE: 1, ADMIN: 2 };
export const pode = (p: Papel, min: Papel): boolean => RANK[p] >= RANK[min];

/** Tela inicial de cada papel. */
export const telaInicial = (p: Papel): string => (pode(p, 'GERENTE') ? '/dashboard' : '/pedidos');
