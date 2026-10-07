import type { ReactNode } from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { useSearchParams } from 'react-router-dom';

export type AbaDef = { id: string; label: string; tag?: ReactNode; conteudo: ReactNode };

/** Radix Tabs sincronizado com `?aba=`. */
export function Tabs({ abas, param = 'aba' }: { abas: AbaDef[]; param?: string }) {
  const [sp, setSp] = useSearchParams();
  const atual = abas.find((a) => a.id === sp.get(param))?.id ?? abas[0].id;
  const trocar = (id: string) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      n.set(param, id);
      return n;
    }, { replace: true });

  return (
    <RTabs.Root value={atual} onValueChange={trocar}>
      <RTabs.List className="mb-3.5 flex border-b border-linha" aria-label="Seções">
        {abas.map((a) => (
          <RTabs.Trigger
            key={a.id}
            value={a.id}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 pb-[9px] pt-2 text-base font-semibold',
              atual === a.id ? 'border-b-[3px] border-mercosul text-mercosul' : 'text-aco',
            )}
          >
            {a.label}
            {a.tag != null && (
              <span className="rounded-[9px] bg-mercosul-claro px-[7px] text-2xs text-mercosul">{a.tag}</span>
            )}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {abas.map((a) => (
        <RTabs.Content key={a.id} value={a.id}>{a.conteudo}</RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
