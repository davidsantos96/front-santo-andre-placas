import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagina } from '@/components/Pagina';
import { SegmentedControl } from '@/components/SegmentedControl';
import { intervaloDoPeriodo } from '@/lib/datas';
import type { Pedido } from '@/api/types';
import { usePedidos } from './api';
import { KanbanBoard } from './KanbanBoard';
import { PedidosTable } from './PedidosTable';

type Visao = 'quadro' | 'tabela';

const ABERTOS = ['RECEBIDO', 'EM_PROCESSAMENTO', 'PLACA_PRONTA'] as const;

/**
 * O quadro mostra todo pedido em aberto (recebido, em processamento, placa pronta), de qualquer data:
 * pedido antigo ainda não entregue não pode sumir. Entregues ficam só enquanto são recentes
 * (entregues ontem ou hoje), para a coluna não crescer sem fim. CANCELADO fica fora.
 */
function Quadro() {
  const navigate = useNavigate();
  const { ontem, entreguesDesde } = useMemo(() => ({
    ontem: intervaloDoPeriodo('ontem').de,
    entreguesDesde: intervaloDoPeriodo('30').de, // a API filtra por data de criação; a entrega é conferida abaixo
  }), []);
  const recebidos = usePedidos({ status: ABERTOS[0], size: 200 });
  const emProcessamento = usePedidos({ status: ABERTOS[1], size: 200 });
  const prontos = usePedidos({ status: ABERTOS[2], size: 200 });
  const entregues = usePedidos({ status: 'ENTREGUE', de: entreguesDesde, size: 200 });
  const consultas = [recebidos, emProcessamento, prontos, entregues];

  const pedidos = useMemo(() => {
    // Junta as quatro listas sem repetir (durante a troca de status um pedido pode estar em duas).
    const porId = new Map<number, Pedido>();
    for (const dados of [recebidos.data, emProcessamento.data, prontos.data, entregues.data]) {
      for (const p of dados?.content ?? []) porId.set(p.id, p);
    }
    return [...porId.values()]
      .filter((p) => p.status !== 'CANCELADO')
      .filter((p) => p.status !== 'ENTREGUE' || (p.atualizadoEm ?? p.criadoEm).slice(0, 10) >= ontem)
      .sort((a, b) => b.id - a.id);
  }, [recebidos.data, emProcessamento.data, prontos.data, entregues.data, ontem]);

  const carregando = consultas.some((q) => q.isPending);
  if (consultas.some((q) => q.isError)) {
    return <ErrorState onRetry={() => consultas.forEach((q) => void q.refetch())} />;
  }
  return (
    <>
      {!carregando && pedidos.length === 0 && (
        <EmptyState mensagem="Nenhum pedido em aberto." acao={{ label: 'Criar pedido', onClick: () => navigate('/pedidos/novo') }} />
      )}
      <KanbanBoard pedidos={pedidos} carregando={carregando} />
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
