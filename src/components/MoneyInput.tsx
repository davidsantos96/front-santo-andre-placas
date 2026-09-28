import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import { digitosParaCentavos, fmt } from '@/lib/money';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (centavos: number) => void;
};

/** Mostra "R$ 1.234,56" enquanto digita dígitos e emite centavos (number). */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      {...rest}
      className={clsx('h-[30px] rounded border border-linha-forte bg-white px-2 text-right text-sm tabular-nums', className)}
      value={fmt(value)}
      onChange={(e) => onChange(digitosParaCentavos(e.target.value))}
    />
  );
});
