import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
// Fontes hospedadas no projeto (sem depender do Google Fonts): títulos/placa, interface e códigos.
import '@fontsource/archivo-narrow/latin-500.css';
import '@fontsource/archivo-narrow/latin-600.css';
import '@fontsource/archivo-narrow/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles/index.css';
import { queryClient } from '@/api/queryClient';
import { SessionProvider } from '@/auth/SessionProvider';
import { ToastProvider } from '@/components/Toast';
import { CarregandoApp } from '@/components/CarregandoApp';
import { criarRouter } from './router';

const root = createRoot(document.getElementById('root')!);
root.render(<CarregandoApp />);

async function iniciar() {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass', serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` } });
  }
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ToastProvider>
            <RouterProvider router={criarRouter()} />
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void iniciar();
