import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { ToastProvider } from '@/components/Toast';
import { Galeria } from './Galeria';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <Galeria />
    </ToastProvider>
  </StrictMode>,
);
