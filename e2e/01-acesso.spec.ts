import { expect, test } from '@playwright/test';
import { ADMIN, RUN, chamar, criarUsuario, entrar, irPara, tokenAdmin } from './helpers';

test.describe.configure({ mode: 'serial' });

const gerente = { nome: `Gerente ${RUN}`, login: `gerente.${RUN}`, senha: 'senha123' };
const atendente = { nome: `Atendente ${RUN}`, login: `atendente.${RUN}`, senha: 'senha123' };
const inativo = { nome: `Inativo ${RUN}`, login: `inativo.${RUN}`, senha: 'senha123' };
let token: string;
let idInativo: number;

test.beforeAll(async () => {
  token = await tokenAdmin();
  await criarUsuario(token, gerente.nome, gerente.login, 'GERENTE');
  await criarUsuario(token, atendente.nome, atendente.login, 'ATENDENTE');
  idInativo = (await criarUsuario(token, inativo.nome, inativo.login, 'ATENDENTE')).id;
});

test('login com senha errada mostra erro inline (a API responde 400)', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuário ou e-mail').fill(ADMIN.login);
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Usuário ou senha incorretos' })).toBeVisible();
});

test('ADMIN entra no dashboard, vê todos os módulos e sai', async ({ page }) => {
  await entrar(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  const menu = page.getByRole('navigation', { name: 'Navegação principal' });
  for (const m of ['Dashboard', 'Pedidos', 'Clientes', 'Veículos', 'Serviços', 'Estoque', 'Financeiro', 'Usuários']) {
    await expect(menu.getByRole('link', { name: new RegExp(m) })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('ATENDENTE: menu reduzido e rotas protegidas redirecionam para /pedidos', async ({ page }) => {
  await entrar(page, atendente.login, atendente.senha, '/pedidos');
  const menu = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(menu.getByRole('link', { name: /Pedidos/ })).toBeVisible();
  for (const m of ['Dashboard', 'Serviços', 'Financeiro', 'Usuários']) await expect(menu.getByRole('link', { name: new RegExp(m) })).toHaveCount(0);
  for (const rota of ['/dashboard', '/financeiro', '/servicos', '/usuarios']) {
    await irPara(page, rota);
    await expect(page).toHaveURL(/\/pedidos$/);
  }
});

test('GERENTE vê Financeiro e Serviços, mas não Usuários', async ({ page }) => {
  await entrar(page, gerente.login, gerente.senha);
  const menu = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(menu.getByRole('link', { name: /Financeiro/ })).toBeVisible();
  await expect(menu.getByRole('link', { name: /Usuários/ })).toHaveCount(0);
  await irPara(page, '/usuarios');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('sem token a API responde 401', async () => {
  expect((await chamar('/pedidos')).status).toBe(401);
});

// B16 (corrigido no backend): negação de @PreAuthorize responde 403, não 401 — o front não pode deslogar o usuário.
test('falta de permissão responde 403 (não 401)', async () => {
  const t = (await chamar<{ token: string }>('/auth/login', { method: 'POST', body: { login: atendente.login, senha: atendente.senha } })).corpo.token;
  expect((await chamar('/usuarios', { token: t })).status).toBe(403); // ATENDENTE não lista usuários
});

test('usuário desativado com a sessão aberta: 401 → modal → mensagem de inativo; login direto também recusa', async ({ page }) => {
  await entrar(page, inativo.login, inativo.senha, '/pedidos');
  await expect(page.locator('[data-coluna=RECEBIDO]')).toBeVisible();

  await chamar(`/usuarios/${idInativo}/status`, { method: 'PATCH', token, body: { ativo: false } });
  await page.getByRole('navigation').getByRole('link', { name: /Clientes/ }).click();

  const modal = page.getByRole('dialog', { name: 'Sessão expirada' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Senha').fill(inativo.senha);
  await modal.getByRole('button', { name: 'Entrar' }).click();
  await expect(modal.getByRole('alert')).toHaveText('Usuário inativo. Contate um administrador.');
  await modal.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Usuário ou e-mail').fill(inativo.login);
  await page.getByLabel('Senha').fill(inativo.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert').first()).toHaveText('Usuário inativo. Contate um administrador.');
});

test('re-login depois de sessão expirada refaz a requisição sem recarregar', async ({ page }) => {
  // Reativa e deixa o usuário com a sessão aberta; o admin troca a senha → o token antigo continua válido,
  // então a expiração é simulada desativando e reativando: a 1ª chamada falha com 401 e o re-login recupera.
  await chamar(`/usuarios/${idInativo}/status`, { method: 'PATCH', token, body: { ativo: true } });
  await entrar(page, inativo.login, inativo.senha, '/pedidos');
  await expect(page.locator('[data-coluna=RECEBIDO]')).toBeVisible();
  await chamar(`/usuarios/${idInativo}/status`, { method: 'PATCH', token, body: { ativo: false } });
  await page.getByRole('navigation').getByRole('link', { name: /Clientes/ }).click();
  const modal = page.getByRole('dialog', { name: 'Sessão expirada' });
  await expect(modal).toBeVisible();
  await chamar(`/usuarios/${idInativo}/status`, { method: 'PATCH', token, body: { ativo: true } }); // admin reativa
  await modal.getByLabel('Senha').fill(inativo.senha);
  await modal.getByRole('button', { name: 'Entrar' }).click();
  await expect(modal).toBeHidden();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
});
