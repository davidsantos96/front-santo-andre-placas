import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import clsx from 'clsx';
import { Cartao } from '@/components/Cartao';
import { ErrorState } from '@/components/ErrorState';
import { Money } from '@/components/Money';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/Skeleton';
import { dataBR, diasDoIntervalo, intervaloUltimosDias, validarIntervalo } from '@/lib/datas';
import { fmt } from '@/lib/money';
import { useFaturamento } from './api';

const COR = '#003399'; // mercosul
type Modo = '7' | '14' | '30' | 'custom';
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Ponto = { data: string; rotulo: string; valor: number };

/** Tooltip: valor em destaque, dia secundário, chave em traço (não caixa). */
function Dica({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const ponto = payload?.[0]?.payload as Ponto | undefined;
  if (!active || !ponto) return null;
  return (
    <div className="rounded-md border border-linha bg-white px-3 py-2 shadow-placa">
      <div className="text-xs text-aco">{ponto.rotulo}</div>
      <div className="mt-0.5 flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-3" style={{ backgroundColor: COR }} />
        <Money centavos={ponto.valor} className="font-display text-[16px] font-bold" />
      </div>
    </div>
  );
}

export function FaturamentoCard() {
  const [modo, setModo] = useState<Modo>('7');
  const [custom, setCustom] = useState(() => intervaloUltimosDias(30));
  const [tabela, setTabela] = useState(false);

  const erroCustom = modo === 'custom' ? validarIntervalo(custom.de, custom.ate) : null;
  const intervalo = useMemo(
    () => (modo === 'custom' ? (erroCustom ? null : custom) : intervaloUltimosDias(Number(modo))),
    [modo, custom, erroCustom],
  );
  const q = useFaturamento(intervalo);
  const descricao = modo === 'custom' ? `de ${dataBR(custom.de)} a ${dataBR(custom.ate)}` : `dos últimos ${modo} dias`;

  const pontos = useMemo<Ponto[]>(() => {
    if (!q.data) return [];
    const porDia = new Map(q.data.dias.map((d) => [d.data, d.totalCentavos]));
    // o backend só devolve dias com faturamento: completa o intervalo com zeros
    return diasDoIntervalo(q.data.de, q.data.ate).map((data) => ({ data, rotulo: dm(data), valor: porDia.get(data) ?? 0 }));
  }, [q.data]);

  const total = pontos.reduce((t, p) => t + p.valor, 0);
  const maior = pontos.reduce<Ponto | undefined>((m, p) => (!m || p.valor > m.valor ? p : m), undefined);

  return (
    <Cartao
      titulo="Faturamento"
      className="min-w-0"
    >
      <div className="-mt-1 mb-3 flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Período do faturamento" valor={modo} onChange={setModo}
          opcoes={[{ valor: '7', label: '7 dias' }, { valor: '14', label: '14 dias' }, { valor: '30', label: '30 dias' }, { valor: 'custom', label: 'Personalizado' }]}
        />
        {q.isSuccess && <span className="text-sm text-aco">Total no período: <Money centavos={total} className="font-semibold text-grafite" /></span>}
        <div className="flex-1" />
        <button type="button" onClick={() => setTabela((t) => !t)} aria-pressed={tabela}
          className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">
          {tabela ? 'Ver gráfico' : 'Ver como tabela'}
        </button>
      </div>

      {modo === 'custom' && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-aco">
            De
            <input type="date" value={custom.de} onChange={(e) => setCustom((c) => ({ ...c, de: e.target.value }))}
              aria-invalid={!!erroCustom} className="mt-1 block h-[30px] rounded border border-linha-forte bg-white px-2 text-sm font-normal text-grafite" />
          </label>
          <label className="text-xs font-semibold text-aco">
            Até
            <input type="date" value={custom.ate} onChange={(e) => setCustom((c) => ({ ...c, ate: e.target.value }))}
              aria-invalid={!!erroCustom} className="mt-1 block h-[30px] rounded border border-linha-forte bg-white px-2 text-sm font-normal text-grafite" />
          </label>
          {erroCustom && <p role="alert" className="pb-1 text-sm text-erro">{erroCustom}</p>}
        </div>
      )}

      {q.isPending && intervalo ? <Skeleton className="h-[240px]" />
        : !q.data ? <p className="py-10 text-center text-sm text-aco">Escolha um período válido para ver o faturamento.</p>
        : q.isError ? <ErrorState onRetry={() => void q.refetch()} />
        : tabela ? (
          <div className="max-h-[240px] overflow-auto">
            <table className="w-full border-collapse">
              <thead><tr>
                <th scope="col" className="bg-fundo px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.6px] text-aco">Dia</th>
                <th scope="col" className="bg-fundo px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.6px] text-aco">Faturamento</th>
              </tr></thead>
              <tbody>
                {pontos.map((p) => (
                  <tr key={p.data} className="h-[34px] border-b border-linha-fraca">
                    <td className="px-3 text-sm tabular-nums">{p.rotulo}</td>
                    <td className="px-3 text-right text-sm"><Money centavos={p.valor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={clsx('transition-opacity', q.isFetching && 'opacity-60')}>
            <p className="mb-1 text-xs text-aco">Eixo vertical em R$ mil</p>
          <div
            role="img" className="h-[240px]"
            aria-label={`Faturamento ${descricao}: total ${fmt(total)}${maior && maior.valor > 0 ? `, maior dia ${maior.rotulo} com ${fmt(maior.valor)}` : ''}. Use "Ver como tabela" para os valores por dia.`}
          >
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 240 }}>
              <AreaChart data={pontos} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#EFF1F4" />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: '#E2E5EA' }} tick={{ fill: '#5C6470', fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis
                  width={52} tickLine={false} axisLine={false} tick={{ fill: '#5C6470', fontSize: 11 }}
                  tickFormatter={(v: number) => (v / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                />
                <Tooltip content={Dica} cursor={{ stroke: '#5C6470', strokeWidth: 1 }} />
                <Area type="linear" dataKey="valor" stroke={COR} strokeWidth={2} fill={COR} fillOpacity={0.08}
                  dot={false} activeDot={{ r: 4, fill: COR, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </div>
        )}
    </Cartao>
  );
}
