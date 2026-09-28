import { useState, type KeyboardEvent } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import type { Pedido } from '@/api/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/Skeleton';
import { FLUXO, STATUS, type StatusPedido } from '@/components/status';
import { useAgora } from '@/lib/useAgora';
import { PedidoCard } from './PedidoCard';
import { useTrocaStatus } from './useTrocaStatus';

const nomeColuna = (id: unknown) => STATUS[id as StatusPedido]?.label ?? String(id);

const anuncios: Announcements = {
  onDragStart: ({ active }) => `Pedido ${active.id} pego. Use as setas para mover entre colunas e espaço para soltar.`,
  onDragOver: ({ over }) => (over ? `Sobre a coluna ${nomeColuna(over.id)}.` : 'Fora das colunas.'),
  onDragEnd: ({ active, over }) =>
    over ? `Pedido ${active.id} solto em ${nomeColuna(over.id)}.` : `Pedido ${active.id} solto fora das colunas.`,
  onDragCancel: ({ active }) => `Movimentação do pedido ${active.id} cancelada.`,
};

function CardArrastavel({ pedido, agora, onAbrir }: { pedido: Pedido; agora: Date; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: pedido.id, data: { pedido } });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); onAbrir(); return; } // Enter abre; espaço pega (KeyboardSensor)
    listeners?.onKeyDown?.(e);
  };

  return (
    <PedidoCard
      innerRef={setNodeRef}
      pedido={pedido}
      agora={agora}
      arrastando={isDragging}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={onAbrir}
      aria-label={`Pedido ${pedido.id}, placa ${pedido.veiculo.placa}, ${pedido.cliente.nome}, ${STATUS[pedido.status].label}`}
    />
  );
}

function Coluna({ status, pedidos, agora, onAbrir, carregando }: {
  status: StatusPedido; pedidos: Pedido[]; agora: Date; onAbrir: (id: number) => void; carregando: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section aria-label={STATUS[status].label} className="min-w-0">
      <header className="mb-2 flex items-center gap-2">
        <StatusBadge status={status} />
        <span className="text-sm tabular-nums text-aco">{carregando ? '' : pedidos.length}</span>
      </header>
      <div
        ref={setNodeRef}
        data-coluna={status}
        className={clsx('flex min-h-[300px] flex-col gap-2 rounded-md bg-[#EBEDF0] p-2 transition-colors', isOver && 'bg-mercosul-claro')}
      >
        {carregando
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[142px] w-full" />)
          : pedidos.map((p) => <CardArrastavel key={p.id} pedido={p} agora={agora} onAbrir={() => onAbrir(p.id)} />)}
      </div>
    </section>
  );
}

type Props = { pedidos: Pedido[]; carregando: boolean };

export function KanbanBoard({ pedidos, carregando }: Props) {
  const navigate = useNavigate();
  const agora = useAgora();
  const { solicitar, dialogo } = useTrocaStatus();
  const [ativo, setAtivo] = useState<Pedido | null>(null);

  const sensors = useSensors(
    // distância mínima: clique simples continua abrindo o detalhe
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // espaço pega/solta (Enter fica livre para abrir o detalhe)
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  );

  const onDragStart = (e: DragStartEvent) => setAtivo((e.active.data.current?.pedido as Pedido) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setAtivo(null);
    const pedido = e.active.data.current?.pedido as Pedido | undefined;
    const destino = e.over?.id as StatusPedido | undefined;
    if (pedido && destino && destino !== pedido.status) solicitar(pedido, destino);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        accessibility={{
          announcements: anuncios,
          screenReaderInstructions: {
            draggable: 'Para pegar o pedido, pressione espaço. Use as setas para mover entre colunas e espaço para soltar. Enter abre o detalhe.',
          },
        }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setAtivo(null)}
      >
        <div className="grid grid-cols-4 gap-3 max-[899px]:grid-cols-2">
          {FLUXO.map((s) => (
            <Coluna
              key={s}
              status={s}
              pedidos={pedidos.filter((p) => p.status === s)}
              agora={agora}
              carregando={carregando}
              onAbrir={(id) => navigate(`/pedidos/${id}`)}
            />
          ))}
        </div>
        <DragOverlay>{ativo ? <PedidoCard pedido={ativo} agora={agora} className="rotate-1 shadow-placa" /> : null}</DragOverlay>
      </DndContext>
      {dialogo}
      <p className="mt-3 text-xs text-aco">Arraste um card para mudar o status · CANCELADO fica recolhido nesta visão</p>
    </>
  );
}
