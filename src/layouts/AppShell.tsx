import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ReloginModal } from '@/auth/ReloginModal';
import { useAtalhos } from '@/lib/useAtalhos';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  const [menu, setMenu] = useState(false);
  const busca = useRef<HTMLInputElement>(null);
  const { pathname } = useLocation();

  useAtalhos(() => busca.current?.focus());

  // Drawer fecha ao navegar e com Esc.
  useEffect(() => { setMenu(false); }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar aberta={menu} onFechar={() => setMenu(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar ref={busca} onMenu={() => setMenu((m) => !m)} menuAberto={menu} />
        <main className="flex-1 overflow-auto bg-fundo">
          <Outlet />
        </main>
      </div>
      <ReloginModal />
    </div>
  );
}
