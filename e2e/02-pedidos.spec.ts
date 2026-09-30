import { expect, test } from '@playwright/test';
import { RUN, arrastarCard, chamar, cpfValido, entrar, moeda, placaAleatoria, tokenAdmin, aviso } from './helpers';

test.describe.configure({ mode: 'serial' });

const nomeServico = `Par de placas ${RUN}`;
const nomeCliente = `Cliente Pedido ${RUN}`;
const placa = placaAleatoria();
let token: string;
let servicoId: number;
let itemId: number;
let clienteId: number;
let pedidoId: number;

test.beforeAll(async () => {
  token = await tokenAdmin();
  servicoId = (await chamar('/servicos', { method: 'POST', token, body: { nome: nomeServico, descricao: '', categoria: 'EMPLACAMENTO', precoCentavos: 31690 } })).corpo.id;
  // a baixa automática consome 2 lacres por pedido; o item começa com 1 (insuficiente de propósito)
  itemId = (await chamar('/estoque/itens', { method: 'POST', token, body: { nome: `Lacre ${RUN}`, sku: `LAC-${RUN}`, unidade: 'un', quantidade: 1, quantidadeMinima: 1 } })).corpo.id;
  await chamar('/estoque/vinculos', { method: 'POST', token, body: { servicoId, itemEstoqueId: itemId, quantidadeNecessaria: 2 } });
});

