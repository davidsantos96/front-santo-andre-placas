import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { Pagina } from '@/components/Pagina';
import { PlacaInput } from '@/components/PlacaInput';
import { useDebounce } from '@/lib/useDebounce';
import { useVeiculos } from './api';
import { VeiculosTable } from './VeiculosTable';

/** Busca primária por placa (`?placa=`); `?clienteId=` também é aceito. */
export function VeiculosPage() {
  const [sp, setSp] = useSearchParams();
  const placaUrl = sp.get('placa') ?? '';
  const clienteId = sp.get('clienteId') ? Number(sp.get('clienteId')) : undefined;

  const [texto, setTexto] = useState(placaUrl);
  const placa = useDebounce(texto, 200);

  useEffect(() => {
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      if (placa) n.set('placa', placa); else n.delete('placa');
      return n;
    }, { replace: true });
  }, [placa, setSp]);

  const q = useVeiculos({ placa: placaUrl || undefined, clienteId });
  const lista = q.data ?? [];
  const estado = q.isPending ? 'loading' : q.isError ? 'erro' : lista.length === 0 ? 'vazio' : 'ok';

  return (
    <Pagina
      titulo="Veículos"
      contagem={q.isSuccess ? `${lista.length} ${lista.length === 1 ? 'veículo' : 'veículos'}` : undefined}
      acoes={<PlacaInput aria-label="Buscar por placa" placeholder="PLACA" value={texto} onChange={setTexto} />}
    >
      <VeiculosTable
        veiculos={lista} estado={estado} onRetry={() => void q.refetch()}
        vazio={
          placaUrl || clienteId
            ? <EmptyState mensagem={placaUrl ? `Nenhum veículo encontrado para "${placaUrl}".` : 'Nenhum veículo encontrado.'} acao={{ label: 'Limpar busca', onClick: () => { setTexto(''); setSp(new URLSearchParams(), { replace: true }); } }} />
            : <EmptyState mensagem="Nenhum veículo cadastrado ainda." />
        }
      />
    </Pagina>
  );
}
