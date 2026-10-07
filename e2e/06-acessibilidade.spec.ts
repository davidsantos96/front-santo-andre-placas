import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { RUN, chamar, criarClienteComVeiculo, criarPedido, criarServico, entrar, irPara, tokenAdmin } from './helpers';

/**
 * Passada de acessibilidade (WCAG 2.1 A/AA) com axe-core num Chromium de verdade — inclui contraste de cor,
 * que o jsdom não calcula. Rotas e sobreposições principais, contra a API real.
 */

let token: string;
let ids: { pedido: number; cliente: number; veiculo: number };

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function auditar(page: Page, onde: string) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0); // esqueletos terminaram
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const resumo = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} → ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`).join('\n   ')}`);
  expect.soft(resumo, `violações de acessibilidade em ${onde}`).toEqual([]);
}

test.beforeAll(async () => {
  token = await tokenAdmin();
  const s = await criarServico(token, `Serviço a11y ${RUN}`);
  const { cliente, veiculo } = await criarClienteComVeiculo(token, `Cliente a11y ${RUN}`);
  const p = await criarPedido(token, cliente.id, veiculo.id, s.id);
  await chamar(`/pedidos/${p.id}/pagamento`, { method: 'POST', token, body: { valorCentavos: 10000, formaPagamento: 'PIX' } });
  await chamar('/estoque/itens', { method: 'POST', token, body: { nome: `Lacre a11y ${RUN}`, sku: `A11-${RUN}`, unidade: 'un', quantidade: 10, quantidadeMinima: 3 } });
  ids = { pedido: p.id, cliente: cliente.id, veiculo: veiculo.id };
});

test('Login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await auditar(page, '/login');
});

const ROTAS: [string, () => string][] = [
  ['Dashboard', () => '/dashboard'],
  ['Pedidos (quadro)', () => '/pedidos'],
  ['Pedidos (tabela)', () => '/pedidos?visao=tabela'],
  ['Novo pedido', () => '/pedidos/novo'],
  ['Detalhe do pedido', () => `/pedidos/${ids.pedido}`],
  ['Clientes', () => '/clientes'],
  ['Detalhe do cliente', () => `/clientes/${ids.cliente}`],
  ['Cliente → veículos', () => `/clientes/${ids.cliente}?aba=veiculos`],
  ['Veículos', () => '/veiculos'],
  ['Detalhe do veículo', () => `/veiculos/${ids.veiculo}`],
  ['Serviços', () => '/servicos'],
  ['Estoque', () => '/estoque'],
  ['Financeiro', () => '/financeiro'],
  ['Usuários', () => '/usuarios'],
];

test('Rotas autenticadas', async ({ page }) => {
  test.setTimeout(180_000);
  await entrar(page);
  for (const [nome, rota] of ROTAS) {
    await irPara(page, rota());
    await expect(page.locator('main')).toBeVisible();
    await auditar(page, `${nome} (${rota()})`);
  }
});

test('Sobreposições: busca com resultados, modais e confirmação', async ({ page }) => {
  test.setTimeout(120_000);
  await entrar(page, undefined, undefined, '/pedidos');
  // busca global aberta com resultados
  const busca = page.getByRole('combobox', { name: 'Buscar placa, cliente ou nº do pedido' });
  await busca.fill(`a11y ${RUN}`);
  await expect(page.getByRole('listbox', { name: 'Resultados da busca' }).getByRole('option').first()).toBeVisible();
  await auditar(page, 'busca global aberta');
  await page.keyboard.press('Escape');

  // modal de serviço
  await irPara(page, '/servicos');
  await page.getByRole('button', { name: '+ Novo serviço' }).click();
  await expect(page.getByRole('dialog', { name: 'Novo serviço' })).toBeVisible();
  await auditar(page, 'modal Novo serviço');
  await page.keyboard.press('Escape');

  // modal de movimentação de estoque
  await irPara(page, '/estoque');
  await page.getByRole('button', { name: /^Movimentar / }).first().click();
  await expect(page.getByRole('dialog', { name: 'Movimentar estoque' })).toBeVisible();
  await auditar(page, 'modal Movimentar estoque');
  await page.keyboard.press('Escape');

  // confirmação perigosa (cancelar pedido pelo menu do detalhe)
  await irPara(page, `/pedidos/${ids.pedido}`);
  await page.getByRole('button', { name: /Mais ações|Ações/ }).first().click();
  await page.getByRole('menuitem', { name: /Cancelar pedido/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await auditar(page, 'confirmação de cancelamento');
});

test('Mobile (390px): menu em gaveta e telas principais', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await entrar(page, undefined, undefined, '/pedidos');
  await auditar(page, 'pedidos em 390px');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await auditar(page, 'gaveta de navegação em 390px');
});

test('Teclado: atalhos, foco visível, linha clicável e retorno do foco ao fechar o modal', async ({ page }) => {
  await entrar(page, undefined, undefined, '/dashboard');
  const busca = page.getByRole('combobox', { name: 'Buscar placa, cliente ou nº do pedido' });

  await page.keyboard.press('/');
  await expect(busca).toBeFocused();
  await expect(busca).toHaveCSS('outline-style', 'solid'); // foco visível (nada de outline: none sem substituto)
  await page.keyboard.press('Escape');
  await expect(busca).not.toBeFocused();

  await page.keyboard.press('g');
  await page.keyboard.press('c');
  await expect(page).toHaveURL(/\/clientes$/);
  await page.keyboard.press('g');
  await page.keyboard.press('p');
  await expect(page).toHaveURL(/\/pedidos$/);
  await page.keyboard.press('n');
  await expect(page).toHaveURL(/\/pedidos\/novo$/);

  // modal devolve o foco ao gatilho
  await irPara(page, '/servicos');
  const gatilho = page.getByRole('button', { name: '+ Novo serviço' });
  await gatilho.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Novo serviço' })).toBeVisible();
  await expect(page.getByLabel('Nome')).toBeFocused(); // o foco entra no modal
  await page.keyboard.press('Escape');
  await expect(gatilho).toBeFocused();

  // o mesmo vale para o modal de usuário e para a gaveta de cliente
  await irPara(page, '/usuarios');
  const editar = page.getByRole('button', { name: /^Editar / }).first();
  await editar.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /Editar usuário/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editar).toBeFocused();

  // linha clicável é alcançável por Tab e abre com Enter
  await irPara(page, '/clientes');
  await page.getByLabel('Buscar cliente').fill(`a11y ${RUN}`);
  const linha = page.locator('tr[role="link"]').filter({ hasText: `Cliente a11y ${RUN}` });
  await expect(linha).toHaveAttribute('tabindex', '0');
  await linha.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/clientes/${ids.cliente}`));
});

test('prefers-reduced-motion desliga transições e animações', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await entrar(page, undefined, undefined, '/pedidos');
  const card = page.locator(`[aria-label^="Pedido ${ids.pedido},"]`);
  await expect(card).toBeVisible();
  const [transicao, animacao] = await card.evaluate((el) => {
    const c = getComputedStyle(el);
    return [c.transitionDuration, c.animationName];
  });
  expect(transicao.split(',').every((d) => d.trim() === '0s')).toBe(true);
  expect(animacao).toBe('none');
});
