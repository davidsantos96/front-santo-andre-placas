import type { ReactNode } from 'react';

/** Moldura de tabela com identidade de placa. */
export function PlacaCard({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border-[1.5px] border-mercosul-borda bg-white shadow-placa">
      <header className="flex justify-between bg-mercosul px-3.5 py-[5px]">
        <span aria-hidden="true" className="font-display text-[11px] font-bold tracking-[2px] text-white">BRASIL</span>
        <h2 className="font-display text-2xs font-semibold tracking-[1.2px] text-mercosul-sub">{titulo}</h2>
      </header>
      {children}
    </section>
  );
}
