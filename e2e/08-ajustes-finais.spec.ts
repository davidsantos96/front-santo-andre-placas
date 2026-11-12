import { expect, test } from '@playwright/test';
import { ADMIN, RUN, aviso, chamar, criarClienteComVeiculo, criarPedido, criarServico, criarUsuario, entrar, irPara, tokenAdmin, tokenDe } from './helpers';

test.describe.configure({ mode: 'serial' });

let token: string;
test.beforeAll(async () => { token = await tokenAdmin(); });

const quantidadeDe = async (itemId: number) =>
  ((await chamar('/estoque/itens', { token })).corpo as { id: number; quantidade: number }[]).find((i) => i.id === itemId)!.quantidade;

test('Serviços → Baixa de estoque: vínculo feito pela tela vale na baixa automática; removido, deixa de valer; fica no Histórico', async ({ page }) => {
  const servico = await criarServico(token, `Serviço Vínculo ${RUN}`);
  const item = (await chamar('/estoque/itens', { method: 'POST', token, body: { nome: `Item Vínculo ${RUN}`, quantidade: 10, quantidadeMinima: 2 } })).corpo;
  const { cliente, veiculo } = await criarClienteComVeiculo(token, `Cliente Vínculo ${RUN}`);

  await entrar(page, undefined, undefined, '/servicos');
  await page.getByRole('button', { name: `Baixa de estoque de ${servico.nome}` }).click();
  const m = page.getByRole('dialog', { name: `Baixa de estoque de ${servico.nome}` });
  await expect(m.getByText(/Nenhum item vinculado/)).toBeVisible();

  await m.getByLabel('Item de estoque').selectOption({ label: item.nome });
  await m.getByLabel('Qtd. por pedido').fill('3');
  await m.getByRole('button', { name: 'Vincular item' }).click();
  await expect(aviso(page, `${item.nome} vinculado a ${servico.nome}`)).toBeVisible();
  await expect(m.getByRole('list', { name: 'Itens vinculados' })).toContainText('−3 por pedido');
  // o item sai das opções: o backend recusa o mesmo item duas vezes no mesmo serviço
  const repetido = await chamar('/estoque/vinculos', { method: 'POST', token, body: { servicoId: servico.id, itemEstoqueId: item.id, quantidadeNecessaria: 1 } });
  expect(repetido.status).toBe(400);
  expect(repetido.corpo.mensagem).toContain('já está vinculado');

  // com o vínculo: entrar em processamento baixa 3
  const p1 = await criarPedido(token, cliente.id, veiculo.id, servico.id);
  expect((await chamar(`/pedidos/${p1.id}/status`, { method: 'PATCH', token, body: { novoStatus: 'EM_PROCESSAMENTO' } })).status).toBe(200);
  expect(await quantidadeDe(item.id)).toBe(7);

  // removido pela tela: o próximo pedido não baixa nada
  await m.getByRole('button', { name: `Remover ${item.nome}` }).click();
  await expect(aviso(page, `${item.nome} desvinculado de ${servico.nome}`)).toBeVisible();
  await expect(m.getByText(/Nenhum item vinculado/)).toBeVisible();
  const p2 = await criarPedido(token, cliente.id, veiculo.id, servico.id);
  expect((await chamar(`/pedidos/${p2.id}/status`, { method: 'PATCH', token, body: { novoStatus: 'EM_PROCESSAMENTO' } })).status).toBe(200);
  expect(await quantidadeDe(item.id)).toBe(7);
  await m.getByRole('button', { name: 'Fechar' }).click();

  // inclusão e remoção ficam no histórico do serviço, com autor
  await page.getByRole('button', { name: `Histórico de ${servico.nome}` }).click();
  const h = page.getByRole('dialog', { name: `Histórico de ${servico.nome}` });
  await expect(h.getByText(`Baixa de estoque: — → ${item.nome} × 3`)).toBeVisible();
  await expect(h.getByText(`Baixa de estoque: ${item.nome} × 3 → —`)).toBeVisible();
});

test('Erro de uso da API sai como 400/404 com mensagem (não 401): a tela mostra o erro e NÃO pede login de novo', async ({ page }) => {
  const invalido = await chamar('/pedidos?status=NAO_EXISTE', { token });
  expect(invalido.status).toBe(400);
  expect(invalido.corpo.mensagem).toContain('status');
  const rota = await chamar('/rota-que-nao-existe', { token });
  expect(rota.status).toBe(404);
  expect(rota.corpo.mensagem).toBeTruthy();
  expect((await chamar('/pedidos', {})).status).toBe(401); // sem token continua 401

  await entrar(page, undefined, undefined, '/pedidos');
  await irPara(page, '/pedidos/999999999');
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByRole('dialog', { name: 'Sessão expirada' })).toHaveCount(0);
});

