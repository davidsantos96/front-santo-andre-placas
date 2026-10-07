import { anosDoVeiculo, modeloDoVeiculo } from '@/lib/veiculo';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { naoEncontrado } from '@/lib/erros';
import { Cartao } from '@/components/Cartao';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagina } from '@/components/Pagina';
import { PlacaBadge } from '@/components/PlacaBadge';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { dataHora } from '@/lib/datas';
import { useConsultarVeiculo, useHistoricoConsultas, useVeiculo } from './api';

export function VeiculoDetalhePage() {
  const id = Number(useParams().id);
  const toast = useToast();
  const veiculoQ = useVeiculo(id);
  const consultasQ = useHistoricoConsultas(id);
  const consultar = useConsultarVeiculo();

  const voltar = (
    <Link to="/veiculos" className="flex items-center gap-1 text-sm font-semibold text-mercosul hover:underline">
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      Veículos
    </Link>
  );

  if (veiculoQ.isPending) {
    return <div className="max-w-[1200px] px-6 py-5" aria-busy="true"><div className="mb-3.5">{voltar}</div><Skeleton className="h-[190px]" /></div>;
  }
  if (veiculoQ.isError) {
    const naoExiste = naoEncontrado(veiculoQ.error);
    return (
      <div className="max-w-[1200px] px-6 py-5">
        <div className="mb-3.5">{voltar}</div>
        <ErrorState mensagem={naoExiste ? 'Veículo não encontrado.' : undefined} onRetry={() => void veiculoQ.refetch()} />
      </div>
    );
  }

  const v = veiculoQ.data;
  const consultarPlaca = () => consultar.mutate(id, { onError: (e) => toast(e.mensagem) }); // 400 esperado: aviso, não erro

  return (
    <Pagina
      titulo={modeloDoVeiculo(v)}
      acoes={
        <button type="button" onClick={consultarPlaca} disabled={consultar.isPending}
          className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
          Consultar placa
        </button>
      }
    >
      <div className="-mt-2 mb-3.5">{voltar}</div>
      <div className="flex max-w-[900px] flex-col gap-3.5">
        <Cartao titulo="Veículo">
          <div className="flex flex-wrap items-center gap-6">
            <PlacaBadge placa={v.placa} tam="lg" />
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2.5">
              <div><dt className="text-xs text-aco">Marca / modelo</dt><dd className="text-base">{modeloDoVeiculo(v)}</dd></div>
              <div><dt className="text-xs text-aco">Ano</dt><dd className="text-base tabular-nums">{anosDoVeiculo(v)}</dd></div>
              <div><dt className="text-xs text-aco">Chassi</dt><dd className="font-mono text-sm">{v.chassi || '—'}</dd></div>
              <div><dt className="text-xs text-aco">Cliente</dt><dd className="text-base"><Link to={`/clientes/${v.clienteId}`} className="font-medium text-mercosul hover:underline">{v.clienteNome}</Link></dd></div>
            </dl>
          </div>
        </Cartao>

        <Cartao titulo="Histórico de consultas veiculares">
          {consultasQ.isPending ? <Skeleton className="h-16" />
            : consultasQ.isError ? <ErrorState onRetry={() => void consultasQ.refetch()} />
            : consultasQ.data.length === 0 ? <EmptyState mensagem="Nenhuma consulta realizada para este veículo." />
            : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>{['Data', 'Fonte', 'Resultado'].map((h) => <th key={h} scope="col" className="bg-fundo px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.6px] text-aco">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {consultasQ.data.map((c) => (
                    <tr key={c.id} className="h-[42px] border-b border-linha-fraca">
                      <td className="px-3 text-sm tabular-nums">{dataHora(c.consultadoEm)}</td>
                      <td className="px-3 text-sm">{c.fonte}</td>
                      <td className="px-3 text-sm">{c.resultado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Cartao>
      </div>
    </Pagina>
  );
}
