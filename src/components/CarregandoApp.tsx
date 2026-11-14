import { PlacaBadge } from './PlacaBadge';

/** Carregamento inicial do app: placa flutuando no lugar do spinner. */
export function CarregandoApp() {
  return (
    <div role="status" aria-label="Carregando" className="flex h-tela items-center justify-center bg-fundo">
      <PlacaBadge placa="SAP0001" tam="lg" className="animate-placaflutua" />
    </div>
  );
}
