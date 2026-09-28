import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { SessionProvider } from '@/auth/SessionProvider';
import { ToastProvider } from '@/components/Toast';
import { rotas } from '@/router';
import { queryClient as global } from '@/api/queryClient';

/** Renderiza o app inteiro (providers + rotas) numa rota inicial. */
export function renderApp(inicial = '/') {
  global.clear();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  const router = createMemoryRouter(rotas, { initialEntries: [inicial] });
  const utils = render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, qc };
}
