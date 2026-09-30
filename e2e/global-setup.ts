import { API, ADMIN } from './helpers';

/** Recusa rodar sem confirmação explícita e confere se a API responde com o usuário de teste. */
export default async function globalSetup() {
  if (process.env.E2E_CONFIRM !== '1') {
    throw new Error(
      'Os testes e2e CRIAM dados (clientes, veículos, pedidos, usuários…) no banco da API em ' + API + '.\n' +
      'Use um banco de teste e rode com E2E_CONFIRM=1 (ex.: E2E_CONFIRM=1 npm run e2e).',
    );
  }
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN.email, senha: ADMIN.senha }),
  }).catch(() => null);
  if (!r) throw new Error(`API fora do ar em ${API}. Suba a API antes (ou ajuste E2E_API_URL).`);
  if (!r.ok) throw new Error(`Login do usuário de teste falhou (${r.status}). Ajuste E2E_USER / E2E_PASSWORD.`);
}
