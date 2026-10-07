# Painel Santo André Placas (front)

Painel interno de gestão de emplacamento Mercosul. Vite + React 18 + TypeScript (strict), React Router 6, TanStack Query, RHF + Zod, Tailwind, Radix.

## Rodando

```bash
npm install
cp .env.example .env   # VITE_API_URL e VITE_USE_MOCKS
npm run dev            # http://localhost:5173
npm test               # Vitest
npm run build
```

Com `VITE_USE_MOCKS=true` o app usa MSW (dados fictícios em `src/mocks/`); com `false` chama a API em `VITE_API_URL`.

## Testando contra a API real (sem mock)

1. Suba a API (`api-santo-andre-placas`) em `http://localhost:8080` e garanta um usuário ativo no banco (não há seed).
2. Crie um `.env.local` (ignorado pelo git) com:
   ```
   VITE_USE_MOCKS=false
   VITE_API_URL=http://localhost:8080/api
   ```
3. `npm run dev` e abra `http://localhost:5173` — a porta precisa ser essa, o CORS da API só libera `localhost:5173`/`127.0.0.1:5173`.
4. O token fica só em memória: recarregar a página volta ao login.

O que ainda diverge do esperado no backend está em [`PENDENCIAS.md`](PENDENCIAS.md) (seção "Verificação contra a API real").

## Testes e2e (Playwright, contra a API real)

Os roteiros em `e2e/` usam a API de verdade e **gravam dados** (clientes, pedidos, usuários com sufixo único por execução). Use um banco de teste.

1. Suba a API em `http://localhost:8080` com um usuário ADMIN ativo.
2. `npm run e2e:install` (baixa o Chromium; em ambientes com Chromium já instalado, use `E2E_CHROMIUM_PATH`).
3. `E2E_CONFIRM=1 npm run e2e` — o Playwright sobe o Vite sozinho (mocks desligados, porta 5173).

`07-rastreabilidade.spec.ts` cobre autoria, snapshot de preço, movimentações de estoque e o histórico (auditoria). A pasta inclui `06-acessibilidade.spec.ts`: axe-core (WCAG 2.1 A/AA, com contraste) em todas as rotas, modais e no mobile, mais testes de teclado e `prefers-reduced-motion`.

Variáveis: `E2E_CONFIRM` (obrigatória), `E2E_API_URL` (padrão `http://localhost:8080/api`), `E2E_WEB_URL`, `E2E_USER`/`E2E_PASSWORD` (padrão `admin@santoandreplacas.com.br` / `admin123`), `E2E_CHROMIUM_PATH`. Tipos: `npm run e2e:typecheck`.

## Protótipo de referência

O protótipo HTML navegável está em [`prototipo/`](prototipo/) (abrir `prototipo/index.html`). É a fonte da verdade visual; não é código de produção.

## Estrutura

Ver a spec de implementação: `src/api`, `src/auth`, `src/components`, `src/features/*`, `src/layouts`, `src/lib`, `src/mocks`.
