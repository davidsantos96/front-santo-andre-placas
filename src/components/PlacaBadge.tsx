import clsx from 'clsx';
import { normalizarPlaca } from '@/lib/placa';

type Tam = 'sm' | 'md' | 'lg';
type Props = { placa: string; tam?: Tam; className?: string };

const TAM: Record<Tam, { box: string; faixa: string; texto: string; indent: number }> = {
  sm: {
    box: 'w-[58px] border rounded-[3px]',
    faixa: 'h-2 text-[5px] tracking-[2px]',
    texto: 'text-[13px] leading-[17px] tracking-[0.5px]',
    indent: 2,
  },
  md: {
    box: 'w-[86px] border-[1.5px] rounded-[4px]',
    faixa: 'h-[11px] text-[6.5px] tracking-[2.5px]',
    texto: 'text-[19px] leading-[25px] tracking-[1px]',
    indent: 2.5,
  },
  lg: {
    box: 'w-[248px] border-[3px] rounded-[9px] shadow-placa',
    faixa: 'h-7 text-[14px] tracking-[7px]',
    texto: 'text-[54px] leading-[70px] tracking-[3px]',
    indent: 7,
  },
};

export function PlacaBadge({ placa, tam = 'sm', className }: Props) {
  const t = TAM[tam];
  const valor = normalizarPlaca(placa) || placa.toUpperCase();
  return (
    <span
      role="img"
      aria-label={`Placa ${valor}`}
      className={clsx('inline-flex shrink-0 flex-col overflow-hidden border-grafite bg-white text-center', t.box, className)}
    >
      <span
        aria-hidden="true"
        className={clsx('flex items-center justify-center bg-mercosul font-display font-bold leading-none text-white', t.faixa)}
        style={{ textIndent: t.indent }}
      >
        BRASIL
      </span>
      <span
        className={clsx('block whitespace-nowrap font-display font-bold text-grafite', t.texto)}
        style={{ textIndent: 0 }}
      >
        {valor}
      </span>
    </span>
  );
}
