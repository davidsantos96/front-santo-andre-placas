import { defineConfig } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:8080/api';
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:5173';

/**
 * Testes de ponta a ponta contra a **API real** (sem mock). Veja o README ("Testes e2e").
 * A API precisa estar no ar e `E2E_CONFIRM=1` precisa estar definido (os testes gravam dados no banco).
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: WEB,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  // Sobe o front sem mock apontando para a API (a porta precisa ser 5173 por causa do CORS da API).
  webServer: process.env.E2E_WEB_URL
    ? undefined
    : { command: 'npx vite --port 5173 --strictPort', url: WEB, reuseExistingServer: true, env: { VITE_USE_MOCKS: 'false', VITE_API_URL: API } },
});
