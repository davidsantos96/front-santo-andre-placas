import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { entrarComo } from './utils';
import { db } from '@/mocks/db';
import { reloginCancelado } from '@/api/sessaoEventos';

afterEach(() => reloginCancelado());

const status = (id: number) => db.pedidos.find((p) => p.id === id)!.status;

describe('Detalhe do pedido', () => {
  it('mostra veículo, cliente, serviço, valor e linha do tempo', async () => {
    await entrarComo('/pedidos/1058');
    expect(await screen.findByRole('heading', { name: '#1058' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Placa FZR4C71' })).toBeInTheDocument();
    expect(screen.getByText('Fiat Argo Drive 1.0')).toBeInTheDocument();
    expect(screen.getByText('2022/2023')).toBeInTheDocument();
    expect(screen.getByText('412.688.301-00')).toBeInTheDocument();
    expect(screen.getByText('Par de placas Mercosul (carro)')).toBeInTheDocument();
    const linha = screen.getByRole('list', { name: 'Histórico do pedido' });
    expect(within(linha).getByText(/Bruna Costa/)).toBeInTheDocument();
    expect(within(linha).getByText('Em processamento').closest('li')).toHaveTextContent('(pendente)');
  });

  it('RECEBIDO: aviso de baixa de estoque e "Iniciar processamento" avança o status e a linha do tempo', async () => {
    await entrarComo('/pedidos/1058');
    expect(await screen.findByRole('note')).toHaveTextContent('Baixa automática de estoque: −1 Placa Mercosul carro (par), −2 Lacre inviolável'); // itens vêm de /estoque/vinculos
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar processamento' }));
    await screen.findByRole('button', { name: 'Marcar placa pronta' });
    expect(status(1058)).toBe('EM_PROCESSAMENTO');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    const linha = screen.getByRole('list', { name: 'Histórico do pedido' });
    await waitFor(() => expect(within(linha).getByText('Em processamento').closest('li')).not.toHaveTextContent('(pendente)'));
  });

  it('iniciar processamento com estoque insuficiente: o backend recusa (400) e o status não muda', async () => {
    db.estoque.find((i) => i.sku === 'LAC-STD')!.quantidade = 1; // o serviço consome 2
    await entrarComo('/pedidos/1058');
    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar processamento' }));
    expect(await screen.findByText(/Estoque insuficiente para "Lacre inviolável": disponível 1, necessário 2/)).toBeInTheDocument();
    expect(status(1058)).toBe('RECEBIDO');
    expect(screen.getByRole('button', { name: 'Iniciar processamento' })).toBeInTheDocument();
  });

  it('registra pagamento (forma escolhida; valor padrão = saldo) e passa a mostrar "Pago"', async () => {
    await entrarComo('/pedidos/1058');
    await screen.findByRole('heading', { name: '#1058' });
    expect((screen.getByLabelText('Valor') as HTMLInputElement).value.replace(/\u00a0/g, ' ')).toBe('R$ 316,90');
    await userEvent.selectOptions(screen.getByLabelText('Forma'), 'DINHEIRO');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    expect(await screen.findByText(/^Pago · R\$\s316,90/)).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Pagamentos registrados' });
    const item = within(lista).getByRole('listitem');
    expect(item).toHaveTextContent(/Dinheiro · R\$\s316,90 · hoje/);
    expect(item).toHaveTextContent('Bruna Costa');
    expect(await screen.findByText(/Pagamento registrado — R\$\s316,90 via Dinheiro/)).toBeInTheDocument();
    expect(db.pagamentos.find((p) => p.pedidoId === 1058)).toMatchObject({ formaPagamento: 'DINHEIRO', valorCentavos: 31690 });
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
  });

  it('pagamento parcial (como o backend: pago só quando a soma chega ao preço): mostra saldo e mantém o formulário', async () => {
    await entrarComo('/pedidos/1058');
    await screen.findByRole('heading', { name: '#1058' });
    const valor = screen.getByLabelText('Valor');
    await userEvent.clear(valor);
    await userEvent.type(valor, '10000');
    expect(await screen.findByText(/Pagamento parcial: o pedido continua com saldo de R\$\s216,90/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));

    expect(await screen.findByText(/Pago R\$\s100,00 de R\$\s316,90/)).toBeInTheDocument();
    expect(screen.getByText(/Saldo restante: R\$\s216,90/)).toBeInTheDocument();
    expect(screen.queryByText(/^Pago · /)).not.toBeInTheDocument(); // ainda não quitado
    expect((screen.getByLabelText('Valor') as HTMLInputElement).value.replace(/\u00a0/g, ' ')).toBe('R$ 216,90'); // padrão = novo saldo

    await userEvent.selectOptions(screen.getByLabelText('Forma'), 'PIX');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    expect(await screen.findByText(/^Pago · R\$\s316,90/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Pagamentos registrados' })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument();
  });

  it('valor zero é recusado; valor acima do saldo apenas avisa', async () => {
    await entrarComo('/pedidos/1058');
    await screen.findByRole('heading', { name: '#1058' });
    const valor = screen.getByLabelText('Valor');
    await userEvent.clear(valor);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe um valor maior que zero.');
    expect(db.pagamentos.some((p) => p.pedidoId === 1058)).toBe(false);
    await userEvent.type(valor, '40000');
    expect(await screen.findByText(/Valor acima do saldo de R\$\s316,90/)).toBeInTheDocument();
  });

  it('PLACA_PRONTA sem pagamento: "Registrar entrega" pede confirmação', async () => {
    await entrarComo('/pedidos/1051');
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }));
    const d = await screen.findByRole('dialog', { name: 'Entregar sem pagamento?' });
    await userEvent.click(within(d).getByRole('button', { name: 'Entregar mesmo assim' }));
    await waitFor(() => expect(status(1051)).toBe('ENTREGUE'));
  });

  it('ENTREGUE sem pagamento: o próximo passo vira "Registrar pagamento" e leva ao campo Forma', async () => {
    db.pedidos.find((p) => p.id === 1055)!.status = 'ENTREGUE';
    await entrarComo('/pedidos/1055');
    const botoes = await screen.findAllByRole('button', { name: 'Registrar pagamento' });
    expect(botoes).toHaveLength(2); // o do card de pagamento (esquerda) + o principal (direita)
    await userEvent.click(botoes[1]);
    expect(screen.getByLabelText('Forma')).toHaveFocus();
  });

  it('cancelar pelo menu pede confirmação e muda para CANCELADO', async () => {
    await entrarComo('/pedidos/1057');
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Cancelar pedido' }));
    const d = await screen.findByRole('dialog', { name: 'Cancelar pedido #1057?' });
    await userEvent.click(within(d).getByRole('button', { name: 'Cancelar pedido' }));
    await waitFor(() => expect(status(1057)).toBe('CANCELADO'));
    expect(await screen.findByText('Este pedido foi cancelado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais ações' })).not.toBeInTheDocument();
  });

  it('com a placa pronta não dá mais para cancelar (só Recebido e Em processamento)', async () => {
    await entrarComo('/pedidos/1052'); // PLACA_PRONTA
    await screen.findByRole('heading', { name: '#1052' });
    expect(screen.queryByRole('button', { name: 'Mais ações' })).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'Registrar entrega' });
  });

  it('em processamento ainda pode cancelar', async () => {
    await entrarComo('/pedidos/1055'); // EM_PROCESSAMENTO
    expect(await screen.findByRole('button', { name: 'Mais ações' })).toBeInTheDocument();
  });

  it('pedido inexistente mostra erro claro', async () => {
    await entrarComo('/pedidos/9999');
    expect(await screen.findByText('Pedido não encontrado.')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Pedidos' })).toBeInTheDocument();
  });
});
