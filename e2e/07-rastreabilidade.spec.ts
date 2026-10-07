import { expect, test } from '@playwright/test';
import { RUN, aviso, chamar, criarClienteComVeiculo, criarPedido, criarServico, criarUsuario, entrar, tokenAdmin, tokenDe } from './helpers';

/** Rastreabilidade (autoria, snapshot de preço, movimentações e auditoria) contra a API real. */
test.describe.configure({ mode: 'serial' });

let token: string;
const hojeBR = () => new Date().toLocaleDateString('pt-BR');
/** "2026-10-07T16:43:05.8" → "07/10/2026 16:43" (por texto: o servidor já manda hora de São Paulo, sem fuso). */
const dataHoraDe = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;

test.beforeAll(async () => { token = await tokenAdmin(); });

test('Cliente e veículo: "Cadastrado por" vem da API e, depois de editar, aparece "Última alteração por"', async ({ page }) => {
  const nome = `Rastro ${RUN}`;
  const { cliente, veiculo } = await criarClienteComVeiculo(token, nome);
  const doApi = (await chamar(`/clientes/${cliente.id}`, { token })).corpo as { criadoPor: string; criadoPorId: number | null; atualizadoEm: string | null };
  expect(doApi.criadoPor).toBe('Administrador');
  expect(doApi.atualizadoEm).toBeNull(); // nunca editado

  await entrar(page, undefined, undefined, `/clientes/${cliente.id}`);
  await expect(page.getByTestId('autoria')).toHaveText(`Cadastrado por Administrador em ${hojeBR()}`);
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nome').fill(`${nome} (ed)`);
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByTestId('autoria')).toHaveText(`Cadastrado por Administrador em ${hojeBR()} · Última alteração por Administrador em ${hojeBR()}`);
  const depois = (await chamar(`/clientes/${cliente.id}`, { token })).corpo as { atualizadoPor: string | null; atualizadoPorId: number | null };
  expect(depois.atualizadoPor).toBe('Administrador');
  expect(depois.atualizadoPorId).not.toBeNull();

  await page.goto('/login'); // token só em memória
  await entrar(page, undefined, undefined, `/veiculos/${veiculo.id}`);
  await expect(page.getByTestId('autoria')).toHaveText(`Cadastrado por Administrador em ${hojeBR()}`);
});

test('Snapshot de preço: reajustar o serviço depois NÃO deixa o pedido quitado como pendente', async ({ page }) => {
  const s = await criarServico(token, `Srv snapshot ${RUN}`, 30000);
  const { cliente, veiculo, placa } = await criarClienteComVeiculo(token, `Snap ${RUN}`);
  const ped = await criarPedido(token, cliente.id, veiculo.id, s.id);
  await chamar(`/pedidos/${ped.id}/pagamento`, { method: 'POST', token, body: { valorCentavos: 30000, formaPagamento: 'PIX' } });
  await chamar(`/servicos/${s.id}`, { method: 'PUT', token, body: { nome: s.nome, descricao: '', categoria: 'EMPLACAMENTO', precoCentavos: 60000 } });

  const doApi = (await chamar(`/pedidos/${ped.id}`, { token })).corpo as { precoCentavos: number; pago: boolean; servico: { precoCentavos: number } };
  expect(doApi).toMatchObject({ precoCentavos: 30000, pago: true });
  expect(doApi.servico.precoCentavos).toBe(60000); // preço de tabela de hoje ≠ preço cobrado

  await entrar(page, undefined, undefined, '/pedidos');
  await expect(page.locator(`[aria-label^="Pedido ${ped.id},"]`)).not.toContainText('$ pendente');
  await page.goto('/login');
  await entrar(page, undefined, undefined, `/pedidos?visao=tabela&busca=${placa}`);
  const linha = page.locator('tr').filter({ hasText: `Snap ${RUN}` });
  await expect(linha).toContainText('R$ 300,00'); // valor cobrado, não R$ 600,00
  await expect(linha).not.toContainText('600,00');
});

