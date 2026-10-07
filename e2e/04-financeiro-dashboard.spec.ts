import { expect, test } from '@playwright/test';
import { RUN, chamar, criarClienteComVeiculo, criarPedido, criarServico, entrar, tokenAdmin } from './helpers';

test.describe.configure({ mode: 'serial' });

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** "R$ 1.234,56" → 123456 (centavos). */
const centavos = (texto: string) => {
  const m = /R\$\s*([\d.]+,\d{2})/.exec(texto.replace(/ /g, ' '));
  if (!m) throw new Error(`valor em R$ não encontrado em: ${texto}`);
  return Math.round(Number(m[1].replace(/\./g, '').replace(',', '.')) * 100);
};

let token: string;
const nomeCliente = `Financeiro ${RUN}`;

test.beforeAll(async () => {
  token = await tokenAdmin();
  const servico = await criarServico(token, `Serviço fin ${RUN}`, 31690);
  const { cliente, veiculo } = await criarClienteComVeiculo(token, nomeCliente);
  const pedido = await criarPedido(token, cliente.id, veiculo.id, servico.id);
  await chamar(`/pedidos/${pedido.id}/pagamento`, { method: 'POST', token, body: { valorCentavos: 10000, formaPagamento: 'DINHEIRO' } });
  await chamar(`/pedidos/${pedido.id}/pagamento`, { method: 'POST', token, body: { valorCentavos: 21690, formaPagamento: 'PIX' } });
});

test('Financeiro → Pagamentos: lista os pagamentos do período, ordenados do mais recente, com filtro por forma', async ({ page }) => {
  await entrar(page, undefined, undefined, '/financeiro');
  await expect(page.getByRole('tab', { name: /Pagamentos/ })).toHaveAttribute('aria-selected', 'true');
  const linhas = page.locator('tr').filter({ hasText: nomeCliente });
  await expect(linhas).toHaveCount(2); // dois pagamentos do mesmo pedido (parcelas)
  await expect(linhas.first()).toContainText('Pix'); // o mais recente primeiro (o backend não ordena; o front sim)
  await expect(linhas.last()).toContainText('Dinheiro');
  await expect(linhas.first()).toContainText('Administrador'); // "Registrado por": o nome do usuário logado

  await page.getByLabel('Forma').selectOption('DINHEIRO');
  await expect(page).toHaveURL(/forma=DINHEIRO/);
  await expect(page.locator('tr').filter({ hasText: nomeCliente })).toHaveCount(1);
  await page.getByLabel('Forma').selectOption('');
  await linhas.first().click(); // a linha abre o pedido
  await expect(page).toHaveURL(/\/pedidos\/\d+$/);
  await expect(page.getByText(/^Pago · R\$\s316,90/)).toBeVisible(); // 100,00 + 216,90 quita o pedido
});

test('Financeiro → Caixa: sempre as 5 formas e o total bate com a soma e com a API', async ({ page }) => {
  await entrar(page, undefined, undefined, '/financeiro?aba=caixa');
  const formas = ['PIX', 'CARTÃO DE CRÉDITO', 'CARTÃO DE DÉBITO', 'DINHEIRO', 'BOLETO'];
  const valores: number[] = [];
  for (const f of formas) {
    const cartao = page.getByText(f, { exact: true }).locator('xpath=..');
    await expect(cartao).toBeVisible(); // aparece mesmo com R$ 0,00
    valores.push(centavos(await cartao.innerText()));
  }
  const total = centavos(await page.getByText('TOTAL DO PERÍODO').locator('xpath=..').innerText());
  expect(valores.reduce((a, b) => a + b, 0)).toBe(total);
  expect(valores[0]).toBeGreaterThanOrEqual(21690); // Pix de hoje
  expect(valores[3]).toBeGreaterThanOrEqual(10000); // Dinheiro de hoje
  const api = (await chamar(`/financeiro/fechamento-caixa?de=${hojeISO()}&ate=${hojeISO()}`, { token })).corpo;
  expect(total).toBe(api.totalGeral);

  await page.getByLabel('Período').selectOption('7');
  await expect(page).toHaveURL(/cperiodo=7/);
  await expect.poll(async () => centavos(await page.getByText('TOTAL DO PERÍODO').locator('xpath=..').innerText())).toBeGreaterThanOrEqual(total);
});

