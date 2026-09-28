import type { ReactNode } from 'react';

/** Container e cabeçalho padrão de toda tela (spec §7). */
export function Pagina({ titulo, contagem, acoes, children }: {
  titulo: string; contagem?: ReactNode; acoes?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="max-w-[1200px] px-6 py-5">
      <div className="mb-3.5 flex items-center gap-3.5">
        <h1 className="font-display text-[22px] font-bold">{titulo}</h1>
        {contagem != null && <span className="text-sm tabular-nums text-aco">{contagem}</span>}
        <div className="flex-1" />
        {acoes}
      </div>
      {children}
    </div>
  );
}