test('Estoque → Movimentações: manual (com autor) e baixa automática com o pedido de origem', async ({ page }) => {
  const item = (await chamar('/estoque/itens', { method: 'POST', token, body: { nome: `Lacre rastro ${RUN}`, sku: `RS-${RUN}`, unidade: 'un', quantidade: 5, quantidadeMinima: 1 } })).corpo;
  const s = await criarServico(token, `Srv baixa ${RUN}`);
  await chamar('/estoque/vinculos', { method: 'POST', token, body: { servicoId: s.id, itemEstoqueId: item.id, quantidadeNecessaria: 2 } });
  const { cliente, veiculo } = await criarClienteComVeiculo(token, `Baixa ${RUN}`);
  const ped = await criarPedido(token, cliente.id, veiculo.id, s.id);
  await chamar(`/pedidos/${ped.id}/status`, { method: 'PATCH', token, body: { novoStatus: 'EM_PROCESSAMENTO' } });

  await entrar(page, undefined, undefined, '/estoque');
  // cadastro do item: coluna "Cadastro" com o autor
  await expect(page.locator('tr').filter({ hasText: item.nome })).toContainText(`Administrador · ${hojeBR()}`);
  // entrada manual pela tela
  await page.getByRole('button', { name: `Movimentar ${item.nome}` }).click();
  const m = page.getByRole('dialog', { name: 'Movimentar estoque' });
  await m.getByLabel('Quantidade').fill('3');
  await m.getByRole('button', { name: 'Registrar' }).click();
  await expect(aviso(page, `Entrada de 3 — ${item.nome}`)).toBeVisible();

  await page.getByRole('tab', { name: 'Movimentações' }).click();
  await expect(page).toHaveURL(/aba=movimentacoes/);
  await page.getByLabel('Item').selectOption({ label: item.nome });
  const linhas = page.locator('tbody tr');
  await expect(linhas).toHaveCount(2);
  // mais recente primeiro: a entrada manual, depois a baixa automática
  await expect(linhas.nth(0)).toContainText('Entrada');
  await expect(linhas.nth(0)).toContainText('+3');
  await expect(linhas.nth(0)).toContainText('Manual');
  await expect(linhas.nth(0)).toContainText('Administrador');
  await expect(linhas.nth(1)).toContainText('Saída');
  await expect(linhas.nth(1)).toContainText('−2');
  await expect(linhas.nth(1)).toContainText(`Baixa automática · Pedido #${ped.id}`);
  const doApi = (await chamar(`/estoque/movimentacoes?itemEstoqueId=${item.id}`, { token })).corpo as { criadoEm: string; tipo: string }[];
  expect(doApi.map((x) => x.tipo)).toEqual(['ENTRADA', 'SAIDA']); // ordem da API: mais recente primeiro
  await expect(linhas.nth(0)).toContainText(dataHoraDe(doApi[0]!.criadoEm)); // mesma hora de São Paulo, sem conversão
  await linhas.nth(1).getByRole('link', { name: `Pedido #${ped.id}` }).click();
  await expect(page).toHaveURL(new RegExp(`/pedidos/${ped.id}$`));
});

test('Serviços → Histórico: evolução do preço e do nome, uma linha por campo; "Só preço" filtra', async ({ page }) => {
  const nome = `Srv hist ${RUN}`;
  const s = await criarServico(token, nome, 30000);
  await chamar(`/servicos/${s.id}`, { method: 'PUT', token, body: { nome: `${nome} b`, descricao: '', categoria: 'EMPLACAMENTO', precoCentavos: 60000 } });
  await chamar(`/servicos/${s.id}`, { method: 'PUT', token, body: { nome: `${nome} b`, descricao: '', categoria: 'EMPLACAMENTO', precoCentavos: 60000 } }); // mesmo valor: não gera linha
  await chamar(`/servicos/${s.id}/status`, { method: 'PATCH', token, body: { ativo: false } });
  const api = (await chamar(`/auditoria?entidade=SERVICO&entidadeId=${s.id}`, { token })).corpo as { acao: string; campo: string | null; valorAnterior: string | null; feitoEm: string }[];
  expect(api.map((r) => `${r.acao}:${r.campo ?? ''}`)).toEqual(['DESATIVACAO:', 'ATUALIZACAO:precoCentavos', 'ATUALIZACAO:nome', 'CRIACAO:']);
  expect(api[1]!.valorAnterior).toBe('30000'); // texto, não número

  await entrar(page, undefined, undefined, '/servicos');
  await page.getByRole('button', { name: `Histórico de ${nome} b` }).click();
  const h = page.getByRole('dialog', { name: new RegExp(`Histórico de ${nome} b`) });
  const itens = h.getByRole('listitem');
  await expect(itens).toHaveCount(4);
  await expect(itens.nth(0)).toContainText('Serviço desativado');
  await expect(itens.nth(1)).toContainText('Preço: R$ 300,00 → R$ 600,00');
  await expect(itens.nth(1)).toContainText(`Administrador · ${dataHoraDe(api[1]!.feitoEm)}`);
  await expect(itens.nth(2)).toContainText(`Nome: ${nome} → ${nome} b`);
  await expect(itens.nth(3)).toContainText('Serviço criado');
  await h.getByRole('radio', { name: 'Só preço' }).click();
  await expect(itens).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: `Histórico de ${nome} b` })).toBeFocused();
});

