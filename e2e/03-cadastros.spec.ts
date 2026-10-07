import { expect, test } from '@playwright/test';
import { RUN, chamar, criarClienteComVeiculo, entrar, irPara, moeda, placaAleatoria, tokenAdmin, aviso } from './helpers';

test.describe.configure({ mode: 'serial' });

let token: string;
const servico = `Serviço E2E ${RUN}`;

test.beforeAll(async () => { token = await tokenAdmin(); });

test('Serviços: criar (preço digitando com o cursor no início), editar e desativar via PATCH', async ({ page }) => {
  await entrar(page, undefined, undefined, '/servicos');
  await page.getByRole('button', { name: '+ Novo serviço' }).click();
  const m = page.getByRole('dialog', { name: 'Novo serviço' });
  await m.getByRole('button', { name: 'Salvar' }).click();
  await expect(m.getByText('Informe o nome')).toBeVisible(); // validação Zod antes de chamar a API
  await m.getByLabel('Nome').fill(servico);
  await m.getByLabel('Categoria').selectOption('SERVIÇOS');
  const preco = m.getByLabel('Preço');
  await preco.click({ position: { x: 4, y: 10 } }); // cursor no INÍCIO do campo (cenário que corrompia o valor)
  await page.keyboard.type('31690');
  expect(moeda(await preco.inputValue())).toBe('R$ 316,90');
  await m.getByRole('button', { name: 'Salvar' }).click();
  await expect(aviso(page, 'Serviço criado')).toBeVisible();
  const criado = ((await chamar('/servicos', { token })).corpo as { id: number; nome: string; precoCentavos: number; ativo: boolean }[]).find((s) => s.nome === servico)!;
  expect(criado).toMatchObject({ precoCentavos: 31690, ativo: true });

  // editar: clicar na linha abre o modal; trocar o preço selecionando tudo
  await page.getByText(servico).click();
  const e = page.getByRole('dialog', { name: 'Editar serviço' });
  const p2 = e.getByLabel('Preço');
  await p2.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('12550');
  await e.getByRole('button', { name: 'Salvar' }).click();
  await expect(aviso(page, 'Serviço atualizado')).toBeVisible();
  expect(((await chamar(`/servicos/${criado.id}`, { token })).corpo as { precoCentavos: number }).precoCentavos).toBe(12550);

  // desativar: PATCH /servicos/{id}/status; some da listagem da API (só ativos)
  await page.getByRole('switch', { name: new RegExp(servico) }).click();
  await expect(aviso(page, `${servico} desativado`)).toBeVisible();
  const ativos = (await chamar('/servicos', { token })).corpo as { id: number }[];
  expect(ativos.some((s) => s.id === criado.id)).toBe(false);
});

test('Estoque: novo item (opcionais em branco) e movimentação com validação de saldo', async ({ page }) => {
  const nome = `Item E2E ${RUN}`;
  await entrar(page, undefined, undefined, '/estoque');
  await page.getByRole('button', { name: '+ Novo item' }).click();
  const m = page.getByRole('dialog', { name: 'Novo item de estoque' });
  await m.getByLabel(/^Nome/).fill(nome);
  await m.getByLabel(/^Quantidade inicial/).fill('4');
  await m.getByLabel(/^Quantidade mínima/).fill('10');
  await m.getByRole('button', { name: 'Salvar item' }).click();
  await expect(aviso(page, `Item "${nome}" cadastrado`)).toBeVisible();
  const linha = page.getByRole('row').filter({ hasText: nome });
  await expect(linha).toContainText('Abaixo do mínimo'); // 4 <= 10: alerta em texto, não só cor
  await expect(page.getByRole('navigation').getByLabel(/itens? abaixo do mínimo/)).toBeVisible(); // badge da sidebar

  await linha.getByRole('button', { name: `Movimentar ${nome}` }).click();
  const mov = page.getByRole('dialog', { name: 'Movimentar estoque' });
  await mov.getByRole('radio', { name: 'Saída' }).click();
  await mov.getByLabel('Quantidade').fill('9');
  await mov.getByRole('button', { name: 'Registrar' }).click();
  await expect(mov.getByText('Saldo insuficiente (disponível: 4)')).toBeVisible();
  await mov.getByLabel('Quantidade').fill('4');
  await mov.getByRole('button', { name: 'Registrar' }).click();
  await expect(aviso(page, `Saída de 4 — ${nome}`)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: nome })).toContainText('Abaixo do mínimo');
  const itens = (await chamar('/estoque/itens', { token })).corpo as { nome: string; quantidade: number }[];
  expect(itens.find((i) => i.nome === nome)!.quantidade).toBe(0);
});

