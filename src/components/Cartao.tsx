import type { ReactNode } from 'react';
import clsx from 'clsx';

/** Card branco simples com título opcional (detalhe do pedido, blocos do novo pedido). */
export function Cartao({ titulo, children, className }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-md border border-linha bg-white p-4 shadow-card', className)}>
      {titulo && <h2 className="mb-3 font-display text-[14px] font-bold uppercase tracking-[0.5px] text-aco">{titulo}</h2>}
      {children}
    </section>
  );
}
