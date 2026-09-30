import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import { digitosParaCentavos, fmt } from '@/lib/money';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (centavos: number) => void;
};

/** Teto: R$ 9.999.999,99 (mantém o valor longe de estourar inteiros seguros). */
const MAX_CENTAVOS = 999_999_999;

/**
 * Mostra "R$ 1.234,56" enquanto digita dígitos e emite **centavos** (number).
 *
 * Cada dígito digitado é **anexado ao final**, onde quer que esteja o cursor. Sem isso, com o cursor no
 * meio/início de "R$ 0,00" o dígito entrava no lugar errado e o valor explodia (ex.: 31690 → 30.001.690).
 */
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
      onChange={(e) => {
        const ev = e.nativeEvent as InputEvent;
        if (ev.inputType === 'insertText' && ev.data != null) {
          const digitos = ev.data.replace(/\D/g, '');
          // tecla não numérica é ignorada (o valor controlado restaura o texto)
          if (digitos) onChange(Math.min(MAX_CENTAVOS, Number(`${value}${digitos}`)));
          return;
        }
        // apagar, recortar, colar, autopreenchimento…: usa os dígitos do texto resultante
        onChange(Math.min(MAX_CENTAVOS, digitosParaCentavos(e.target.value)));
      }}
    />
  );
});
