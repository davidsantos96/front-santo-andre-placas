import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { entrarComo } from './utils';
import { server } from '@/mocks/server';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

const gerente = 'gerente@sap.com';
const kpi = async (rotulo: string) => (await screen.findByText(rotulo)).parentElement!;
const cartao = async (titulo: string) => (await screen.findByRole('heading', { name: titulo })).closest('section')!;

describe('Dashboard', () => {
  it('KPIs vêm do resumo: pedidos hoje, em produção, prontos e faturamento (destaque)', async () => {
    await entrarComo('/dashboard', gerente);
    await waitFor(async () => expect(await kpi('PEDIDOS HOJE')).toHaveTextContent('8'));
    expect(await kpi('EM PRODUÇÃO')).toHaveTextContent('3');
    expect(await kpi('PRONTOS PARA ENTREGA')).toHaveTextContent('2');
    expect(await kpi('FATURAMENTO HOJE')).toHaveTextContent(/R\$\s814,90/);
    expect((await kpi('FATURAMENTO HOJE')).className).toContain('bg-noite');
  });

  it('faturamento: gráfico com resumo acessível, visão em tabela e troca de período (7/14/30)', async () => {
    await entrarComo('/dashboard', gerente);
    const card = await cartao('Faturamento');
    const grafico = await within(card).findByRole('img', { name: /últimos 7 dias: total R\$\s1\.669,80/ });
    expect(grafico).toBeInTheDocument();
    expect(within(card).getByText(/Total no período/)).toHaveTextContent(/R\$\s1\.669,80/);

    await userEvent.click(within(card).getByRole('button', { name: 'Ver como tabela' }));
    const tabela = within(card).getByRole('table');
    expect(within(tabela).getAllByRole('row')).toHaveLength(1 + 7); // cabeçalho + 7 dias (dias sem faturamento entram com R$ 0,00)
    expect(within(tabela).getAllByText(/R\$\s0,00/).length).toBeGreaterThanOrEqual(3);

    await userEvent.click(within(card).getByRole('radio', { name: '14 dias' }));
    await waitFor(() => expect(within(card).getAllByRole('row')).toHaveLength(1 + 14));
    await userEvent.click(within(card).getByRole('radio', { name: '30 dias' }));
    await waitFor(() => expect(within(card).getAllByRole('row')).toHaveLength(1 + 30));

    await userEvent.click(within(card).getByRole('button', { name: 'Ver gráfico' }));
    expect(await within(card).findByRole('img', { name: /últimos 30 dias/ })).toBeInTheDocument();
  });

  it('faturamento personalizado: datas livres, validação e resumo do intervalo', async () => {
    await entrarComo('/dashboard', gerente);
    const card = await cartao('Faturamento');
    await within(card).findByRole('img', { name: /dos últimos 7 dias/ });
    await userEvent.click(within(card).getByRole('radio', { name: 'Personalizado' }));

    const de = within(card).getByLabelText('De') as HTMLInputElement;
    const ate = within(card).getByLabelText('Até') as HTMLInputElement;
    const hoje = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const tresDiasAtras = new Date(hoje); tresDiasAtras.setDate(hoje.getDate() - 2);
    expect(ate.value).toBe(iso(hoje)); // padrão: últimos 30 dias
    const inicioPadrao = new Date(hoje); inicioPadrao.setDate(hoje.getDate() - 29);
    expect(de.value).toBe(iso(inicioPadrao));

    // período válido de 3 dias
    fireEvent.change(de, { target: { value: iso(tresDiasAtras) } });
    const br = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    await within(card).findByRole('img', { name: new RegExp(`de ${br(tresDiasAtras)} a ${br(hoje)}: total`) });
    await userEvent.click(within(card).getByRole('button', { name: 'Ver como tabela' }));
    await waitFor(() => expect(within(card).getAllByRole('row')).toHaveLength(1 + 3));

    // de depois de até → erro, sem consultar (mantém o que está na tela)
    fireEvent.change(de, { target: { value: iso(new Date(hoje.getTime() + 86_400_000 * 2)) } });
    expect(await within(card).findByRole('alert')).toHaveTextContent('A data inicial não pode ser depois da data final.');

    // janela grande demais (> 366 dias)
    fireEvent.change(de, { target: { value: '2020-01-01' } });
    expect(await within(card).findByRole('alert')).toHaveTextContent('no máximo 366 dias');

    // 366 dias exatos é aceito e gera 366 linhas
    const inicio366 = new Date(hoje); inicio366.setDate(hoje.getDate() - 365);
    fireEvent.change(de, { target: { value: iso(inicio366) } });
    await waitFor(() => expect(within(card).queryByRole('alert')).not.toBeInTheDocument());
    await waitFor(() => expect(within(card).getAllByRole('row')).toHaveLength(1 + 366));
  });

  it('serviços mais vendidos: barras proporcionais com nome e contagem em texto', async () => {
    await entrarComo('/dashboard', gerente);
    const card = await cartao('Serviços mais vendidos');
    const itens = await within(card).findAllByRole('listitem');
    expect(itens).toHaveLength(5);
    expect(itens[0]).toHaveTextContent('Par de placas Mercosul (carro)');
    expect(itens[0]).toHaveTextContent('4');
    expect(itens[4]).toHaveTextContent('Lacre / desamassamento');
    const largura = (li: HTMLElement) => (li.querySelector('[style*="width"]') as HTMLElement).style.width;
    expect(largura(itens[0])).toBe('100%'); // o maior
    expect(largura(itens[4])).toBe('25%'); // 1 de 4
  });

  it('tempo médio de produção em horas/minutos, sem tendência', async () => {
    await entrarComo('/dashboard', gerente);
    const card = await cartao('Tempo médio de produção');
    await within(card).findByText(/5 pedidos considerados/);
    expect(within(card).getByText(/min|h/, { selector: 'div' })).toBeInTheDocument();
    expect(card).not.toHaveTextContent('vs semana passada');
  });

  it('origem dos pedidos (últimos 7 dias): contagem e % por origem', async () => {
    await entrarComo('/dashboard', gerente);
    const card = await cartao('Origem dos pedidos');
    const itens = await within(card).findAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Balcão');
    expect(itens[0]).toHaveTextContent('5 · 45%');
    expect(itens[1]).toHaveTextContent('WhatsApp');
    expect(itens[1]).toHaveTextContent('4 · 36%');
    expect(itens[2]).toHaveTextContent('Telefone');
    expect(itens[2]).toHaveTextContent('2 · 18%');
  });

  it('fila de produção: recebidos + em processamento + placa pronta, mais antigos primeiro, "+ N na fila"', async () => {
    const { router } = await entrarComo('/dashboard', gerente);
    const card = await cartao('Fila de produção');
    const botoes = await within(card).findAllByRole('button');
    expect(botoes).toHaveLength(6); // mostra 6 de 8 (Recebido 3 + Em processamento 3 + Placa pronta 2)
    expect(within(card).getByText('+ 2 na fila')).toBeInTheDocument();
    expect(botoes[0]).toHaveAccessibleName(/Pedido 1051/); // o mais antigo (placa pronta há 6h15) vem primeiro
    expect(within(card).getByRole('button', { name: /Pedido 1052/ })).toBeInTheDocument(); // placa pronta entra na fila
    await userEvent.click(within(card).getByRole('button', { name: /Pedido 1053/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos/1053'));
  });

  it('o espaço de metas só existe com a feature flag ativa (desligada por padrão)', async () => {
    await entrarComo('/dashboard', gerente);
    await cartao('Fila de produção');
    expect(screen.queryByText('Progresso de metas')).not.toBeInTheDocument();
  });

  it('erro em um cartão não derruba os outros e oferece "Tentar novamente"', async () => {
    server.use(http.get('http://localhost:8080/api/dashboard/resumo', () => HttpResponse.json({ mensagem: 'x' }, { status: 500 })));
    await entrarComo('/dashboard', gerente);
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(await cartao('Origem dos pedidos')).toHaveTextContent('Balcão');
  });

  it('registrar pagamento invalida o dashboard: faturamento de hoje atualiza ao voltar', async () => {
    const { router } = await entrarComo('/dashboard', gerente);
    await waitFor(async () => expect(await kpi('FATURAMENTO HOJE')).toHaveTextContent(/R\$\s814,90/));
    await router.navigate('/pedidos/1058');
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
    await screen.findByText(/^Pago · R\$\s316,90/);
    await router.navigate('/dashboard');
    await waitFor(async () => expect(await kpi('FATURAMENTO HOJE')).toHaveTextContent(/R\$\s1\.131,80/));
  });

  it('ATENDENTE é redirecionado para /pedidos', async () => {
    const { router } = await entrarComo('/pedidos');
    await screen.findByRole('navigation', { name: 'Navegação principal' });
    await router.navigate('/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/pedidos'));
  });
});
