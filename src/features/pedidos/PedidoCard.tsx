import type { HTMLAttributes, Ref } from 'react';
import clsx from 'clsx';
import { OrigemTag } from '@/components/OrigemTag';
import { PendenteTag } from '@/components/PendenteTag';
import { PlacaBadge } from '@/components/PlacaBadge';
import { tempoDecorrido } from '@/lib/datas';
import type { Pedido } from '@/api/types';

type Props = HTMLAttributes<HTMLDivElement> & {
  pedido: Pedido;
  agora: Date;
  arrastando?: boolean;
  travado?: boolean;
  innerRef?: Ref<HTMLDivElement>;
};

export function PedidoCard({ pedido, agora, arrastando, travado, innerRef, className, ...rest }: Props) {
  return (
    <div
      ref={innerRef}
      {...rest}
      className={clsx(
        'rounded-md border border-linha bg-white p-2.5 shadow-card',
        travado ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        arrastando && 'opacity-40',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-aco">#{pedido.id}</span>
        <span className="text-xs tabular-nums text-aco">{tempoDecorrido(pedido.criadoEm, agora)}</span>
      </div>
      <PlacaBadge placa={pedido.veiculo.placa} tam="md" />
      <div className="mt-2 text-base font-semibold">{pedido.cliente.nome}</div>
      <div className="text-xs text-aco">{pedido.servico.nome}</div>
      <div className="mt-2 flex items-center gap-1.5">
        <OrigemTag origem={pedido.origem} />
        {pedido.pago === false && <PendenteTag />}
      </div>
    </div>
  );
}
