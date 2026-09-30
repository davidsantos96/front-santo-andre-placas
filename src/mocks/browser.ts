import { setupWorker } from 'msw/browser';
import { api } from '@/api/client';
import { handlers, expirarSessoes } from './handlers';

export const worker = setupWorker(...handlers);

// Ajuda de revisão no dev: no console, `__expirarSessao()` faz o servidor esquecer o token e dispara uma
// requisição (a API responde 401), o que abre o modal de re-login sobre a tela atual.
(window as unknown as { __expirarSessao: () => void }).__expirarSessao = () => {
  expirarSessoes();
  void api.get('/estoque/itens/baixo-estoque').catch(() => {});
};
