import { anosDoVeiculo, modeloDoVeiculo } from '@/lib/veiculo';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from 'react-router-dom';
import type { Veiculo } from '@/api/types';
import { DataTable } from '@/components/DataTable';
import { PlacaBadge } from '@/components/PlacaBadge';
import type { ReactNode } from 'react';

type Props = {
  veiculos: Veiculo[];
  estado: 'loading' | 'erro' | 'vazio' | 'ok';
  vazio: ReactNode;
  onRetry?: () => void;
  /** Some na aba de veículos do cliente (todos seriam do mesmo cliente). */
  mostrarCliente?: boolean;
};

/** Placa · Marca/Modelo · Ano · Cliente · Última consulta (vazia até haver provedor real). */
export function VeiculosTable({ veiculos, estado, vazio, onRetry, mostrarCliente = true }: Props) {
  const navigate = useNavigate();
  const colunas = useMemo<ColumnDef<Veiculo>[]>(() => {
    const base: ColumnDef<Veiculo>[] = [
      { header: 'Placa', cell: ({ row }) => <PlacaBadge placa={row.original.placa} /> },
      { header: 'Marca / modelo', cell: ({ row }) => <span className="font-medium">{modeloDoVeiculo(row.original)}</span> },
      { header: 'Ano', cell: ({ row }) => <span className="tabular-nums">{anosDoVeiculo(row.original)}</span> },
    ];
    if (mostrarCliente) {
      base.push({
        header: 'Cliente',
        cell: ({ row }) => (
          <Link to={`/clientes/${row.original.clienteId}`} onClick={(e) => e.stopPropagation()} className="text-mercosul hover:underline">
            {row.original.clienteNome}
          </Link>
        ),
      });
    }
    base.push({ header: 'Última consulta', cell: () => <span className="text-aco">—</span> });
    return base;
  }, [mostrarCliente]);

  return (
    <div className="overflow-hidden rounded-md border border-linha bg-white shadow-card">
      <DataTable
        columns={colunas} data={veiculos} estado={estado} vazio={vazio} onRetry={onRetry}
        onRowClick={(v) => navigate(`/veiculos/${v.id}`)} minWidth={700}
      />
    </div>
  );
}
