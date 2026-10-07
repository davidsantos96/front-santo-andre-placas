import { Link } from 'react-router-dom';
import { Pagina } from './Pagina';

export function NaoEncontrado() {
  return (
    <Pagina titulo="Página não encontrada">
      <p className="mb-3 text-base text-aco">O endereço não existe ou foi movido.</p>
      <Link to="/" className="text-base font-semibold text-mercosul underline">Voltar ao início</Link>
    </Pagina>
  );
}
