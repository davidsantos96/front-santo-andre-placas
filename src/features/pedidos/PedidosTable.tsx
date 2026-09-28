import { useEffect, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Pedido } from '@/api/types';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Money } from '@/components/Money';
import { OrigemTag } from '@/components/OrigemTag';
import { PlacaBadge } from '@/components/PlacaBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { STATUS, type StatusPedido } from '@/components/status';
import { intervaloDoPeriodo, tempoDecorrido, type Periodo } from '@/lib/datas';
import { normalizarPlaca } from '@/lib/placa';
import { useAgora } from '@/lib/useAgora';
import { usePedidos } from './api';

const TAMANHO = 50;
const PERIODOS: { valor: Periodo | 'todos'; label: string }[] = [
  { valor: 'todos', label: 'Todo o período' },
  { valor: 'hoje', label: 'Hoje' },
  { valor: 'ontem', label: 'Ontem' },
  { valor: '7', label: 'Últimos 7 dias' },
  { valor: '30', label: 'Últimos 30 dias' },
];

const selectCls = 'h-[30px] rounded border border-linha-forte bg-white px-2 text-sm';

/** Filtros na URL (?status=&busca=&periodo=&page=), repassados à API. `clienteId` fixo p/ o detalhe do cliente. */
export function PedidosTable({ clienteId, onContagem }: { clienteId?: number; onContagem?: (n: number) => void }) {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const agora = useAgora();

  const status = (sp.get('status') as StatusPedido | null) ?? undefined;
  const busca = sp.get('busca') ?? '';
  const periodo = (sp.get('periodo') as Periodo | null) ?? undefined;
  const pagina = Math.max(1, Number(sp.get('page') ?? 1) || 1);

  const set = (chave: string, valor: string | undefined) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      if (valor) n.set(chave, valor); else n.delete(chave);
      if (chave !== 'page') n.delete('page');
      return n;
    }, { replace: true });

  const { data, isPending, isError, refetch } = usePedidos({
    status, clienteId, ...(periodo ? intervaloDoPeriodo(periodo) : {}),
    page: pagina - 1, size: TAMANHO,
  });

  // A API não tem filtro de texto (§14.2): a busca filtra só a página carregada.
  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return data?.content ?? [];
    const placa = normalizarPlaca(t);
    return (data?.content ?? []).filter(
      (p) => String(p.id) === t.replace('#', '') || p.cliente.nome.toLowerCase().includes(t) ||
        (placa.length > 0 && p.veiculo.placa.includes(placa)),
    );
  }, [data, busca]);

  const total = data?.page.totalElements;
  useEffect(() => {
    if (total !== undefined) onContagem?.(total);
  }, [total, onContagem]);

  const colunas = useMemo<ColumnDef<Pedido>[]>(() => [
    { header: 'Nº', cell: ({ row }) => <span className="font-mono text-xs text-aco">#{row.original.id}</span> },
    { header: 'Placa', cell: ({ row }) => <PlacaBadge placa={row.original.veiculo.placa} /> },
    { header: 'Cliente', cell: ({ row }) => <span className="font-medium">{row.original.cliente.nome}</span> },
    { header: 'Serviço', cell: ({ row }) => <span className="text-aco">{row.original.servico.nome}</span> },
    { header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { header: 'Origem', cell: ({ row }) => <OrigemTag origem={row.original.origem} /> },
    { header: 'Tempo', cell: ({ row }) => <span className="tabular-nums text-aco">{tempoDecorrido(row.original.criadoEm, agora)}</span> },
    { header: 'Valor', meta: { align: 'right' }, cell: ({ row }) => <Money centavos={row.original.servico.precoCentavos} /> },
  ], [agora]);

  const filtrado = !!(status || busca || periodo);
  const estado = isPending ? 'loading' : isError ? 'erro' : linhas.length === 0 ? 'vazio' : 'ok';
  const totalPaginas = data?.page.totalPages ?? 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <label className="sr-only" htmlFor="f-status">Status</label>
        <select id="f-status" value={status ?? ''} onChange={(e) => set('status', e.target.value || undefined)} className={selectCls}>
          <option value="">Todos os status</option>
          {(Object.keys(STATUS) as StatusPedido[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-periodo">Período</label>
        <select id="f-periodo" value={periodo ?? 'todos'} onChange={(e) => set('periodo', e.target.value === 'todos' ? undefined : e.target.value)} className={selectCls}>
          {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-busca">Filtrar nesta página</label>
        <input
          id="f-busca" type="search" value={busca} placeholder="Filtrar por placa, cliente ou nº"
          onChange={(e) => set('busca', e.target.value || undefined)}
          className={`${selectCls} w-[240px]`}
        />
      </div>

      <div className="overflow-hidden rounded-md border border-linha bg-white shadow-card">
        <DataTable
          columns={colunas} data={linhas} estado={estado} onRetry={() => void refetch()}
          onRowClick={(p) => navigate(`/pedidos/${p.id}`)}
          vazio={
            filtrado
              ? <EmptyState mensagem="Nenhum pedido encontrado com esses filtros." acao={{ label: 'Limpar filtros', onClick: () => setSp(new URLSearchParams(), { replace: true }) }} />
              : <EmptyState mensagem="Nenhum pedido ainda." acao={{ label: 'Criar pedido', onClick: () => navigate('/pedidos/novo') }} />
          }
        />
      </div>

      {totalPaginas > 1 && (
        <nav aria-label="Paginação" className="mt-3 flex items-center justify-end gap-2.5 text-sm text-aco">
          <button type="button" disabled={pagina <= 1} onClick={() => set('page', String(pagina - 1))} className="h-[30px] rounded border border-linha-forte bg-white px-3 font-medium hover:bg-fundo disabled:opacity-50">Anterior</button>
          <span className="tabular-nums">Página {pagina} de {totalPaginas}</span>
          <button type="button" disabled={pagina >= totalPaginas} onClick={() => set('page', String(pagina + 1))} className="h-[30px] rounded border border-linha-forte bg-white px-3 font-medium hover:bg-fundo disabled:opacity-50">Próxima</button>
        </nav>
      )}
    </div>
  );
}
