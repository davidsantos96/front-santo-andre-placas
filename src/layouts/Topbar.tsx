import { forwardRef } from 'react';
import { Menu, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalSearch } from './GlobalSearch';

type Props = { onMenu: () => void; menuAberto: boolean };

export const Topbar = forwardRef<HTMLInputElement, Props>(function Topbar({ onMenu, menuAberto }, buscaRef) {
  const navigate = useNavigate();
  return (
    <header className="flex h-[54px] shrink-0 items-center gap-4 border-b border-linha bg-white px-5">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Abrir menu"
        aria-expanded={menuAberto}
        aria-controls="menu-lateral"
        className="flex h-[34px] w-[34px] items-center justify-center rounded border border-linha-forte text-aco min-[900px]:hidden"
      >
        <Menu size={16} strokeWidth={1.75} />
      </button>
      <GlobalSearch ref={buscaRef} />
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => navigate('/pedidos/novo')}
        className="flex h-8 items-center gap-1.5 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover"
      >
        <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        Novo pedido
        <kbd aria-hidden="true" className="ml-1 rounded-sm bg-white/20 px-1.5 text-2xs">N</kbd>
      </button>
    </header>
  );
});
