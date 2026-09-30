/** JWT de mentira (só o payload importa ao front): `exp` em segundos. */
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const gerarJwt = (email: string, papel: string, expMs = Date.now() + 8 * 3_600_000): string =>
  `${b64({ alg: 'HS256' })}.${b64({ sub: email, papel, exp: Math.floor(expMs / 1000) })}.assinatura`;

/** Token já expirado (para simular o fim das 8h). */
export const jwtExpirado = (email = 'x@x', papel = 'ATENDENTE') => gerarJwt(email, papel, Date.now() - 60_000);
