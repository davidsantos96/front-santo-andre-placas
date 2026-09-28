import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="p-6 font-display text-[22px] font-bold">Painel Santo André Placas</div>
  </StrictMode>,
);
