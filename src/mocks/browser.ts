import { setupWorker } from 'msw/browser';
import { api, setAccessToken } from '@/api/client';
import { jwtExpirado } from './jwt';
import { handlers, expirarSessoes } from './handlers';

export const worker = setupWorker(...handlers);

// Ajuda de revisão no dev: no console, `__expirarSessao()` troca o token por um JWT já expirado e faz uma
// requisição (a API real responde 403), o que abre o modal de re-login sobre a tela atual.
(window as unknown as { __expirarSessao: () => void }).__expirarSessao = () => {
  expirarSessoes();
  setAccessToken(jwtExpirado());
  void api.get('/estoque/itens/baixo-estoque').catch(() => {});
};
