import { useNavigate } from 'react-router-dom';
import type { Pedido, ServicoMaisVendido } from '@/api/types';
import { Cartao } from '@/components/Cartao';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PlacaBadge } from '@/components/PlacaBadge';
import { Skeleton } from '@/components/Skeleton';
import { ORIGEM } from '@/components/status';
import { duracaoHoras, tempoDecorrido } from '@/lib/datas';
import { useAgora } from '@/lib/useAgora';
import { DIAS_MAIS_VENDIDOS, DIAS_TEMPO_MEDIO, useFilaDeProducao, useOrigemDosPedidos, useServicosMaisVendidos, useTempoMedio } from './api';

/** Barras horizontais em HTML/CSS: largura = % do maior valor; o texto (nome e contagem) é sempre visível. */
export function ServicosMaisVendidosCard() {
  const q = useServicosMaisVendidos();
  const top: ServicoMaisVendido[] = (q.data ?? []).slice(0, 5);
  const maior = Math.max(1, ...top.map((s) => s.quantidadePedidos));
  return (
    <Cartao titulo="Serviços mais vendidos" className="min-w-0">
      {q.isPending ? <Skeleton className="h-[200px]" />
        : q.isError ? <ErrorState onRetry={() => void q.refetch()} />
        : top.length === 0 ? <EmptyState mensagem={`Sem vendas nos últimos ${DIAS_MAIS_VENDIDOS} dias.`} />
        : (
          <>
          <p className="-mt-1 mb-3 text-xs text-aco">Últimos {DIAS_MAIS_VENDIDOS} dias · pedidos cancelados não contam</p>
          <ul className="flex flex-col gap-3.5">
            {top.map((s) => (
              <li key={s.servicoId}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-base">
                  <span className="truncate">{s.servicoNome}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{s.quantidadePedidos}</span>
                </div>
                <div aria-hidden="true" className="h-1.5 rounded bg-linha-fraca">
                  <div className="h-1.5 rounded bg-mercosul" style={{ width: `${(s.quantidadePedidos / maior) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
    </Cartao>
  );
}

/** "▼ 12 min vs semana anterior": menos tempo é melhor (verde); mais tempo é pior (vermelho). Sem base de comparação, não aparece. */
function Tendencia({ atual, anterior, considerados }: { atual: number; anterior?: number | null; considerados: number }) {
  if (considerados === 0 || anterior == null) return null;
  const min = Math.round((atual - anterior) * 60);
  if (min === 0) return <p className="mt-1.5 text-xs font-semibold text-aco">Igual aos {DIAS_TEMPO_MEDIO} dias anteriores</p>;
  const melhorou = min < 0;
  return (
    <p className={`mt-1.5 text-xs font-semibold ${melhorou ? 'text-ok' : 'text-erro'}`}>
      <span aria-hidden="true">{melhorou ? '▼' : '▲'} </span>
      {duracaoHoras(Math.abs(min) / 60)} {melhorou ? 'mais rápido' : 'mais lento'} que nos {DIAS_TEMPO_MEDIO} dias anteriores
    </p>
  );
}

export function TempoMedioCard() {
  const q = useTempoMedio();
  return (
    <Cartao titulo="Tempo médio de produção" className="min-w-0">
      {q.isPending ? <Skeleton className="h-[90px]" />
        : q.isError ? <ErrorState onRetry={() => void q.refetch()} />
        : (
          <>
            <div className="font-display text-[36px] font-bold leading-none tabular-nums">
              {q.data.pedidosConsiderados > 0 ? duracaoHoras(q.data.horasMedia) : '—'}
            </div>
            <Tendencia atual={q.data.horasMedia} anterior={q.data.horasMediaPeriodoAnterior} considerados={q.data.pedidosConsiderados} />
            <p className="mt-2 text-xs text-aco">
              {q.data.pedidosConsiderados > 0
                ? `Em produção → placa pronta · últimos ${DIAS_TEMPO_MEDIO} dias · ${q.data.pedidosConsiderados} ${q.data.pedidosConsiderados === 1 ? 'pedido considerado' : 'pedidos considerados'}`
                : `Sem placas prontas nos últimos ${DIAS_TEMPO_MEDIO} dias.`}
            </p>
          </>
        )}
    </Cartao>
  );
}

// Cor fixa por origem (a cor segue a entidade, nunca o ranking). Rótulo e número sempre em texto.
// Telefone usa #7691C8 (em vez do #93A9D1 da spec, que tinha contraste de 2,38:1): agora 3,16:1 sobre branco.
const COR_ORIGEM = { BALCAO: '#003399', WHATSAPP: '#4C6EB0', TELEFONE: '#7691C8' } as const;

export function OrigemCard() {
  const q = useOrigemDosPedidos();
  const pedidos = q.data?.content ?? [];
  const total = pedidos.length;
  const linhas = (Object.keys(ORIGEM) as (keyof typeof ORIGEM)[])
    .map((o) => ({ origem: o, n: pedidos.filter((p) => p.origem === o).length }))
    .sort((a, b) => b.n - a.n);
  return (
    <Cartao titulo="Origem dos pedidos" className="min-w-0">
      {q.isPending ? <Skeleton className="h-[110px]" />
        : q.isError ? <ErrorState onRetry={() => void q.refetch()} />
        : total === 0 ? <EmptyState mensagem="Nenhum pedido nos últimos 7 dias." />
        : (
          <>
            <ul className="flex flex-col gap-3">
              {linhas.map(({ origem, n }) => (
                <li key={origem}>
                  <div className="mb-1 flex items-baseline justify-between text-base">
                    <span>{ORIGEM[origem]}</span>
                    <span className="tabular-nums"><span className="font-semibold">{n}</span> <span className="text-aco">· {Math.round((n / total) * 100)}%</span></span>
                  </div>
                  <div aria-hidden="true" className="h-1.5 rounded bg-linha-fraca">
                    <div className="h-1.5 rounded" style={{ width: `${(n / total) * 100}%`, backgroundColor: COR_ORIGEM[origem] }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-aco">Últimos 7 dias · {total} pedidos</p>
          </>
        )}
    </Cartao>
  );
}

export function FilaCard() {
  const navigate = useNavigate();
  const agora = useAgora();
  const fila = useFilaDeProducao();
  const itens: Pedido[] = fila.pedidos.slice(0, 6);
  return (
    <Cartao titulo="Fila de produção" className="min-w-0">
      {fila.isPending ? <Skeleton className="h-[200px]" />
        : fila.isError ? <ErrorState onRetry={fila.refetch} />
        : itens.length === 0 ? <EmptyState mensagem="Nenhum pedido na fila." />
        : (
          <>
            <ul className="-my-1.5">
              {itens.map((p) => (
                <li key={p.id}>
                  <button
                    type="button" onClick={() => navigate(`/pedidos/${p.id}`)}
                    aria-label={`Pedido ${p.id}, placa ${p.veiculo.placa}, ${p.servico.nome}`}
                    className="flex w-full items-center gap-2.5 rounded py-1.5 text-left hover:bg-fundo"
                  >
                    <span className="w-[42px] shrink-0 font-mono text-xs text-aco">#{p.id}</span>
                    <PlacaBadge placa={p.veiculo.placa} />
                    <span className="min-w-0 flex-1 truncate text-sm text-aco">{p.servico.nome}</span>
                    <span className="shrink-0 text-xs tabular-nums text-aco">{tempoDecorrido(p.criadoEm, agora)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {fila.pedidos.length > itens.length && <p className="mt-2 text-xs text-aco">+ {fila.pedidos.length - itens.length} na fila</p>}
          </>
        )}
    </Cartao>
  );
}

