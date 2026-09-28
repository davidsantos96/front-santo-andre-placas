import type { ReactNode } from 'react';
import clsx from 'clsx';

type Props = { rotulo: string; valor: ReactNode; sub?: ReactNode; destaque?: boolean; marcador?: string };

export function KpiCard({ rotulo, valor, sub, destaque, marcador }: Props) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-md border shadow-card',
        destaque ? 'border-noite bg-noite text-white' : 'border-linha bg-white',
      )}
    >
      <div
        className={clsx(
          'h-[22px] text-center font-display text-[11px] font-bold leading-[22px] tracking-[1.2px]',
          destaque ? 'bg-mercosul text-white' : 'bg-mercosul-faixa text-mercosul-tinta',
        )}
      >
        {marcador && (
          <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2" style={{ backgroundColor: marcador }} />
        )}
        {rotulo}
      </div>
      <div className="px-4 pb-[13px] pt-3 text-center">
        <div className="whitespace-nowrap font-display text-[clamp(20px,2.2vw,28px)] font-bold leading-none tabular-nums">
          {valor}
        </div>
        {sub && (
          <div className={clsx('mt-[7px] text-xs font-medium', destaque ? 'text-noite-sub' : 'text-aco')}>{sub}</div>
        )}
      </div>
    </div>
  );
}
