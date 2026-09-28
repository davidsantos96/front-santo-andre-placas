import { forwardRef, useState } from 'react';
import type { Pagamento, Pedido } from '@/api/types';
import { Cartao } from '@/components/Cartao';
import { Money } from '@/components/Money';
import { FORMA_PAGAMENTO, type FormaPagamento } from '@/components/status';
import { dataHora } from '@/lib/datas';
import { useRegistrarPagamento } from './api';

type Props = { pedido: Pedido; pagamento?: Pagamento };

/** Serviço + valor; pago → texto verde; não pago → select Forma + "Registrar pagamento". */
export const PagamentoCard = forwardRef<HTMLSelectElement, Props>(function PagamentoCard({ pedido, pagamento }, ref) {
  const [forma, setForma] = useState<FormaPagamento>('PIX');
  const registrar = useRegistrarPagamento(pedido.id);
  const cancelado = pedido.status === 'CANCELADO';

  return (
    <Cartao titulo="Serviço e pagamento">
      <div className="text-base">{pedido.servico.nome}</div>
      <Money centavos={pedido.servico.precoCentavos} className="mt-1 block font-display text-[28px] font-bold leading-tight" />

      <div className="mt-3 border-t border-linha-fraca pt-3">
        {pagamento ? (
          <p className="text-base font-semibold text-ok">
            Pago via {FORMA_PAGAMENTO[pagamento.formaPagamento].label} · {dataHora(pagamento.pagoEm).toLowerCase()} · {pagamento.registradoPor}
          </p>
        ) : cancelado ? (
          <p className="text-base text-aco">Pedido cancelado — sem pagamento a registrar.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2.5">
            <label className="text-xs text-aco">
              Forma
              <select
                ref={ref}
                value={forma}
                onChange={(e) => setForma(e.target.value as FormaPagamento)}
                className="mt-1 block h-[30px] rounded border border-linha-forte bg-white px-2 text-sm text-grafite"
              >
                {(Object.keys(FORMA_PAGAMENTO) as FormaPagamento[]).map((f) => (
                  <option key={f} value={f}>{FORMA_PAGAMENTO[f].label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={registrar.isPending}
              onClick={() => registrar.mutate({ valorCentavos: pedido.servico.precoCentavos, formaPagamento: forma })}
              className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60"
            >
              {registrar.isPending ? 'Registrando…' : 'Registrar pagamento'}
            </button>
          </div>
        )}
      </div>
    </Cartao>
  );
});
