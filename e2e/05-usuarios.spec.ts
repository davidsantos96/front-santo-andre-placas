import { expect, test } from '@playwright/test';
import { ADMIN, RUN, aviso, chamar, criarUsuario, entrar, tokenAdmin } from './helpers';

test.describe.configure({ mode: 'serial' });

let token: string;
const email = `novo.${RUN}@e2e.test`;
const outro = { nome: `Fulano ${RUN}`, email: `fulano.${RUN}@e2e.test` };

test.beforeAll(async () => {
  token = await tokenAdmin();
  await criarUsuario(token, outro.nome, outro.email, 'ATENDENTE');
});

test('Criar usuário (validações, senha provisória) e e-mail duplicado volta como mensagem da API', async ({ page }) => {
  await entrar(page, undefined, undefined, '/usuarios');
  await page.getByRole('button', { name: '+ Novo usuário' }).click();
  const m = page.getByRole('dialog', { name: 'Novo usuário' });
  await m.getByRole('button', { name: 'Salvar' }).click();
  for (const erro of ['Informe o nome', 'Informe o e-mail', 'Escolha o papel', /ao menos 6 caracteres/]) await expect(m.getByText(erro)).toBeVisible();

  await m.getByLabel('Nome').fill(`Novo ${RUN}`);
  await m.getByLabel('E-mail').fill(email);
  await m.getByLabel('Papel').selectOption('GERENTE');
  await m.getByLabel('Senha provisória').fill('senha123');
  await m.getByRole('button', { name: 'Salvar' }).click();
  await expect(aviso(page, `Usuário Novo ${RUN} criado`)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: email })).toContainText('Gerente');

  await page.getByRole('button', { name: '+ Novo usuário' }).click();
  const d = page.getByRole('dialog', { name: 'Novo usuário' });
  await d.getByLabel('Nome').fill('Duplicado');
  await d.getByLabel('E-mail').fill(email);
  await d.getByLabel('Papel').selectOption('ATENDENTE');
  await d.getByLabel('Senha provisória').fill('senha123');
  await d.getByRole('button', { name: 'Salvar' }).click();
  await expect(d.getByRole('alert')).toContainText(`Já existe um usuário com o e-mail ${email}`);
  await d.getByRole('button', { name: 'Cancelar' }).click();
});

test('Editar: o próprio papel fica bloqueado; o de outro usuário muda', async ({ page }) => {
  await entrar(page, undefined, undefined, '/usuarios');
  const meu = page.getByRole('row').filter({ hasText: ADMIN.email });
  await meu.getByRole('button', { name: /^Editar / }).click();
  const m = page.getByRole('dialog', { name: 'Editar usuário' });
  await expect(m.getByLabel(/^Papel/)).toBeDisabled();
  await expect(m.getByText('Você não pode alterar o próprio papel.')).toBeVisible();
  await m.getByRole('button', { name: 'Cancelar' }).click();
  await expect(meu.getByRole('button', { name: /^Desativar / })).toBeDisabled(); // nem se desativa

  await page.getByRole('button', { name: `Editar ${outro.nome}` }).click();
  const e = page.getByRole('dialog', { name: 'Editar usuário' });
  await expect(e.getByLabel(/^Papel/)).toBeEnabled();
  await e.getByLabel(/^Papel/).selectOption('GERENTE');
  await e.getByRole('button', { name: 'Salvar' }).click();
  await expect(aviso(page, 'Usuário atualizado')).toBeVisible();
  const usuarios = (await chamar('/usuarios', { token })).corpo as { email: string; papel: string }[];
  expect(usuarios.find((u) => u.email === outro.email)!.papel).toBe('GERENTE');
});

test('Redefinir senha pelo admin: a senha antiga deixa de valer e a nova funciona', async ({ page }) => {
  await entrar(page, undefined, undefined, '/usuarios');
  await page.getByRole('button', { name: `Redefinir senha de ${outro.nome}` }).click();
  const m = page.getByRole('dialog', { name: 'Redefinir senha' });
  await m.getByLabel('Nova senha provisória').fill('123');
  await m.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(m.getByText(/ao menos 6 caracteres/)).toBeVisible();
  await m.getByLabel('Nova senha provisória').fill('nova-senha-456');
  await m.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(aviso(page, `Senha de ${outro.nome} redefinida`)).toBeVisible();

  expect((await chamar('/auth/login', { method: 'POST', body: { email: outro.email, senha: 'senha123' } })).status).toBe(400);
  expect((await chamar('/auth/login', { method: 'POST', body: { email: outro.email, senha: 'nova-senha-456' } })).status).toBe(200);
});

test('Desativar (com confirmação) e reativar', async ({ page }) => {
  await entrar(page, undefined, undefined, '/usuarios');
  await page.getByRole('button', { name: `Desativar ${outro.nome}` }).click();
  const c = page.getByRole('dialog', { name: `Desativar ${outro.nome}?` });
  await expect(c.getByRole('button', { name: 'Voltar' })).toBeFocused(); // ação perigosa: foco no cancelar
  await c.getByRole('button', { name: 'Desativar' }).click();
  await expect(aviso(page, `${outro.nome} desativado`)).toBeVisible();
  const linha = page.getByRole('row').filter({ hasText: outro.email });
  await expect(linha).toContainText('Inativo');
  expect((await chamar('/auth/login', { method: 'POST', body: { email: outro.email, senha: 'nova-senha-456' } })).status).toBe(400); // "Usuário inativo"

  await linha.getByRole('button', { name: `Reativar ${outro.nome}` }).click();
  await expect(aviso(page, `${outro.nome} reativado`)).toBeVisible();
  await expect(linha).toContainText('Ativo');
});

test('F1 · Último acesso: "Nunca acessou" até o primeiro login, depois "Hoje · hh:mm" (registrado pela API)', async ({ page }) => {
  const u = await criarUsuario(token, `Acesso ${RUN}`, `acesso.${RUN}@e2e.test`, 'ATENDENTE');
  await entrar(page, undefined, undefined, '/usuarios');
  const linha = page.getByRole('row').filter({ hasText: u.email });
  await expect(linha).toContainText('Nunca acessou');
  await chamar('/auth/login', { method: 'POST', body: { email: u.email, senha: 'senha123' } });
  const doApi = ((await chamar('/usuarios', { token })).corpo as { email: string; ultimoAcessoEm: string | null }[]).find((x) => x.email === u.email)!;
  expect(doApi.ultimoAcessoEm).not.toBeNull();
  await page.reload(); // token só em memória: volta ao login
  await entrar(page, undefined, undefined, '/usuarios');
  await expect(page.getByRole('row').filter({ hasText: u.email })).toContainText(/Hoje · \d{2}:\d{2}/);
});
