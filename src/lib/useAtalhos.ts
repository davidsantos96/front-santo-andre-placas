import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const emCampo = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

/**
 * Atalhos globais (fora de inputs): `/` busca, `N` novo pedido,
 * `G` depois `P` pedidos, `G` depois `C` clientes.
 */
export function useAtalhos(focarBusca: () => void) {
  const navigate = useNavigate();
  const foco = useRef(focarBusca);
  foco.current = focarBusca;

  useEffect(() => {
    let aguardandoG = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || emCampo(e.target)) return;
      const k = e.key.toLowerCase();
      if (aguardandoG) {
        aguardandoG = false;
        clearTimeout(timer);
        if (k === 'p') { e.preventDefault(); navigate('/pedidos'); }
        if (k === 'c') { e.preventDefault(); navigate('/clientes'); }
        return;
      }
      if (k === '/') { e.preventDefault(); foco.current(); }
      else if (k === 'n') { e.preventDefault(); navigate('/pedidos/novo'); }
      else if (k === 'g') {
        aguardandoG = true;
        timer = setTimeout(() => { aguardandoG = false; }, 1500);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
  }, [navigate]);
}
