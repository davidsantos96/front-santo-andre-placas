import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import { normalizarPlaca } from '@/lib/placa';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string;
  onChange: (placa: string) => void;
};

/** Campo de busca com estilo de placa: grande, `font-display`, maiúsculas automáticas, sem hífen. */
export const PlacaInput = forwardRef<HTMLInputElement, Props>(function PlacaInput({ value, onChange, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      maxLength={8}
      autoComplete="off"
      spellCheck={false}
      {...rest}
      value={value}
      onChange={(e) => onChange(normalizarPlaca(e.target.value))}
      className={clsx(
        'h-[46px] w-[220px] rounded-md border-[2px] border-grafite bg-white px-3 text-center font-display text-[26px] font-bold uppercase tracking-[3px] placeholder:text-[16px] placeholder:font-semibold placeholder:tracking-[1px] placeholder:text-aco',
        className,
      )}
    />
  );
});