test('Usuários → Histórico: criação, troca de papel e reset de senha (a senha nunca aparece)', async ({ page }) => {
  const u = await criarUsuario(token, `Hist ${RUN}`, `hist.${RUN}@e2e.test`, 'ATENDENTE');
  await entrar(page, undefined, undefined, '/usuarios');
  await page.getByRole('button', { name: `Editar Hist ${RUN}` }).click();
  const e = page.getByRole('dialog', { name: 'Editar usuário' });
  await e.getByLabel('Papel').selectOption('GERENTE');
  await e.getByRole('button', { name: 'Salvar' }).click();
  await expect(aviso(page, 'Usuário atualizado')).toBeVisible();
  await page.getByRole('button', { name: `Redefinir senha de Hist ${RUN}` }).click();
  const s = page.getByRole('dialog', { name: 'Redefinir senha' });
  await s.getByLabel('Nova senha provisória').fill('segredo-e2e-123');
  await s.getByRole('button', { name: 'Redefinir senha' }).click();
  await expect(aviso(page, `Senha de Hist ${RUN} redefinida`)).toBeVisible();

  await page.getByRole('button', { name: `Histórico de Hist ${RUN}` }).click();
  const h = page.getByRole('dialog', { name: new RegExp(`Histórico de Hist ${RUN}`) });
  const itens = h.getByRole('listitem');
  await expect(itens).toHaveCount(3);
  await expect(itens.nth(0)).toContainText('Senha redefinida');
  await expect(itens.nth(1)).toContainText('Papel: Atendente → Gerente');
  await expect(itens.nth(2)).toContainText('Usuário criado');
  await expect(h).not.toContainText('segredo-e2e-123');
  const api = JSON.stringify((await chamar(`/auditoria?entidade=USUARIO&entidadeId=${u.id}`, { token })).corpo);
  expect(api).not.toContain('segredo-e2e-123'); // o backend também não grava a senha
  expect(api).not.toContain('senhaHash');
});

test('Nome do autor é snapshot: renomear o usuário depois NÃO reescreve o histórico', async ({ page }) => {
  const autor = await criarUsuario(token, `Autor ${RUN}`, `autor.${RUN}@e2e.test`, 'GERENTE');
  const tk = await tokenDe(autor.email, 'senha123');
  const cli = (await chamar('/clientes', { method: 'POST', token: tk, body: { nome: `Snap autor ${RUN}`, telefone: '(11) 98877-1234', cpfCnpj: (await import('./helpers')).cpfValido(), email: '' } })).corpo;
  await chamar(`/usuarios/${autor.id}`, { method: 'PUT', token, body: { nome: `Renomeado ${RUN}`, email: autor.email, papel: 'GERENTE' } });

  await entrar(page, undefined, undefined, `/clientes/${cli.id}`);
  await expect(page.getByTestId('autoria')).toContainText(`Cadastrado por Autor ${RUN} em`); // nome da época, não o atual
  await expect(page.getByTestId('autoria')).not.toContainText('Renomeado');
  const api = (await chamar(`/clientes/${cli.id}`, { token })).corpo as { criadoPor: string; criadoPorId: number };
  expect(api).toMatchObject({ criadoPor: `Autor ${RUN}`, criadoPorId: autor.id });
});

test('ATENDENTE: vê Movimentações, mas /auditoria responde 403 e o Histórico de usuários não existe para ele', async ({ page }) => {
  const at = await criarUsuario(token, `Atend ${RUN}`, `atend.${RUN}@e2e.test`, 'ATENDENTE');
  const tk = await tokenDe(at.email, 'senha123');
  expect((await chamar('/auditoria', { token: tk })).status).toBe(403);
  expect((await chamar('/estoque/movimentacoes', { token: tk })).status).toBe(200);

  await entrar(page, at.email, 'senha123', '/estoque?aba=movimentacoes');
  await expect(page.getByRole('combobox', { name: 'Item' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: /Usuários|Serviços/ })).toHaveCount(0);
});
