import { ORIGEM } from './status';

export function OrigemTag({ origem }: { origem: string }) {
  const label = (ORIGEM as Record<string, string>)[origem] ?? origem;
  return (
    <span className="rounded-sm border border-linha-badge px-1.5 py-[1.5px] text-[11px] font-semibold tracking-[0.6px] text-aco-700">
      {label}
    </span>
  );
}
