/**
 * Nome de quem fez a ação. `...Por` é um snapshot gravado na hora (renomear o usuário depois NÃO muda o histórico —
 * por isso nunca se resolve o nome pelo id). Registros criados fora de uma requisição (seed) vêm com `null` ou "sistema".
 */
export const nomeAutor = (nome?: string | null): string => (!nome || nome.trim().toLowerCase() === 'sistema' ? 'Sistema' : nome);