test('Login de rede: sem e-mail para a equipe, e-mail só do dono; entra por login ou e-mail, sem diferenciar maiúsculas', async ({ page }) => {
  const login = `caixa.${RUN}`;
  await criarUsuario(token, `Caixa ${RUN}`, login, 'ATENDENTE');

  // o login é único sem diferenciar caixa e a mensagem diz qual campo repetiu
  const duplicado = await chamar('/usuarios', { method: 'POST', token, body: { login: login.toUpperCase(), nome: 'Outro', papel: 'ATENDENTE', senha: 'senha123' } });
  expect(duplicado.status).toBe(400);
  expect(duplicado.corpo.mensagem).toContain('Já existe');
  await expect(tokenDe(login.toUpperCase(), 'senha123')).resolves.toBeTruthy();

  // quem tem e-mail entra pelos dois; ADMIN exige e-mail; formato é validado
  const comEmail = await chamar('/usuarios', { method: 'POST', token, body: { login: `gerente.${RUN}`, nome: `Gerente ${RUN}`, email: `Gerente.${RUN}@exemplo.com`, papel: 'GERENTE', senha: 'senha123' } });
  expect(comEmail.status).toBe(200);
  await expect(tokenDe(`gerente.${RUN}`, 'senha123')).resolves.toBeTruthy();
  await expect(tokenDe(`GERENTE.${RUN}@exemplo.com`, 'senha123')).resolves.toBeTruthy();
  const adminSemEmail = await chamar('/usuarios', { method: 'POST', token, body: { login: `dono.${RUN}`, nome: 'Dono', papel: 'ADMIN', senha: 'senha123' } });
  expect(adminSemEmail.status).toBe(400);
  expect(adminSemEmail.corpo.mensagem).toContain('e-mail');
  expect((await chamar('/usuarios', { method: 'POST', token, body: { login: 'a b', nome: 'X', papel: 'ATENDENTE', senha: 'senha123' } })).status).toBe(400);

  // pela tela: digitando o e-mail (outra caixa) o gerente entra
  await entrar(page, `GERENTE.${RUN}@exemplo.com`, 'senha123', '/dashboard');
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
});

test('Usuários: senha mínima e proteção contra desativar a si mesmo ou alterar o próprio login valem na API', async () => {
  const curta = await chamar('/usuarios', { method: 'POST', token, body: { login: `curta.${RUN}`, nome: 'Curta', papel: 'ATENDENTE', senha: '123' } });
  expect(curta.status).toBe(400);
  expect(curta.corpo.mensagem).toContain('pelo menos 6');

  const eu = ((await chamar('/usuarios', { token })).corpo as { id: number; login: string; email: string }[]).find((u) => u.login === ADMIN.login)!;
  const auto = await chamar(`/usuarios/${eu.id}/status`, { method: 'PATCH', token, body: { ativo: false } });
  expect(auto.status).toBe(400);
  expect(auto.corpo.mensagem).toContain('próprio');
  const trocaLogin = await chamar(`/usuarios/${eu.id}`, { method: 'PUT', token, body: { login: `${ADMIN.login}.novo`, nome: 'Administrador', email: eu.email, papel: 'ADMIN' } });
  expect(trocaLogin.status).toBe(400);
  expect(trocaLogin.corpo.mensagem).toContain('próprio login');
  await expect(tokenAdmin()).resolves.toBeTruthy(); // segue ativo e com o mesmo login
});

test('Clientes: busca por nome não casa dígitos soltos com telefone/CPF (B17)', async () => {
  await criarClienteComVeiculo(token, `Cliente Busca ${RUN}`); // telefone e CPF com vários dígitos
  const semResultado = (await chamar(`/clientes?busca=${encodeURIComponent('Zz9 Naoexiste 8')}`, { token })).corpo as unknown[];
  expect(semResultado).toHaveLength(0);
  const porNome = (await chamar(`/clientes?busca=${encodeURIComponent(`Cliente Busca ${RUN}`)}`, { token })).corpo as unknown[];
  expect(porNome).toHaveLength(1);
});

test('Pedido: a API recusa serviço inativo e veículo de outro cliente', async () => {
  const servico = await criarServico(token, `Serviço Regras ${RUN}`);
  const a = await criarClienteComVeiculo(token, `Dono ${RUN}`);
  const b = await criarClienteComVeiculo(token, `Outro ${RUN}`);

  const alheio = await chamar('/pedidos', { method: 'POST', token, body: { clienteId: b.cliente.id, veiculoId: a.veiculo.id, servicoId: servico.id, origem: 'BALCAO' } });
  expect(alheio.status).toBe(400);
  expect(alheio.corpo.mensagem).toContain('não pertence');

  await chamar(`/servicos/${servico.id}/status`, { method: 'PATCH', token, body: { ativo: false } });
  const inativo = await chamar('/pedidos', { method: 'POST', token, body: { clienteId: a.cliente.id, veiculoId: a.veiculo.id, servicoId: servico.id, origem: 'BALCAO' } });
  expect(inativo.status).toBe(400);
  expect(inativo.corpo.mensagem).toContain('inativo');
});