test('Dashboard: KPIs e faturamento batem com a API; período personalizado e visão em tabela', async ({ page }) => {
  await entrar(page);
  const kpi = (rotulo: string) => page.getByText(rotulo, { exact: true }).locator('xpath=..');
  const resumo = (await chamar('/dashboard/resumo', { token })).corpo;
  await expect(kpi('PEDIDOS HOJE')).toContainText(String(resumo.pedidosHoje));
  await expect(kpi('EM PRODUÇÃO')).toContainText(String(resumo.pedidosPorStatus.EM_PROCESSAMENTO ?? 0));
  expect(centavos(await kpi('FATURAMENTO HOJE').innerText())).toBe(resumo.faturamentoHojeCentavos);

  const cartao = page.getByRole('heading', { name: 'Faturamento' }).locator('xpath=ancestor::section');
  await cartao.getByRole('radio', { name: 'Personalizado' }).click();
  const hoje = new Date();
  const de = new Date(hoje); de.setDate(hoje.getDate() - 4);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await cartao.getByLabel('De', { exact: true }).fill(iso(de));
  await expect(cartao.getByRole('img', { name: /Faturamento de \d\d\/\d\d\/\d{4} a \d\d\/\d\d\/\d{4}/ })).toBeVisible();
  await cartao.getByRole('button', { name: 'Ver como tabela' }).click();
  await expect(cartao.getByRole('row')).toHaveCount(1 + 5); // 5 dias: dias sem faturamento entram com R$ 0,00
  const api = (await chamar(`/dashboard/faturamento?de=${iso(de)}&ate=${iso(hoje)}`, { token })).corpo;
  expect(centavos(await cartao.getByText(/Total no período/).innerText())).toBe(api.totalCentavos);

  await cartao.getByLabel('De', { exact: true }).fill(iso(hoje)); // janela de 1 dia
  await cartao.getByLabel('Até', { exact: true }).fill(iso(de)); // até < de → erro, sem consultar
  await expect(cartao.getByRole('alert')).toContainText('A data inicial não pode ser depois da data final.');
  await cartao.getByLabel('De', { exact: true }).fill('2020-01-01'); // > 366 dias
  await cartao.getByLabel('Até', { exact: true }).fill(iso(hoje));
  await expect(cartao.getByRole('alert')).toContainText('no máximo 366 dias');
});

test('F1 · Dashboard: tempo médio dos últimos 7 dias e tendência batem com a API', async ({ page }) => {
  const srv = await criarServico(token, `Srv tempo ${RUN}`);
  const { cliente, veiculo } = await criarClienteComVeiculo(token, `Cliente Tempo ${RUN}`);
  const ped = await criarPedido(token, cliente.id, veiculo.id, srv.id);
  for (const novoStatus of ['EM_PROCESSAMENTO', 'PLACA_PRONTA']) await chamar(`/pedidos/${ped.id}/status`, { method: 'PATCH', token, body: { novoStatus } });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoje = new Date();
  const de = new Date(hoje); de.setDate(de.getDate() - 6);
  const api = (await chamar(`/dashboard/tempo-medio-producao?de=${iso(de)}&ate=${iso(hoje)}`, { token })).corpo as
    { horasMedia: number; pedidosConsiderados: number; horasMediaPeriodoAnterior: number | null };
  await entrar(page, undefined, undefined, '/dashboard');
  const card = page.getByRole('heading', { name: 'Tempo médio de produção' }).locator('xpath=ancestor::section');
  if (api.pedidosConsiderados === 0) {
    await expect(card).toContainText('Sem placas prontas nos últimos 7 dias.');
  } else {
    await expect(card).toContainText(`últimos 7 dias · ${api.pedidosConsiderados}`);
    if (api.horasMediaPeriodoAnterior == null) await expect(card).not.toContainText('dias anteriores');
    else {
      const min = Math.round((api.horasMedia - api.horasMediaPeriodoAnterior) * 60);
      await expect(card).toContainText(min === 0 ? 'Igual aos 7 dias anteriores' : min < 0 ? 'mais rápido que nos 7 dias anteriores' : 'mais lento que nos 7 dias anteriores');
    }
  }
  const mais = page.getByRole('heading', { name: 'Serviços mais vendidos' }).locator('xpath=ancestor::section');
  await expect(mais).toContainText('Últimos 30 dias');
});
