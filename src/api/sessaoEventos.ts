/**
 * Ponte entre o cliente HTTP (que detecta 401) e a UI (modal de re-login).
 * Sem refresh token: expirou = re-login completo; a requisição que falhou
 * espera o login e é refeita.
 */
export const EVENTO_SESSAO_EXPIRADA = 'sessao-expirada';

type Espera = { resolve: () => void; reject: (e: unknown) => void };
let esperas: Espera[] = [];

/** Chamado pelo interceptor: dispara o evento (uma vez) e aguarda o re-login. */
export function aguardarRelogin(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const primeira = esperas.length === 0;
    esperas.push({ resolve, reject });
    if (primeira) window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
  });
}

/** Login refeito com sucesso: refaz as requisições pendentes. */
export function reloginConcluido(): void {
  const l = esperas;
  esperas = [];
  l.forEach((e) => e.resolve());
}

/** Usuário saiu sem re-logar: rejeita as pendentes. */
export function reloginCancelado(): void {
  const l = esperas;
  esperas = [];
  l.forEach((e) => e.reject({ status: 401, mensagem: 'Sessão expirada' }));
}

export const haReloginPendente = (): boolean => esperas.length > 0;
