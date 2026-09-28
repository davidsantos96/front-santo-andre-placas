import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagina } from '@/components/Pagina';
import { SegmentedControl } from '@/components/SegmentedControl';
import { intervaloDoPeriodo } from '@/lib/datas';
import { usePedidos } from './api';
import { KanbanBoard } from './KanbanBoard';
import { PedidosTable } from './PedidosTable';

type Visao = 'quadro' | 'tabela';

/** O quadro mostra hoje e ontem (entregues antigos saem do quadro); CANCELADO fica fora. */
function Quadro() {
  const navigate = useNavigate();
  const filtro = useMemo(() => ({ de: intervaloDoPeriodo('ontem').de, size: 200 }), []);
  const { data, isPending, isError, refetch } = usePedidos(filtro);
  const pedidos = (data?.content ?? []).filter((p) => p.status !== 'CANCELADO');

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  return (
    <>
      {!isPending && pedidos.length === 0 && (
        <EmptyState mensagem="Nenhum pedido hoje ainda." acao={{ label: 'Criar pedido', onClick: () => navigate('/pedidos/novo') }} />
      )}
      <KanbanBoard pedidos={pedidos} carregando={isPending} />
    </>
  );
}

export function PedidosPage() {
  const [sp, setSp] = useSearchParams();
  const visao: Visao = sp.get('visao') === 'tabela' ? 'tabela' : 'quadro';
  const [totalTabela, setTotalTabela] = useState<number>();

  const trocar = (v: Visao) => setSp((prev) => {
    const n = new URLSearchParams(prev);
    n.set('visao', v);
    return n;
  }, { replace: true });

  return (
    <Pagina
      titulo="Pedidos"
      contagem={visao === 'tabela' && totalTabela !== undefined ? `${totalTabela} pedidos` : undefined}
      acoes={
        <SegmentedControl
          ariaLabel="Visão dos pedidos" valor={visao} onChange={trocar}
          opcoes={[{ valor: 'quadro', label: 'Quadro' }, { valor: 'tabela', label: 'Tabela' }]}
        />
      }
    >
      {visao === 'quadro' ? <Quadro /> : <PedidosTable onContagem={setTotalTabela} />}
    </Pagina>
  );
}
