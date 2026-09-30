import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlacaBadge } from './PlacaBadge';
import { StatusBadge } from './StatusBadge';
import { MoneyInput } from './MoneyInput';
import { SegmentedControl } from './SegmentedControl';
import { STATUS, type StatusPedido } from './status';

describe('PlacaBadge', () => {
  it.each(['sm', 'md', 'lg'] as const)('renderiza no tamanho %s', (tam) => {
    render(<PlacaBadge placa="abc-1d23" tam={tam} />);
    const el = screen.getByRole('img', { name: 'Placa ABC1D23' });
    expect(el).toHaveTextContent('ABC1D23');
    expect(screen.getByText('BRASIL')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('StatusBadge', () => {
  it.each(Object.keys(STATUS) as StatusPedido[])('mostra o texto de %s', (s) => {
    render(<StatusBadge status={s} />);
    expect(screen.getByText(STATUS[s].label)).toBeInTheDocument();
  });
});

describe('MoneyInput', () => {
  it('digitar "31690" vira R$ 316,90 e emite 31690', async () => {
    let emitido = 0;
    function Wrap() {
      const [v, setV] = useState(0);
      return <MoneyInput aria-label="Preço" value={v} onChange={(c) => { emitido = c; setV(c); }} />;
    }
    render(<Wrap />);
    await userEvent.type(screen.getByLabelText('Preço'), '31690');
    expect((screen.getByLabelText('Preço') as HTMLInputElement).value.replace(/ /g, ' ')).toBe('R$ 316,90');
    expect(emitido).toBe(31690);
  });
});

describe('MoneyInput — posição do cursor', () => {
  function Campo() {
    const [v, setV] = useState(0);
    return <MoneyInput aria-label="Preço" value={v} onChange={setV} />;
  }
  const texto = () => (screen.getByLabelText('Preço') as HTMLInputElement).value.replace(/\u00a0/g, ' ');

  it('cursor no INÍCIO do campo: 31690 continua virando R$ 316,90 (antes virava R$ 300.016,90)', async () => {
    render(<Campo />);
    await userEvent.type(screen.getByLabelText('Preço'), '31690', { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(texto()).toBe('R$ 316,90');
  });

  it('cursor no MEIO do campo também anexa ao final', async () => {
    render(<Campo />);
    await userEvent.type(screen.getByLabelText('Preço'), '31690', { initialSelectionStart: 3, initialSelectionEnd: 3 });
    expect(texto()).toBe('R$ 316,90');
  });

  it('com o texto selecionado, digitar SUBSTITUI o valor (não anexa ao antigo)', async () => {
    function Campo316() {
      const [v, setV] = useState(31690);
      return <MoneyInput aria-label="Preço" value={v} onChange={setV} />;
    }
    render(<Campo316 />);
    const campo = screen.getByLabelText('Preço') as HTMLInputElement;
    expect(texto()).toBe('R$ 316,90');
    await userEvent.tripleClick(campo); // seleciona tudo
    await userEvent.keyboard('10000');
    expect(texto()).toBe('R$ 100,00');
  });

  it('ignora letras, apaga o último dígito no Backspace e respeita o teto', async () => {
    render(<Campo />);
    const campo = screen.getByLabelText('Preço');
    await userEvent.type(campo, 'a1b2c3');
    expect(texto()).toBe('R$ 1,23');
    await userEvent.keyboard('{Backspace}');
    expect(texto()).toBe('R$ 0,12');
    await userEvent.type(campo, '99999999999');
    expect(texto()).toBe('R$ 9.999.999,99');
  });
});

describe('SegmentedControl', () => {
  it('navega por setas', async () => {
    function Wrap() {
      const [v, setV] = useState<'a' | 'b'>('a');
      return <SegmentedControl ariaLabel="x" valor={v} onChange={setV} opcoes={[{ valor: 'a', label: 'A' }, { valor: 'b', label: 'B' }]} />;
    }
    render(<Wrap />);
    screen.getByRole('radio', { name: 'A' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked();
  });
});
