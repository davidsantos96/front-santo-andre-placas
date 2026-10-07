import { nomeAutor } from '@/lib/autor';
import { useMemo, type ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import type { PagamentoListagem } from '@/api/types';
import { DataTable } from '@/components/DataTable';
import { Money } from '@/components/Money';
import { PlacaBadge } from '@/components/PlacaBadge';
import { PlacaCard } from '@/components/PlacaCard';
import { FORMA_PAGAMENTO } from '@/components/status';
import { dataHora } from '@/lib/datas';

type Props = {
  titulo: string;
  pagamentos: PagamentoListagem[];
  estado: 'loading' | 'erro' | 'vazio' | 'ok';
  vazio: ReactNode;
  onRetry?: () => void;
};

/** Tabela compartilhada pelas abas Pagamentos e Caixa (mesmo dado, mesma lista que soma o total). */
export function PagamentosTabela({ titulo, pagamentos, estado, vazio, onRetry }: Props) {
  const navigate = useNavigate();
  const colunas = useMemo<ColumnDef<PagamentoListagem>[]>(() => [
    { header: 'Data', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{dataHora(row.original.pagoEm)}</span> },
    { header: 'Pedido', cell: ({ row }) => <span className="font-mono text-xs text-aco">#{row.original.pedidoId}</span> },
    { header: 'Placa', cell: ({ row }) => <PlacaBadge placa={row.original.placa} /> },
    { header: 'Cliente', cell: ({ row }) => <span className="font-medium">{row.original.clienteNome}</span> },
    { header: 'Serviço', cell: ({ row }) => <span className="text-aco">{row.original.servicoNome}</span> },
    {
      header: 'Forma',
      cell: ({ row }) => {
        const f = FORMA_PAGAMENTO[row.original.formaPagamento];
        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className="inline-block h-2 w-2" style={{ backgroundColor: f.cor }} />
            {f.label}
          </span>
        );
      },
    },
    { header: 'Registrado por', cell: ({ row }) => <span className="text-aco">{nomeAutor(row.original.registradoPor)}</span> },
    { header: 'Valor', meta: { align: 'right' }, cell: ({ row }) => <Money centavos={row.original.valorCentavos} className="font-medium" /> },
  ], []);

  return (
    <PlacaCard titulo={titulo}>
      <DataTable
        columns={colunas} data={pagamentos} estado={estado} vazio={vazio} onRetry={onRetry}
        onRowClick={(p) => navigate(`/pedidos/${p.pedidoId}`)} minWidth={900}
      />
    </PlacaCard>
  );
}

export const estadoTabela = (q: { isPending: boolean; isError: boolean; data?: unknown[] }): 'loading' | 'erro' | 'vazio' | 'ok' =>
  q.isPending ? 'loading' : q.isError ? 'erro' : (q.data?.length ?? 0) === 0 ? 'vazio' : 'ok';