test('Clientes: busca, abas, edição e novo veículo (chassi opcional)', async ({ page }) => {
  const nome = `Cliente E2E ${RUN}`;
  const { cliente } = await criarClienteComVeiculo(token, nome);
  await entrar(page, undefined, undefined, '/clientes');
  await page.getByLabel('Buscar cliente').fill(nome);
  const linha = page.locator('tr').filter({ hasText: nome }); // linhas clicáveis têm role="link"
  await expect(linha).toBeVisible();
  await expect(linha.getByRole('img', { name: /^Placa / })).toHaveCount(1);
  await linha.click();
  await expect(page).toHaveURL(new RegExp(`/clientes/${cliente.id}`));

  await page.getByRole('tab', { name: /Veículos/ }).click();
  await expect(page).toHaveURL(/aba=veiculos/);
  await page.getByRole('button', { name: '+ Novo veículo' }).click();
  const placa = placaAleatoria();
  const f = page.getByRole('form', { name: 'Novo veículo' });
  await f.getByLabel('Placa').pressSequentially(placa);
  await f.getByLabel('Marca / modelo').fill('Fiat Uno');
  await f.getByLabel('Ano de fabricação').fill('2015');
  await f.getByLabel('Ano do modelo').fill('2015');
  await f.getByRole('button', { name: 'Salvar veículo' }).click();
  await expect(aviso(page, `Veículo ${placa} cadastrado`)).toBeVisible();
  await expect(page.getByRole('tab', { name: /Veículos/ })).toContainText('2');

  await page.getByRole('tab', { name: /Dados/ }).click();
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nome').fill(`${nome} (editado)`);
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('heading', { name: `${nome} (editado)` })).toBeVisible();
  expect(((await chamar(`/clientes/${cliente.id}`, { token })).corpo as { nome: string }).nome).toBe(`${nome} (editado)`);

  await page.getByRole('tab', { name: /Pedidos/ }).click(); // sem pedidos ainda: tabela vazia
  await expect(page.getByText('Nenhum pedido ainda.')).toBeVisible();
});

test('Veículos: busca por placa, detalhe e "Consultar placa" (400 esperado = aviso)', async ({ page }) => {
  const { placa, veiculo } = await criarClienteComVeiculo(token, `Dono ${RUN}`);
  await entrar(page, undefined, undefined, '/veiculos');
  await page.getByLabel('Buscar por placa').fill(placa.toLowerCase()); // maiúsculas automáticas
  await expect(page.getByLabel('Buscar por placa')).toHaveValue(placa);
  const linha = page.locator('tr').filter({ hasText: 'Fiat Argo Drive 1.0' }).filter({ hasText: `Dono ${RUN}` });
  await expect(linha).toHaveCount(1);
  await linha.getByRole('img', { name: `Placa ${placa}` }).click(); // clicar na placa (o centro da linha cai no link do cliente)
  await expect(page).toHaveURL(new RegExp(`/veiculos/${veiculo.id}$`));
  await expect(page.getByText('Nenhuma consulta realizada para este veículo.')).toBeVisible();
  await page.getByRole('button', { name: 'Consultar placa' }).click();
  await expect(aviso(page, 'Consulta veicular ainda não está disponível.')).toBeVisible();
  void irPara;
});
