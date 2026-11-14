import type { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-tela flex-col items-center justify-center bg-fundo px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">{children}</div>;
}
