import { STATUS, type StatusPedido } from './status';

export function StatusBadge({ status }: { status: StatusPedido }) {
  const s = STATUS[status];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-[10px] px-[9px] py-[2px] text-[11px] font-semibold"
      style={{ color: s.cor, backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}
