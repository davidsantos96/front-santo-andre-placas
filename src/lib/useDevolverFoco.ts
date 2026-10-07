import { useRef } from 'react';

/**
 * Devolve o foco a quem abriu o modal ao fechá-lo (spec §9). Os modais são controlados (sem `Dialog.Trigger`),
 * então o Radix não sabe quem é o gatilho e o foco cairia no `<body>`. Guarda o elemento focado no instante em
 * que `aberto` vira `true` (antes de o Radix mover o foco para dentro) e o refoca no `onCloseAutoFocus`.
 * Se o gatilho saiu do DOM (ex.: item de menu que já fechou), não faz nada.
 */
export function useDevolverFoco(aberto: boolean) {
  const gatilho = useRef<HTMLElement | null>(null);
  const estavaAberto = useRef(false);
  if (aberto && !estavaAberto.current) gatilho.current = document.activeElement as HTMLElement | null;
  estavaAberto.current = aberto;
  return (e: Event) => {
    e.preventDefault();
    const el = gatilho.current;
    if (el && el.isConnected && el !== document.body) el.focus();
  };
}
