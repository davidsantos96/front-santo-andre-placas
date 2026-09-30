import { useEffect, useState } from 'react';

/** Relógio local: re-renderiza a cada `ms` (tempo decorrido dos cards). */
export function useAgora(ms = 60_000): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}
