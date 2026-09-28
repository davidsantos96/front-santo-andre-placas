import { forwardRef } from 'react';
import { Menu, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Props = { onMenu: () => void; menuAberto: boolean };

/** Campo de busca global. Resultados (combobox) entram na Fase 10 — por ora só o campo e o atalho `/`. */
const Busca = forwardRef<HTMLInputElement>(function Busca(_, ref) {
  return (
    <div className="relative w-[400px] max-w-full flex-1 min-[900px]:flex-none">
      <Search size={16} strokeWidth={1.75} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aco" />
      <input
        ref={ref}
        type="search"
        aria-label="Buscar placa, cliente ou nº do pedido"
        placeholder="Buscar placa, cliente ou nº do pedido"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.currentTarget.value = ''; e.currentTarget.blur(); }
        }}
        className="h-[34px] w-full rounded border border-linha-forte bg-white pl-8 pr-8 text-sm"
      />
      <kbd aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-linha-badge px-1.5 text-2xs font-semibold text-aco">/</kbd>
    </div>
  );
});

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
      <Busca ref={buscaRef} />
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
