import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';
import type { ItemEstoque } from '@/api/types';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { RequirePapel } from '@/auth/RequirePapel';
import { Pagina } from '@/components/Pagina';
import { PlacaCard } from '@/components/PlacaCard';
import { abaixoDoMinimo, useEstoque } from './api';
import { ItemModal } from './ItemModal';
import { MovimentarModal } from './MovimentarModal';

/** Barra de nível: o mínimo fica na metade (100% = 2× o mínimo). */
function Nivel({ item }: { item: ItemEstoque }) {
  const baixo = abaixoDoMinimo(item);
  const teto = Math.max(item.quantidadeMinima * 2, 1);
  const pct = Math.min(100, Math.round((item.quantidade / teto) * 100));
  return (
    <div
      role="meter" aria-valuemin={0} aria-valuemax={teto} aria-valuenow={Math.min(item.quantidade, teto)}
      aria-label={`Nível de ${item.nome}: ${item.quantidade} de mínimo ${item.quantidadeMinima}`}
      className="relative h-1.5 w-[120px] rounded bg-linha"
    >
      <div className={clsx('h-full rounded', baixo ? 'bg-alerta' : 'bg-mercosul')} style={{ width: `${pct}%` }} />
      <span aria-hidden="true" className="absolute -top-0.5 left-1/2 h-2.5 w-px bg-aco" />
    </div>
  );
}

export function EstoquePage() {
  const q = useEstoque();
  const [item, setItem] = useState<ItemEstoque | null>(null);
  const [novoItem, setNovoItem] = useState(false);
  const lista = q.data ?? [];
  const qtdBaixo = lista.filter(abaixoDoMinimo).length;

  const colunas = useMemo<ColumnDef<ItemEstoque>[]>(() => [
    { header: 'Item', cell: ({ row }) => <span className="font-medium">{row.original.nome}</span> },
    { header: 'SKU', cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku || '—'}</span> },
    {
      header: 'Quantidade', meta: { align: 'right' },
      cell: ({ row }) => {
        const baixo = abaixoDoMinimo(row.original);
        return (
          <span className={clsx('tabular-nums', baixo && 'font-semibold text-alerta')}>
            {row.original.quantidade}
            {baixo && <span className="ml-2 text-xs font-semibold">Abaixo do mínimo</span>}
          </span>
        );
      },
    },
    { header: 'Mínimo', meta: { align: 'right' }, cell: ({ row }) => <span className="tabular-nums">{row.original.quantidadeMinima}</span> },
    { header: 'Unidade', cell: ({ row }) => row.original.unidade || '—' },
    { header: 'Nível', cell: ({ row }) => <Nivel item={row.original} /> },
    {
      header: 'Ação',
      cell: ({ row }) => (
        <button type="button" onClick={() => setItem(row.original)} aria-label={`Movimentar ${row.original.nome}`}
          className="h-[26px] rounded border border-linha-forte bg-white px-2.5 text-sm font-medium text-aco hover:bg-fundo">
          Movimentar
        </button>
      ),
    },
  ], []);

  const estado = q.isPending ? 'loading' : q.isError ? 'erro' : lista.length === 0 ? 'vazio' : 'ok';

  return (
    <Pagina
      titulo="Estoque"
      contagem={q.isSuccess ? `${lista.length} itens` : undefined}
      acoes={
        <>
          {qtdBaixo > 0 && (
            <span role="status" className="rounded-[10px] bg-alerta-bg px-[10px] py-[3px] text-xs font-semibold text-alerta-texto">
              {qtdBaixo} abaixo do mínimo
            </span>
          )}
          <RequirePapel min="GERENTE" fallback={null}>
            <button type="button" onClick={() => setNovoItem(true)} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover">
              + Novo item
            </button>
          </RequirePapel>
        </>
      }
    >
      <PlacaCard titulo="CONTROLE DE ESTOQUE · SP">
        <DataTable
          columns={colunas} data={lista} estado={estado} onRetry={() => void q.refetch()}
          rowClassName={(i) => (abaixoDoMinimo(i) ? 'bg-alerta-bgHover' : undefined)}
          vazio={<EmptyState mensagem="Nenhum item de estoque cadastrado." />}
        />
      </PlacaCard>
      <ItemModal key={novoItem ? 'aberto' : 'fechado'} aberto={novoItem} onFechar={() => setNovoItem(false)} />
      <MovimentarModal key={item?.id ?? 'fechado'} item={item} onFechar={() => setItem(null)} />
    </Pagina>
  );
}
