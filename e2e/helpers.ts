import { expect, type Page } from '@playwright/test';

export const API = process.env.E2E_API_URL ?? 'http://localhost:8080/api';
export const ADMIN = {
  email: process.env.E2E_USER ?? 'admin@santoandreplacas.com.br',
  senha: process.env.E2E_PASSWORD ?? 'admin123',
};

/** Sufixo único por execução: os nomes criados não colidem com dados de execuções anteriores. */
export const RUN = Date.now().toString(36);

type Opcoes = { method?: string; body?: unknown; token?: string };

/** Chamada direta à API (para preparar dados e conferir o que a tela gravou). */
export async function chamar<T = any>(path: string, { method = 'GET', body, token }: Opcoes = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await r.text();
  let corpo: any = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }
  return { status: r.status, corpo: corpo as T };
}

export async function tokenDe(email: string, senha: string): Promise<string> {
  const { status, corpo } = await chamar<{ token: string }>('/auth/login', { method: 'POST', body: { email, senha } });
  if (status !== 200) throw new Error(`login de ${email} falhou (${status})`);
  return corpo.token;
}
export const tokenAdmin = () => tokenDe(ADMIN.email, ADMIN.senha);

/** CPF válido (dígitos verificadores corretos), formatado como o front grava: 000.000.000-00. */
export function cpfValido(): string {
  const base = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const dv = (digs: string, pesoInicial: number) => {
    const soma = digs.split('').reduce((t, c, i) => t + Number(c) * (pesoInicial - i), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, 10);
  const d2 = dv(base + d1, 11);
  const n = base + d1 + d2;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

const L = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
const D = () => Math.floor(Math.random() * 10);
/** Placa Mercosul aleatória (ABC1D23). */
export const placaAleatoria = () => `${L()}${L()}${L()}${D()}${L()}${D()}${D()}`;

/** Login pela tela, já indo para `destino`. */
export async function entrar(page: Page, email = ADMIN.email, senha = ADMIN.senha, destino = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(destino)}`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
}

/** Texto de moeda com espaço comum (o Intl usa espaço inquebrável). */
export const moeda = (s: string | null) => (s ?? '').replace(/ /g, ' ');

/** Cria cliente + veículo pela API; devolve ids e placa. */
export async function criarClienteComVeiculo(token: string, nome: string) {
  const cliente = (await chamar('/clientes', { method: 'POST', token, body: { nome, telefone: '(11) 98877-1234', cpfCnpj: cpfValido(), email: '' } })).corpo;
  const placa = placaAleatoria();
  const veiculo = (await chamar('/veiculos', {
    method: 'POST', token, body: { clienteId: cliente.id, placa, marcaModelo: 'Fiat Argo Drive 1.0', anoFabricacao: 2022, anoModelo: 2023 },
  })).corpo;
  return { cliente, veiculo, placa };
}

export async function criarServico(token: string, nome: string, precoCentavos = 31690) {
  return (await chamar('/servicos', { method: 'POST', token, body: { nome, descricao: '', categoria: 'EMPLACAMENTO', precoCentavos } })).corpo;
}

export async function criarPedido(token: string, clienteId: number, veiculoId: number, servicoId: number, origem = 'BALCAO') {
  return (await chamar('/pedidos', { method: 'POST', token, body: { clienteId, veiculoId, servicoId, origem } })).corpo;
}

/** Arrasta um card do Kanban para uma coluna (ponteiro real). */
export async function arrastarCard(page: Page, pedidoId: number, coluna: 'RECEBIDO' | 'EM_PROCESSAMENTO' | 'PLACA_PRONTA' | 'ENTREGUE') {
  const card = page.locator(`[aria-label^="Pedido ${pedidoId},"]`);
  const alvo = page.locator(`[data-coluna=${coluna}]`);
  await card.scrollIntoViewIfNeeded();
  const a = await card.boundingBox();
  const t = await alvo.boundingBox();
  if (!a || !t) throw new Error('card ou coluna não encontrados');
  await page.mouse.move(a.x + 30, a.y + 30);
  await page.mouse.down();
  await page.mouse.move(a.x + 50, a.y + 40, { steps: 5 });
  await page.waitForTimeout(150); // deixa o sensor do dnd-kit ativar o arraste
  const t2 = (await alvo.boundingBox()) ?? t; // o layout pode ter mudado ao fechar diálogos/avisos
  await page.mouse.move(t2.x + t2.width / 2, t2.y + 120, { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

/** Navegação interna (sem recarregar: o token fica só em memória, recarregar volta ao login). */
export async function irPara(page: Page, rota: string) {
  await page.evaluate((r) => { history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate')); }, rota);
}

export async function criarUsuario(token: string, nome: string, email: string, papel: 'ATENDENTE' | 'GERENTE' | 'ADMIN', senha = 'senha123') {
  return (await chamar('/usuarios', { method: 'POST', token, body: { nome, email, papel, senha } })).corpo;
}

/** Toast: o Radix renderiza o texto duas vezes (visual + região aria-live), então pega o primeiro. */
export const aviso = (page: Page, texto: string | RegExp) => page.getByText(texto).first();
