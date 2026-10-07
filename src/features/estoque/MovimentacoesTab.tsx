import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import type { ItemEstoque, MovimentacaoEstoque } from '@/api/types';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { PlacaCard } from '@/components/PlacaCard';
import { nomeAutor } from '@/lib/autor';
import { dataHoraCompleta } from '@/lib/datas';
import { useMovimentacoes } from './api';

/** Histórico de movimentações: tipo, quantidade, item, autor, data e pedido de origem (baixa automática). */
export function MovimentacoesTab({ itens }: { itens: ItemEstoque[] }) {
  const [itemId, setItemId] = useState<number | undefined>();
  const q = useMovimentacoes(itemId);

  const colunas = useMemo<ColumnDef<MovimentacaoEstoque>[]>(() => [
    { header: 'Data', cell: ({ row }) => <span className="tabular-nums text-aco">{dataHoraCompleta(row.original.criadoEm)}</span> },
    { header: 'Item', cell: ({ row }) => <span className="font-medium">{row.original.itemEstoqueNome}</span> },
    {
      header: 'Tipo',
      cell: ({ row }) => (
        <span className={row.original.tipo === 'ENTRADA' ? 'font-semibold text-ok-texto' : 'font-semibold text-aco-700'}>
          {row.original.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
        </span>
      ),
    },
    {
      header: 'Quantidade', meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular-nums">{row.original.tipo === 'ENTRADA' ? '+' : '−'}{row.original.quantidade}</span>,
    },
    {
      header: 'Origem',
      cell: ({ row }) => row.original.pedidoId != null
        ? <span>Baixa automática · <Link to={`/pedidos/${row.original.pedidoId}`} className="font-medium text-mercosul hover:underline">Pedido #{row.original.pedidoId}</Link></span>
        : <span className="text-aco">Manual</span>,
    },
    { header: 'Registrado por', cell: ({ row }) => <span className="text-aco">{nomeAutor(row.original.registradoPor)}</span> },
  ], []);

  const lista = q.data ?? [];
  const estado = q.isPending ? 'loading' : q.isError ? 'erro' : lista.length === 0 ? 'vazio' : 'ok';

  return (
    <div>
      <div className="mb-3">
        <label htmlFor="f-item-mov" className="sr-only">Item</label>
        <select
          id="f-item-mov" value={itemId ?? ''} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : undefined)}
          className="h-[30px] rounded border border-linha-forte bg-white px-2 text-sm"
        >
          <option value="">Todos os itens</option>
          {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
      </div>
      <PlacaCard titulo="MOVIMENTAÇÕES DE ESTOQUE · SP">
        <DataTable
          columns={colunas} data={lista} estado={estado} onRetry={() => void q.refetch()}
          vazio={<EmptyState mensagem={itemId ? 'Nenhuma movimentação para este item.' : 'Nenhuma movimentação registrada.'} />}
        />
      </PlacaCard>
    </div>
  );
}
