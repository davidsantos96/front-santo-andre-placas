import { criarBanco, type Banco } from './fixtures';

/** Banco em memória do MSW. Mutável durante a sessão; `resetarBanco` volta às fixtures. */
export let db: Banco = criarBanco();
export const resetarBanco = () => { db = criarBanco(); };
