import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import * as RToast from '@radix-ui/react-toast';
import clsx from 'clsx';

type Tipo = 'info' | 'erro';
type Item = { id: number; msg: string; tipo: Tipo };
type Fn = (msg: string, tipo?: Tipo) => void;

const Ctx = createContext<Fn>(() => {});
export const useToast = () => useContext(Ctx);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Item[]>([]);
  const toast = useCallback<Fn>((msg, tipo = 'info') => {
    setItens((l) => [...l, { id: ++seq, msg, tipo }]);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      <RToast.Provider duration={3000} swipeDirection="down">
        {children}
        {itens.map((t) => (
          <RToast.Root
            key={t.id}
            onOpenChange={(o) => !o && setItens((l) => l.filter((x) => x.id !== t.id))}
            className={clsx(
              'rounded-md px-4 py-2.5 text-md text-white shadow-card data-[state=closed]:animate-out data-[state=open]:animate-in',
              t.tipo === 'erro' ? 'bg-erro' : 'bg-grafite',
            )}
          >
            <RToast.Description>{t.msg}</RToast.Description>
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-4 left-1/2 z-[100] flex w-[380px] max-w-[92vw] -translate-x-1/2 flex-col gap-2 outline-none" />
      </RToast.Provider>
    </Ctx.Provider>
  );
}
