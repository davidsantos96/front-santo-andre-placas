import { useRef, type KeyboardEvent } from 'react';
import clsx from 'clsx';

type Op<T extends string> = { valor: T; label: string };
type Props<T extends string> = { opcoes: Op<T>[]; valor: T; onChange: (v: T) => void; ariaLabel: string };

export function SegmentedControl<T extends string>({ opcoes, valor, onChange, ariaLabel }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + opcoes.length) % opcoes.length;
    onChange(opcoes[j].valor);
    refs.current[j]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex overflow-hidden rounded border border-linha-forte">
      {opcoes.map((o, i) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={ativo}
            tabIndex={ativo ? 0 : -1}
            onClick={() => onChange(o.valor)}
            onKeyDown={(e) => onKey(e, i)}
            className={clsx(
              'h-[30px] px-3 text-sm font-semibold',
              i > 0 && 'border-l border-linha-forte',
              ativo ? 'bg-mercosul text-white' : 'bg-white text-aco',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
