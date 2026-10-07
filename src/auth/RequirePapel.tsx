import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { pode, telaInicial, type Papel } from './papeis';
import { useSessao } from './SessionProvider';

type Props = { min: Papel; children: ReactNode; fallback?: ReactNode };

/**
 * Um único mecanismo para rota e ação:
 * - sem `fallback` (rota): redireciona para a tela inicial do papel;
 * - com `fallback` (ex.: `fallback={null}`): esconde o conteúdo.
 */
export function RequirePapel({ min, children, fallback }: Props) {
  const { usuario } = useSessao();
  if (!usuario) return null;
  if (pode(usuario.papel, min)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return <Navigate to={telaInicial(usuario.papel)} replace />;
}
