import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { pode } from '@/auth/papeis';
import { useSessao } from '@/auth/SessionProvider';
import { MODULOS } from '@/modulos';
import { useEstoqueBaixo } from '@/features/estoque/api';

const ROTULO_PAPEL = { ATENDENTE: 'Atendente', GERENTE: 'Gerente', ADMIN: 'Administrador' } as const;

export function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const { usuario, logout } = useSessao();
  const { data: baixo } = useEstoqueBaixo(!!usuario);
  const qtdBaixo = baixo?.length ?? 0;
  if (!usuario) return null;

  const itens = MODULOS.filter((m) => pode(usuario.papel, m.min));

  return (
    <>
      {aberta && <div aria-hidden="true" onClick={onFechar} className="fixed inset-0 z-30 bg-black/40 min-[900px]:hidden" />}
      <aside
        id="menu-lateral"
        className={clsx(
          'z-40 flex w-[214px] shrink-0 flex-col bg-noite text-white transition-transform',
          'max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:left-0',
          aberta ? 'max-[899px]:translate-x-0' : 'max-[899px]:-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-3.5 py-3.5">
          <span aria-hidden="true" className="flex h-[30px] w-[44px] shrink-0 flex-col overflow-hidden rounded-[3px] border border-white bg-white">
            <span className="h-[8px] bg-mercosul" />
            <span className="flex flex-1 items-center justify-center font-display text-[11px] font-bold leading-none text-grafite">SAP</span>
          </span>
          <span className="font-display text-[15px] font-semibold leading-tight">Santo André Placas</span>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto py-2">
          <ul>
            {itens.map((m) => {
              const Icone = m.icone;
              return (
                <li key={m.id}>
                  <NavLink
                    to={m.rota}
                    onClick={onFechar}
                    className={({ isActive }) =>
                      clsx(
                        'relative flex items-center gap-2.5 px-3.5 py-[9px] text-md',
                        isActive ? 'bg-white/10 text-white' : 'text-noite-sub hover:bg-white/5 hover:text-white',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-mercosul" />}
                        <Icone size={16} strokeWidth={1.75} aria-hidden="true" />
                        <span className="flex-1">{m.nome}</span>
                        {m.badge === 'estoqueBaixo' && qtdBaixo > 0 && (
                          <span
                            aria-label={`${qtdBaixo} itens abaixo do mínimo`}
                            className="rounded-[9px] bg-alerta px-[7px] text-2xs font-semibold text-white"
                          >
                            {qtdBaixo}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 px-3.5 py-3">
          <div className="truncate text-md font-medium">{usuario.nome}</div>
          <div className="text-xs text-noite-sub">{ROTULO_PAPEL[usuario.papel]}</div>
          <button type="button" onClick={logout} className="mt-2 text-sm font-semibold text-noite-sub underline-offset-2 hover:text-white hover:underline">
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
