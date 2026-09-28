import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessao } from './SessionProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario } = useSessao();
  const loc = useLocation();
  if (!usuario) {
    const next = loc.pathname + loc.search;
    const qs = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${qs}`} replace />;
  }
  return <>{children}</>;
}
