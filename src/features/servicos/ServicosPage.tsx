import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';
import type { Servico } from '@/api/types';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Money } from '@/components/Money';
import { Pagina } from '@/components/Pagina';
import { PlacaCard } from '@/components/PlacaCard';
import { useAlternarServico, usePedidosNoMes, useServicos } from './api';
import { ServicoModal } from './ServicoModal';

function Switch({ ativo, nome, onChange }: { ativo: boolean; nome: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={ativo} aria-label={`${nome}: ${ativo ? 'ativo' : 'inativo'}`}
      onClick={(e) => { e.stopPropagation(); onChange(!ativo); }}
      className="flex items-center gap-2 text-sm font-medium"
    >
      <span className={clsx('relative h-[18px] w-[32px] rounded-full transition-colors', ativo ? 'bg-ok' : 'bg-linha-badge')}>
        <span className={clsx('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all', ativo ? 'left-[16px]' : 'left-[2px]')} />
      </span>
      <span className={ativo ? 'text-ok' : 'text-aco'}>{ativo ? 'Ativo' : 'Inativo'}</span>
    </button>
  );
}

// Células com o próprio estado: as colunas ficam estáticas e as células não remontam quando os
// dados mudam (senão o foco do switch se perderia a cada alteração).
function CelulaPedidosNoMes({ servicoId }: { servicoId: number }) {
  const mes = usePedidosNoMes();
  return <span className="tabular-nums">{mes.isSuccess ? mes.data.porServico.get(servicoId) ?? 0 : '…'}</span>;
}

function CelulaStatus({ servico }: { servico: Servico }) {
  const { mutate } = useAlternarServico();
  return <Switch ativo={servico.ativo} nome={servico.nome} onChange={(ativo) => mutate({ servico, ativo })} />;
}

export function ServicosPage() {
  const q = useServicos();
  const mes = usePedidosNoMes();
  const [modal, setModal] = useState<Servico | 'novo' | null>(null);

  const colunas = useMemo<ColumnDef<Servico>[]>(() => [
    { header: 'Nome', cell: ({ row }) => <span className={clsx('font-medium', !row.original.ativo && 'text-aco')}>{row.original.nome}</span> },
    { header: 'Categoria', cell: ({ row }) => <span className="text-xs font-semibold tracking-[0.6px] text-aco-700">{row.original.categoria}</span> },
    { header: 'Preço', meta: { align: 'right' }, cell: ({ row }) => <Money centavos={row.original.precoCentavos} /> },
    { header: 'Pedidos no mês', meta: { align: 'right' }, cell: ({ row }) => <CelulaPedidosNoMes servicoId={row.original.id} /> },
    { header: 'Status', cell: ({ row }) => <CelulaStatus servico={row.original} /> },
  ], []);

  const lista = q.data ?? [];
  const estado = q.isPending ? 'loading' : q.isError ? 'erro' : lista.length === 0 ? 'vazio' : 'ok';

  return (
    <Pagina
      titulo="Serviços"
      contagem={q.isSuccess ? `${lista.length} ${lista.length === 1 ? 'serviço' : 'serviços'}` : undefined}
      acoes={<button type="button" onClick={() => setModal('novo')} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover">+ Novo serviço</button>}
    >
      <PlacaCard titulo="TABELA DE SERVIÇOS · SP">
        <DataTable
          columns={colunas} data={lista} estado={estado} onRetry={() => void q.refetch()}
          onRowClick={(s) => setModal(s)}
          vazio={<EmptyState mensagem="Nenhum serviço cadastrado." acao={{ label: 'Criar serviço', onClick: () => setModal('novo') }} />}
        />
      </PlacaCard>
      {mes.isSuccess && mes.data.truncado && (
        <p role="note" className="mt-2 text-xs text-alerta-texto">Contagem do mês parcial: há mais pedidos do que o limite consultado.</p>
      )}
      <ServicoModal key={modal === 'novo' ? 'novo' : modal?.id ?? 'fechado'} servico={modal} onFechar={() => setModal(null)} />
    </Pagina>
  );
}
