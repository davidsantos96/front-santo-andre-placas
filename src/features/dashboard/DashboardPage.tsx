import { ErrorState } from '@/components/ErrorState';
import { KpiCard } from '@/components/KpiCard';
import { Money } from '@/components/Money';
import { Pagina } from '@/components/Pagina';
import { Skeleton } from '@/components/Skeleton';
import { Cartao } from '@/components/Cartao';
import { features } from '@/config/features';
import { useResumo } from './api';
import { FaturamentoCard } from './FaturamentoCard';
import { FilaCard, OrigemCard, ServicosMaisVendidosCard, TempoMedioCard } from './CartoesResumo';

export function DashboardPage() {
  const q = useResumo();

  return (
    <Pagina titulo="Dashboard">
      {q.isPending ? (
        <div className="grid grid-cols-4 gap-3.5 max-[899px]:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[86px]" />)}</div>
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (
        <div className="grid grid-cols-4 gap-3.5 max-[899px]:grid-cols-2">
          <KpiCard rotulo="PEDIDOS HOJE" valor={q.data.pedidosHoje} />
          <KpiCard rotulo="EM PRODUÇÃO" valor={q.data.pedidosPorStatus.EM_PROCESSAMENTO ?? 0} />
          <KpiCard rotulo="PRONTOS PARA ENTREGA" valor={q.data.pedidosPorStatus.PLACA_PRONTA ?? 0} />
          <KpiCard destaque rotulo="FATURAMENTO HOJE" valor={<Money centavos={q.data.faturamentoHojeCentavos} />} />
        </div>
      )}

      <div className="mt-3.5 grid grid-cols-[1.6fr_1fr] gap-3.5 max-[899px]:grid-cols-1">
        <FaturamentoCard />
        <ServicosMaisVendidosCard />
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-3.5 max-[899px]:grid-cols-1">
        <TempoMedioCard />
        <OrigemCard />
        <FilaCard />
      </div>

      {/* Espaço reservado (Fase 2 do produto): só aparece com a feature flag `metas` ativa. */}
      {features.metas && (
        <Cartao titulo="Progresso de metas" className="mt-3.5"><p className="text-sm text-aco">Em breve.</p></Cartao>
      )}
    </Pagina>
  );
}
