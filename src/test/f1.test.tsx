import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { entrarComo } from './utils';
import { db } from '@/mocks/db';
import { server } from '@/mocks/server';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => { reloginCancelado(); server.events.removeAllListeners(); });

const gerente = 'gerente@sap.com';
const API = 'http://localhost:8080/api';
const cartao = async (titulo: string) => (await screen.findByRole('heading', { name: titulo })).closest('section')!;
const linha = async (texto: string | RegExp) => (await screen.findByText(texto)).closest('tr')!;

describe('F1 — usando o que o backend novo entrega', () => {
  it('Serviços: pede incluirInativos=true, usa pedidosNoMes do servidor e reativa um serviço que já veio inativo', async () => {
    db.servicos.find((s) => s.id === 5)!.ativo = false; // inativo desde antes de "recarregar"
    const pedidos: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const u = new URL(request.url);
      if (u.pathname.endsWith('/servicos')) pedidos.push(u.search);
      if (u.pathname.endsWith('/pedidos')) pedidos.push('PEDIDOS');
    });
    await entrarComo('/servicos', gerente);
    const r = await linha('Lacre / desamassamento');
    expect(within(r).getByRole('switch')).not.toBeChecked();
    expect(pedidos).toContain('?incluirInativos=true');
    expect(pedidos).not.toContain('PEDIDOS'); // não conta mais a partir de GET /pedidos?size=500
    const col = within(r).getAllByRole('cell')[3];
    expect(col).toHaveTextContent(/^\d+$/); // pedidosNoMes do servidor, sem "…"

    await userEvent.click(within(r).getByRole('switch'));
    await screen.findByText('Lacre / desamassamento ativado');
    expect(db.servicos.find((s) => s.id === 5)!.ativo).toBe(true);
  });

  it('Clientes: "Pedidos" vem de totalPedidos (sem uma chamada por cliente)', async () => {
    const chamadas: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const u = new URL(request.url);
      if (u.pathname.endsWith('/pedidos')) chamadas.push(u.search);
    });
    await entrarComo('/clientes');
    const r = await linha('Renata Sampaio');
    const esperado = db.pedidos.filter((p) => p.cliente.nome === 'Renata Sampaio').length;
    expect(within(r).getAllByRole('cell').some((c) => c.textContent === String(esperado))).toBe(true);
    expect(chamadas).toHaveLength(0);
  });

  it('Dashboard: tempo médio mostra a tendência (▼ verde quando melhora) e os mais vendidos pedem os últimos 30 dias', async () => {
    const maisVendidos: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const u = new URL(request.url);
      if (u.pathname.endsWith('/servicos-mais-vendidos')) maisVendidos.push(u.search);
    });
    server.use(http.get(`${API}/dashboard/tempo-medio-producao`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      expect(q.get('de') && q.get('ate')).toBeTruthy();
      return HttpResponse.json({ horasMedia: 2, pedidosConsiderados: 4, horasMediaPeriodoAnterior: 2.5 });
    }));
    await entrarComo('/dashboard', gerente);
    const tempo = await cartao('Tempo médio de produção');
    expect(await within(tempo).findByText(/30 min mais rápido que nos 7 dias anteriores/)).toHaveClass('text-ok');
    expect(tempo).toHaveTextContent('2h');
    await cartao('Serviços mais vendidos');
    await waitFor(() => expect(maisVendidos[0]).toMatch(/^\?de=\d{4}-\d{2}-\d{2}&ate=\d{4}-\d{2}-\d{2}$/));
    const [, de, ate] = maisVendidos[0]!.match(/de=([\d-]+)&ate=([\d-]+)/)!;
    expect((Date.parse(ate!) - Date.parse(de!)) / 86_400_000).toBe(29);
  });

  it('Dashboard: tempo médio mais lento aparece em vermelho (▲)', async () => {
    server.use(http.get(`${API}/dashboard/tempo-medio-producao`, () =>
      HttpResponse.json({ horasMedia: 3, pedidosConsiderados: 2, horasMediaPeriodoAnterior: 2 })));
    await entrarComo('/dashboard', gerente);
    const tempo = await cartao('Tempo médio de produção');
    expect(await within(tempo).findByText(/1h mais lento que nos 7 dias anteriores/)).toHaveClass('text-erro');
  });

  it('Veículo novo: "Consultar placa" salva só a placa, avisa que a consulta não está disponível e o cadastro é completado com PUT', async () => {
    await entrarComo('/clientes/3?aba=veiculos');
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo veículo' }));
    const f = screen.getByRole('form', { name: 'Novo veículo' });
    await userEvent.type(within(f).getByLabelText(/^Placa/), 'QWE1R23');
    await userEvent.click(within(f).getByRole('button', { name: 'Consultar placa' }));
    expect(await screen.findByText(/Consulta veicular ainda não está disponível\. A placa foi salva/)).toBeInTheDocument();
    const parcial = db.veiculos.at(-1)!;
    expect(parcial).toMatchObject({ placa: 'QWE1R23', clienteId: 3, marcaModelo: null, anoFabricacao: null });
    expect(within(f).getByLabelText(/^Placa/)).toHaveAttribute('readonly');

    // segunda consulta não cria outro veículo
    await userEvent.click(within(f).getByRole('button', { name: 'Consultar placa' }));
    await waitFor(() => expect(within(f).getByRole('button', { name: 'Consultar placa' })).toBeEnabled());
    expect(db.veiculos.filter((v) => v.placa === 'QWE1R23')).toHaveLength(1);

    await userEvent.type(within(f).getByLabelText('Marca / modelo'), 'Fiat Uno');
    await userEvent.type(within(f).getByLabelText('Ano de fabricação'), '2015');
    await userEvent.type(within(f).getByLabelText('Ano do modelo'), '2016');
    await userEvent.click(within(f).getByRole('button', { name: 'Salvar veículo' }));
    expect(await screen.findByText('Fiat Uno')).toBeInTheDocument();
    expect(db.veiculos.filter((v) => v.placa === 'QWE1R23')).toHaveLength(1);
    expect(db.veiculos.find((v) => v.placa === 'QWE1R23')).toMatchObject({ marcaModelo: 'Fiat Uno', anoFabricacao: 2015, anoModelo: 2016 });
  });

  it('Veículo novo: se a consulta devolver dados, o formulário é preenchido para conferência', async () => {
    server.use(http.post(`${API}/veiculos/:id/consultar`, () =>
      HttpResponse.json({ marcaModelo: 'VW Gol 1.6', anoFabricacao: 2018, anoModelo: 2019, chassi: '9BWZZZ377VT004251' })));
    await entrarComo('/clientes/3?aba=veiculos');
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo veículo' }));
    const f = screen.getByRole('form', { name: 'Novo veículo' });
    await userEvent.type(within(f).getByLabelText(/^Placa/), 'RTY2U34');
    await userEvent.click(within(f).getByRole('button', { name: 'Consultar placa' }));
    await screen.findByText('Dados preenchidos pela consulta. Confira e salve.');
    expect(within(f).getByLabelText('Marca / modelo')).toHaveValue('VW Gol 1.6');
    expect(within(f).getByLabelText('Ano do modelo')).toHaveValue('2019');
    expect(within(f).getByLabelText(/^Chassi/)).toHaveValue('9BWZZZ377VT004251');
  });

  it('Veículo novo: placa já cadastrada (400 do backend) aparece no campo e nada é duplicado', async () => {
    await entrarComo('/clientes/3?aba=veiculos');
    await userEvent.click(await screen.findByRole('button', { name: '+ Novo veículo' }));
    const f = screen.getByRole('form', { name: 'Novo veículo' });
    await userEvent.type(within(f).getByLabelText(/^Placa/), 'DPT7B02'); // já existe nas fixtures
    await userEvent.click(within(f).getByRole('button', { name: 'Consultar placa' }));
    expect(await within(f).findByText(/Já existe um veículo cadastrado com a placa DPT7B02/)).toBeInTheDocument();
    expect(db.veiculos.filter((v) => v.placa === 'DPT7B02')).toHaveLength(1);
  });

  it('Veículo parcial (só a placa) aparece como "Dados incompletos" nas listas', async () => {
    db.veiculos.push({ id: 900, placa: 'ZZZ9Z99', marcaModelo: null, anoFabricacao: null, anoModelo: null, chassi: null, clienteId: 3, clienteNome: db.clientes.find((c) => c.id === 3)!.nome });
    await entrarComo('/veiculos');
    const r = await linha('Dados incompletos');
    expect(r).toHaveTextContent('—');
  });
});
