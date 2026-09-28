import clsx from 'clsx';
import { fmt } from '@/lib/money';

export function Money({ centavos, className }: { centavos: number; className?: string }) {
  return <span className={clsx('whitespace-nowrap tabular-nums', className)}>{fmt(centavos)}</span>;
}
