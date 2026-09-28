import { Pagina } from './Pagina';

/** Placeholder das telas ainda não implementadas (some ao longo das fases). */
export function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <Pagina titulo={titulo}>
      <p className="text-base text-aco">Tela em construção.</p>
    </Pagina>
  );
}
