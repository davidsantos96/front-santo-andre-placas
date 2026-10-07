import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { StatusPedido } from '@/components/status';
import { useMudarStatus } from './api';

type Alvo = { id: number; status: StatusPedido; pago?: boolean };

/**
 * Troca de status com as confirmações da spec (§7.2): → ENTREGUE sem pagamento e → CANCELADO.
 * Compartilhado entre o Kanban e o detalhe do pedido.
 */
export function useTrocaStatus() {
  const mut = useMudarStatus();
  const [pendente, setPendente] = useState<{ alvo: Alvo; novo: StatusPedido } | null>(null);

  const executar = (id: number, novoStatus: StatusPedido) => mut.mutate({ id, novoStatus });

  const solicitar = (alvo: Alvo, novo: StatusPedido) => {
    if (novo === alvo.status) return;
    if (novo === 'CANCELADO' || (novo === 'ENTREGUE' && alvo.pago === false)) setPendente({ alvo, novo });
    else executar(alvo.id, novo);
  };

  const cancelando = pendente?.novo === 'CANCELADO';
  const dialogo = (
    <ConfirmDialog
      aberto={pendente !== null}
      perigo={cancelando}
      onFechar={() => setPendente(null)}
      onConfirmar={() => {
        if (pendente) executar(pendente.alvo.id, pendente.novo);
        setPendente(null);
      }}
      titulo={cancelando ? `Cancelar pedido #${pendente?.alvo.id}?` : 'Entregar sem pagamento?'}
      descricao={
        cancelando
          ? 'O pedido sairá do fluxo de produção. Essa ação pode ser difícil de reverter.'
          : 'Pedido sem pagamento registrado. Entregar mesmo assim?'
      }
      confirmar={cancelando ? 'Cancelar pedido' : 'Entregar mesmo assim'}
    />
  );

  return { solicitar, dialogo, processando: mut.isPending };
}
