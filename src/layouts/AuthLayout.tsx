import type { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-fundo px-4 py-10">{children}</div>;
}
