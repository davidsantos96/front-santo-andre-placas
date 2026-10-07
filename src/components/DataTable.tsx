import type { KeyboardEvent, ReactNode } from 'react';
import clsx from 'clsx';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Skeleton } from './Skeleton';
import { ErrorState } from './ErrorState';

type Props<T> = {
  columns: ColumnDef<T, any>[];
  data: T[];
  estado: 'loading' | 'erro' | 'vazio' | 'ok';
  vazio?: ReactNode;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  minWidth?: number;
};

export function DataTable<T>({ columns, data, estado, vazio, onRetry, onRowClick, rowClassName, minWidth = 900 }: Props<T>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const cols = table.getAllLeafColumns();

  const onKey = (e: KeyboardEvent, row: T) => {
    if (e.key === 'Enter') onRowClick?.(row);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  scope="col"
                  className={clsx(
                    'bg-fundo px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-aco',
                    (h.column.columnDef.meta as { align?: string } | undefined)?.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {estado === 'loading' &&
            Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className="h-[42px] border-b border-linha-fraca">
                {cols.map((c) => (
                  <td key={c.id} className="px-3"><Skeleton className="h-3.5 w-full" /></td>
                ))}
              </tr>
            ))}
          {estado === 'erro' && (
            <tr><td colSpan={cols.length}><ErrorState onRetry={onRetry ?? (() => {})} /></td></tr>
          )}
          {estado === 'vazio' && (
            <tr><td colSpan={cols.length}>{vazio}</td></tr>
          )}
          {estado === 'ok' &&
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'link' : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={onRowClick ? (e) => onKey(e, row.original) : undefined}
                className={clsx(
                  'h-[42px] border-b border-linha-fraca hover:bg-fundo',
                  onRowClick && 'cursor-pointer',
                  rowClassName?.(row.original),
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={clsx(
                      'px-3 text-sm',
                      (cell.column.columnDef.meta as { align?: string } | undefined)?.align === 'right' && 'text-right tabular-nums',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
