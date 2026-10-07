import { forwardRef, useState } from 'react';
import type { Pagamento, Pedido } from '@/api/types';
import { Cartao } from '@/components/Cartao';
import { Money } from '@/components/Money';
import { MoneyInput } from '@/components/MoneyInput';
import { FORMA_PAGAMENTO, type FormaPagamento } from '@/components/status';
import { dataHora } from '@/lib/datas';
import { fmt } from '@/lib/money';
import { useRegistrarPagamento } from './api';

type Props = { pedido: Pedido; pagamentos: Pagamento[] };

/**
 * Serviço, valor e pagamentos. Como no backend, o pedido só está pago (`pedido.pago`) quando a **soma** dos
 * pagamentos chega ao preço do serviço: dá para registrar parcelas até quitar (valor editável, padrão = saldo).
 */
export const PagamentoCard = forwardRef<HTMLSelectElement, Props>(function PagamentoCard({ pedido, pagamentos }, ref) {
  const [forma, setForma] = useState<FormaPagamento>('PIX');
  const [valorEditado, setValorEditado] = useState<number | null>(null); // null = acompanha o saldo
  const [erro, setErro] = useState<string | null>(null);
  const registrar = useRegistrarPagamento(pedido.id);

  const preco = pedido.servico.precoCentavos;
  const pagos = pagamentos.filter((p) => p.status === 'PAGO').sort((a, b) => a.pagoEm.localeCompare(b.pagoEm));
  const totalPago = pagos.reduce((t, p) => t + p.valorCentavos, 0);
  const saldo = Math.max(0, preco - totalPago);
  const valor = valorEditado ?? saldo;
  const cancelado = pedido.status === 'CANCELADO';

  const enviar = () => {
    if (valor <= 0) { setErro('Informe um valor maior que zero.'); return; }
    setErro(null);
    registrar.mutate({ valorCentavos: valor, formaPagamento: forma }, { onSuccess: () => setValorEditado(null) });
  };

  return (
    <Cartao titulo="Serviço e pagamento">
      <div className="text-base">{pedido.servico.nome}</div>
      <Money centavos={preco} className="mt-1 block font-display text-[28px] font-bold leading-tight" />

      <div className="mt-3 border-t border-linha-fraca pt-3">
        {pagos.length > 0 && (
          <>
            <p className={pedido.pago ? 'text-base font-semibold text-ok' : 'text-base font-semibold text-alerta-texto'}>
              {pedido.pago ? `Pago · ${fmt(totalPago)}` : `Pago ${fmt(totalPago)} de ${fmt(preco)}`}
            </p>
            <ul aria-label="Pagamentos registrados" className="mb-2 mt-1 flex flex-col gap-0.5 text-sm text-aco">
              {pagos.map((p) => (
                <li key={p.id}>
                  {FORMA_PAGAMENTO[p.formaPagamento].label} · <span className="tabular-nums">{fmt(p.valorCentavos)}</span> · {dataHora(p.pagoEm).toLowerCase()} · {p.registradoPor}
                </li>
              ))}
            </ul>
          </>
        )}

        {pedido.pago ? null : cancelado ? (
          <p className="text-base text-aco">Pedido cancelado — sem pagamento a registrar.</p>
        ) : (
          <>
            {pagos.length > 0 && <p className="mb-2 text-sm font-semibold text-alerta-texto">Saldo restante: {fmt(saldo)}</p>}
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="text-xs text-aco">
                Forma
                <select
                  ref={ref} value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}
                  className="mt-1 block h-[30px] rounded border border-linha-forte bg-white px-2 text-sm text-grafite"
                >
                  {(Object.keys(FORMA_PAGAMENTO) as FormaPagamento[]).map((f) => (
                    <option key={f} value={f}>{FORMA_PAGAMENTO[f].label}</option>
                  ))}
                </select>
              </label>
              <div>
                <label htmlFor="valor-pagamento" className="text-xs text-aco">Valor</label>
                <MoneyInput
                  id="valor-pagamento" value={valor} onChange={(c) => { setValorEditado(c); setErro(null); }}
                  aria-invalid={!!erro} className="mt-1 block w-[130px]"
                />
              </div>
              <button
                type="button" disabled={registrar.isPending} onClick={enviar}
                className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60"
              >
                {registrar.isPending ? 'Registrando…' : 'Registrar pagamento'}
              </button>
            </div>
            {erro && <p role="alert" className="mt-1.5 text-xs text-erro">{erro}</p>}
            {!erro && valor > 0 && valor < saldo && (
              <p role="note" className="mt-1.5 text-xs text-aco">Pagamento parcial: o pedido continua com saldo de {fmt(saldo - valor)} depois deste.</p>
            )}
            {!erro && valor > saldo && <p role="note" className="mt-1.5 text-xs text-aco">Valor acima do saldo de {fmt(saldo)}.</p>}
          </>
        )}
      </div>
    </Cartao>
  );
});
