import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { KpiCard } from '@/components/KpiCard';
import { Money } from '@/components/Money';
import { Pagina } from '@/components/Pagina';
import { periodoValido, SeletorPeriodo } from '@/components/SeletorPeriodo';
import { Skeleton } from '@/components/Skeleton';
import { Tabs, type AbaDef } from '@/components/Tabs';
import { FORMA_PAGAMENTO, type FormaPagamento } from '@/components/status';
import { dataExtenso, intervaloDoPeriodo, type Periodo } from '@/lib/datas';
import { useFechamentoCaixa, usePagamentos } from './api';
import { estadoTabela, PagamentosTabela } from './PagamentosTabela';

const FORMAS = Object.keys(FORMA_PAGAMENTO) as FormaPagamento[];
const nPag = (n: number) => `${n} ${n === 1 ? 'pagamento' : 'pagamentos'}`;

function useParam(chave: string) {
  const [sp, setSp] = useSearchParams();
  const set = (valor: string | undefined, extra?: Record<string, string | undefined>) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      const aplicar = (k: string, v: string | undefined) => (v ? n.set(k, v) : n.delete(k));
      aplicar(chave, valor);
      Object.entries(extra ?? {}).forEach(([k, v]) => aplicar(k, v));
      return n;
    }, { replace: true });
  return [sp.get(chave), set] as const;
}

/** Aba Pagamentos: `?periodo=` (padrão 7 dias) e `?forma=`. */
function AbaPagamentos({ periodo, forma, pagamentos }: { periodo: Periodo; forma?: FormaPagamento; pagamentos: ReturnType<typeof usePagamentos> }) {
  const [, setPeriodo] = useParam('periodo');
  const [, setForma] = useParam('forma');

  const lista = pagamentos.data ?? [];
  const total = lista.reduce((t, p) => t + p.valorCentavos, 0);

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-3.5">
        <SeletorPeriodo valor={periodo} onChange={(p) => setPeriodo(p)} />
        <label className="flex items-center gap-2 text-xs font-semibold text-aco">
          Forma
          <select
            value={forma ?? ''} onChange={(e) => setForma(e.target.value || undefined)}
            className="h-[30px] rounded border border-linha-forte bg-white px-2 text-sm font-normal text-grafite"
          >
            <option value="">Todas</option>
            {FORMAS.map((f) => <option key={f} value={f}>{FORMA_PAGAMENTO[f].label}</option>)}
          </select>
        </label>
        <div className="flex-1" />
        {pagamentos.isSuccess && (
          <div className="flex items-baseline gap-2.5 text-sm text-aco">
            <span className="tabular-nums">{nPag(lista.length)} ·</span>
            <Money centavos={total} className="font-display text-[19px] font-bold text-grafite" />
          </div>
        )}
      </div>
      <PagamentosTabela
        titulo="PAGAMENTOS REGISTRADOS · SP" pagamentos={lista} estado={estadoTabela(pagamentos)} onRetry={() => void pagamentos.refetch()}
        vazio={
          <EmptyState
            mensagem="Nenhum pagamento neste período com esse filtro."
            acao={{ label: 'Ver últimos 30 dias', onClick: () => setPeriodo('30', { forma: undefined }) }}
          />
        }
      />
    </div>
  );
}

/** Aba Caixa: relatório do período (sem abrir/fechar). `?cperiodo=` (padrão hoje). */
function AbaCaixa({ periodo, onPeriodo }: { periodo: Periodo; onPeriodo: (p: Periodo) => void }) {
  const { de, ate } = useMemo(() => intervaloDoPeriodo(periodo), [periodo]);
  const caixa = useFechamentoCaixa(de, ate);
  const pagamentos = usePagamentos({ de, ate });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5"><SeletorPeriodo valor={periodo} onChange={onPeriodo} /></div>

      {caixa.isPending ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5"><Skeleton className="h-[86px]" /><Skeleton className="h-[86px]" /></div>
      ) : caixa.isError ? (
        <ErrorState onRetry={() => void caixa.refetch()} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5 max-[899px]:grid-cols-2">
          {caixa.data.porFormaPagamento.map((f) => (
            <KpiCard
              key={f.formaPagamento} rotulo={FORMA_PAGAMENTO[f.formaPagamento].label.toUpperCase()}
              marcador={FORMA_PAGAMENTO[f.formaPagamento].cor}
              valor={<Money centavos={f.totalCentavos} />} sub={nPag(f.quantidade)}
            />
          ))}
          <KpiCard destaque rotulo="TOTAL DO PERÍODO" valor={<Money centavos={caixa.data.totalGeral} />} sub={nPag(caixa.data.quantidadePagamentos)} />
        </div>
      )}

      <PagamentosTabela
        titulo="PAGAMENTOS DO PERÍODO · SP" pagamentos={pagamentos.data ?? []} estado={estadoTabela(pagamentos)} onRetry={() => void pagamentos.refetch()}
        vazio={<EmptyState mensagem="Nenhum pagamento neste período." />}
      />
    </div>
  );
}

export function FinanceiroPage() {
  const [sp] = useSearchParams();
  const [, setCperiodo] = useParam('cperiodo');

  const periodo = periodoValido(sp.get('periodo'), '7');
  const forma = FORMAS.find((f) => f === sp.get('forma'));
  const cperiodo = periodoValido(sp.get('cperiodo'), 'hoje');

  // Lista de pagamentos no topo: a aba mostra a contagem filtrada na tag.
  const { de, ate } = useMemo(() => intervaloDoPeriodo(periodo), [periodo]);
  const pagamentos = usePagamentos({ de, ate, forma });

  // As abas vêm de um array: a Fase 2 do produto acrescenta A receber, A pagar, Balanço e Metas.
  const abas: AbaDef[] = [
    { id: 'pagamentos', label: 'Pagamentos', tag: pagamentos.data?.length, conteudo: <AbaPagamentos periodo={periodo} forma={forma} pagamentos={pagamentos} /> },
    { id: 'caixa', label: 'Caixa', conteudo: <AbaCaixa periodo={cperiodo} onPeriodo={(p) => setCperiodo(p)} /> },
  ];

  return (
    <Pagina titulo="Financeiro" contagem={<span className="first-letter:uppercase">{dataExtenso()}</span>}>
      <Tabs abas={abas} />
    </Pagina>
  );
}