test('Novo pedido pela tela: cliente novo (painel), veículo novo, serviço, Pix parcial e Ctrl+Enter', async ({ page }) => {
  await entrar(page, undefined, undefined, '/pedidos/novo');
  await page.getByRole('combobox', { name: 'Buscar cliente' }).fill('zzzz');
  await page.getByRole('option', { name: '+ Cadastrar novo cliente' }).click();
  const painel = page.getByRole('dialog', { name: 'Novo cliente' });
  await painel.getByLabel('Nome').fill(nomeCliente);
  await painel.getByLabel('CPF/CNPJ').pressSequentially(cpfValido().replace(/\D/g, ''));
  await painel.getByLabel('Telefone').pressSequentially('11988771234');
  await painel.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(page.getByText(nomeCliente)).toBeVisible();

  await page.getByRole('button', { name: '+ Novo veículo' }).click();
  const form = page.getByRole('form', { name: 'Novo veículo' });
  await form.getByLabel('Placa').pressSequentially(placa);
  await form.getByLabel('Marca / modelo').fill('Fiat Argo Drive 1.0');
  await form.getByLabel('Ano de fabricação').fill('2022');
  await form.getByLabel('Ano do modelo').fill('2023'); // chassi é opcional
  await form.getByRole('button', { name: 'Salvar veículo' }).click();
  await expect(page.getByRole('radio', { name: new RegExp(placa) })).toBeChecked();

  await page.getByRole('radio', { name: new RegExp(nomeServico) }).click();
  await page.getByLabel('Forma de pagamento').selectOption('PIX');
  // selecionar tudo e digitar substitui o valor (o padrão é o preço do serviço: R$ 316,90)
  const valor = page.getByLabel('Valor do pagamento');
  expect(moeda(await valor.inputValue())).toBe('R$ 316,90');
  await valor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('10000');
  expect(moeda(await valor.inputValue())).toBe('R$ 100,00');
  await expect(page.getByText(/Pagamento parcial: o pedido será criado com saldo de R\$\s216,90/)).toBeVisible();
  await page.keyboard.press('Control+Enter');
  await expect(aviso(page, /Pedido #\d+ criado/)).toBeVisible();

  clienteId = (await chamar('/clientes?busca=' + encodeURIComponent(nomeCliente), { token })).corpo[0].id;
  const pedidos = (await chamar(`/pedidos?clienteId=${clienteId}`, { token })).corpo.content;
  expect(pedidos).toHaveLength(1);
  pedidoId = pedidos[0].id;
  expect(pedidos[0]).toMatchObject({ status: 'RECEBIDO', origem: 'BALCAO', pago: false }); // parcial: soma < preço
  const pagamentos = (await chamar(`/pedidos/${pedidoId}/pagamentos`, { token })).corpo;
  expect(pagamentos).toMatchObject([{ valorCentavos: 10000, formaPagamento: 'PIX', status: 'PAGO' }]);
});

test('Kanban: "$ pendente", confirmação de entrega sem quitar e recusa por estoque insuficiente', async ({ page }) => {
  await entrar(page, undefined, undefined, '/pedidos');
  const card = page.locator(`[aria-label^="Pedido ${pedidoId},"]`);
  await expect(card).toContainText('$ pendente'); // pago vem da API: soma (R$ 100) < preço (R$ 316,90)
  await expect(page.locator(`[data-coluna=RECEBIDO] [aria-label^="Pedido ${pedidoId},"]`)).toHaveCount(1);

  // entregar sem quitar → pede confirmação; "Voltar" não altera nada
  await arrastarCard(page, pedidoId, 'ENTREGUE');
  const dialogo = page.getByRole('dialog', { name: 'Entregar sem pagamento?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Voltar' }).click();
  await expect(dialogo).toBeHidden();
  expect((await chamar(`/pedidos/${pedidoId}`, { token })).corpo.status).toBe('RECEBIDO');

  // iniciar produção: o serviço consome 2 lacres e há 1 → o backend recusa e o card volta
  await arrastarCard(page, pedidoId, 'EM_PROCESSAMENTO');
  await expect(aviso(page, /Estoque insuficiente para "Lacre .*": disponível 1, necessário 2/)).toBeVisible();
  await expect(page.locator(`[data-coluna=RECEBIDO] [aria-label^="Pedido ${pedidoId},"]`)).toHaveCount(1);
  expect((await chamar(`/pedidos/${pedidoId}`, { token })).corpo.status).toBe('RECEBIDO');
});

test('Estoque: entrada libera a produção; arrastar baixa o estoque e grava o histórico com o nome de quem mudou', async ({ page }) => {
  await entrar(page, undefined, undefined, '/estoque');
  await page.getByRole('button', { name: `Movimentar Lacre ${RUN}` }).click();
  const m = page.getByRole('dialog', { name: 'Movimentar estoque' });
  await m.getByLabel('Quantidade').fill('5');
  await m.getByRole('button', { name: 'Registrar' }).click();
  await expect(aviso(page, `Entrada de 5 — Lacre ${RUN}`)).toBeVisible();

  await page.getByRole('navigation').getByRole('link', { name: /Pedidos/ }).click();
  await arrastarCard(page, pedidoId, 'EM_PROCESSAMENTO');
  await expect(page.locator(`[data-coluna=EM_PROCESSAMENTO] [aria-label^="Pedido ${pedidoId},"]`)).toHaveCount(1);
  const itens = (await chamar('/estoque/itens', { token })).corpo as { id: number; quantidade: number }[];
  expect(itens.find((i) => i.id === itemId)!.quantidade).toBe(4); // 1 + 5 − 2
  const historico = (await chamar(`/pedidos/${pedidoId}/historico`, { token })).corpo;
  expect(historico.map((h: { statusNovo: string }) => h.statusNovo)).toEqual(['RECEBIDO', 'EM_PROCESSAMENTO']);
  expect(historico[1].alteradoPor).toBeTruthy();
});

test('Detalhe: aviso de baixa, saldo restante, quitação por parcela e regras de cancelamento', async ({ page }) => {
  await entrar(page, undefined, undefined, '/pedidos');
  await page.locator(`[aria-label^="Pedido ${pedidoId},"]`).click();
  await expect(page.getByRole('heading', { name: `#${pedidoId}` })).toBeVisible();

  // em processamento: ainda pode cancelar; o aviso de baixa só aparece em "Recebido"
  await expect(page.getByRole('button', { name: 'Mais ações' })).toBeVisible();
  await expect(page.getByText('Pago R$ 100,00 de R$ 316,90'.replace(/ /g, ' ')).or(page.getByText(/Pago R\$\s100,00 de R\$\s316,90/))).toBeVisible();
  await expect(page.getByText(/Saldo restante: R\$\s216,90/)).toBeVisible();
  expect(moeda(await page.getByLabel('Valor').inputValue())).toBe('R$ 216,90'); // padrão = saldo

  await page.getByLabel('Forma').selectOption('DINHEIRO');
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(page.getByText(/^Pago · R\$\s316,90/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Pagamentos registrados' }).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Registrar pagamento' })).toHaveCount(0);
  expect((await chamar(`/pedidos/${pedidoId}`, { token })).corpo.pago).toBe(true);

  await page.getByRole('button', { name: 'Marcar placa pronta' }).click();
  await expect(page.getByRole('button', { name: 'Registrar entrega' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mais ações' })).toHaveCount(0); // placa pronta: não cancela mais

  await page.getByRole('button', { name: 'Registrar entrega' }).click(); // quitado: sem confirmação
  await expect(aviso(page, `Pedido #${pedidoId} → Entregue`)).toBeVisible();
  expect((await chamar(`/pedidos/${pedidoId}`, { token })).corpo.status).toBe('ENTREGUE');
  // status final: a API recusa qualquer nova mudança
  const r = await chamar(`/pedidos/${pedidoId}/status`, { method: 'PATCH', token, body: { novoStatus: 'RECEBIDO' } });
  expect(r.status).toBe(400);
  expect(r.corpo.mensagem).toMatch(/status final/);
});

test('Cancelar pelo menu (pedido recebido) e o quadro não mostra cancelados; cards finais não arrastam', async ({ page }) => {
  const c = (await chamar('/veiculos', { method: 'POST', token, body: { clienteId, placa: placaAleatoria(), marcaModelo: 'Honda CG 160', anoFabricacao: 2019, anoModelo: 2020 } })).corpo;
  const p2 = (await chamar('/pedidos', { method: 'POST', token, body: { clienteId, veiculoId: c.id, servicoId, origem: 'WHATSAPP' } })).corpo;
  await entrar(page, undefined, undefined, '/pedidos');
  await expect(page.locator(`[aria-label^="Pedido ${pedidoId},"]`)).toHaveAttribute('aria-disabled', 'true'); // ENTREGUE é final
  await page.locator(`[aria-label^="Pedido ${p2.id},"]`).click();
  await expect(page.getByText(/Baixa automática de estoque: −2 Lacre/)).toBeVisible(); // itens vêm de /estoque/vinculos
  await page.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('menuitem', { name: 'Cancelar pedido' }).click();
  await page.getByRole('dialog', { name: `Cancelar pedido #${p2.id}?` }).getByRole('button', { name: 'Cancelar pedido' }).click();
  await expect(aviso(page, `Pedido #${p2.id} → Cancelado`)).toBeVisible();
  await page.getByRole('link', { name: /Pedidos/ }).first().click();
  await expect(page.locator(`[aria-label^="Pedido ${p2.id},"]`)).toHaveCount(0);
});
