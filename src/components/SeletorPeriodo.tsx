import type { Periodo } from '@/lib/datas';

export const OPCOES_PERIODO: { valor: Periodo; label: string }[] = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: 'ontem', label: 'Ontem' },
  { valor: '7', label: 'Últimos 7 dias' },
  { valor: '30', label: 'Últimos 30 dias' },
];

export const periodoValido = (v: string | null, padrao: Periodo): Periodo =>
  OPCOES_PERIODO.some((o) => o.valor === v) ? (v as Periodo) : padrao;

/** Select de período (Hoje / Ontem / 7 dias / 30 dias) — a lógica de `de`/`ate` fica em `intervaloDoPeriodo`. */
export function SeletorPeriodo({ valor, onChange, rotulo = 'Período' }: { valor: Periodo; onChange: (p: Periodo) => void; rotulo?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-aco">
      {rotulo}
      <select
        value={valor} onChange={(e) => onChange(e.target.value as Periodo)}
        className="h-[30px] rounded border border-linha-forte bg-white px-2 text-sm font-normal text-grafite"
      >
        {OPCOES_PERIODO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
      </select>
    </label>
  );
}
