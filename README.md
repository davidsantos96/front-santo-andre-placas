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

## Protótipo de referência

O protótipo HTML navegável está em [`prototipo/`](prototipo/) (abrir `prototipo/index.html`). É a fonte da verdade visual; não é código de produção.

## Estrutura

Ver a spec de implementação: `src/api`, `src/auth`, `src/components`, `src/features/*`, `src/layouts`, `src/lib`, `src/mocks`.
