import { Navigate } from 'react-router-dom';
import { telaInicial } from './papeis';
import { useSessao } from './SessionProvider';

/** ATENDENTE → /pedidos, demais → /dashboard. */
export function RedirectInicial() {
  const { usuario } = useSessao();
  return <Navigate to={usuario ? telaInicial(usuario.papel) : '/login'} replace />;
}
