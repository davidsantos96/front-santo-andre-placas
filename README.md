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

## Protótipo de referência

O protótipo HTML navegável está em [`prototipo/`](prototipo/) (abrir `prototipo/index.html`). É a fonte da verdade visual; não é código de produção.

## Estrutura

Ver a spec de implementação: `src/api`, `src/auth`, `src/components`, `src/features/*`, `src/layouts`, `src/lib`, `src/mocks`.
