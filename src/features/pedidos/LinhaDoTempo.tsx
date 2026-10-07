import clsx from 'clsx';
import type { HistoricoStatus } from '@/api/types';
import { FLUXO, STATUS, type StatusPedido } from '@/components/status';
import { dataHora } from '@/lib/datas';

/** Bolinhas ligadas por linha vertical; preenchidas nos passos concluídos (spec §7.4). */
export function LinhaDoTempo({ historico, status }: { historico: HistoricoStatus[]; status: StatusPedido }) {
  const passos: StatusPedido[] = status === 'CANCELADO' ? [...FLUXO.filter((s) => historico.some((h) => h.statusNovo === s)), 'CANCELADO'] : FLUXO;
  return (
    <ol aria-label="Histórico do pedido">
      {passos.map((s, i) => {
        const h = [...historico].reverse().find((x) => x.statusNovo === s);
        const feito = !!h;
        const ultimo = i === passos.length - 1;
        return (
          <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
            {!ultimo && (
              <span aria-hidden="true" className={clsx('absolute left-[6px] top-[14px] h-[calc(100%-10px)] w-[2px]', feito ? 'bg-mercosul' : 'bg-linha')} />
            )}
            <span
              aria-hidden="true"
              className={clsx(
                'relative z-10 mt-[3px] h-[14px] w-[14px] shrink-0 rounded-full border-2',
                feito ? (s === 'CANCELADO' ? 'border-erro bg-erro' : 'border-mercosul bg-mercosul') : 'border-linha-forte bg-white',
              )}
            />
            <div className="min-w-0">
              <div className={clsx('text-base font-semibold', feito ? 'text-grafite' : 'text-aco')}>
                {STATUS[s].label}
                {!feito && <span className="sr-only"> (pendente)</span>}
              </div>
              {h && <div className="text-xs text-aco">{h.alteradoPor} · {dataHora(h.alteradoEm)}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
