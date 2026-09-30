import { useRef } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { naoEncontrado } from '@/lib/erros';
import { Cartao } from '@/components/Cartao';
import { ErrorState } from '@/components/ErrorState';
import { OrigemTag } from '@/components/OrigemTag';
import { Pagina } from '@/components/Pagina';
import { PlacaBadge } from '@/components/PlacaBadge';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { FLUXO, PROXIMO_PASSO } from '@/components/status';
import { useVinculosDoServico } from '@/features/estoque/api';
import { useHistorico, usePagamentosDoPedido, usePedido } from './api';
import { LinhaDoTempo } from './LinhaDoTempo';
import { PagamentoCard } from './PagamentoCard';
import { useTrocaStatus } from './useTrocaStatus';

/** Aviso âmbar com os itens que serão baixados do estoque (vem da API; sem vínculos, não há baixa e o aviso some). */
function AvisoBaixaEstoque({ servicoId }: { servicoId: number }) {
  const q = useVinculosDoServico(servicoId);
  if (!q.data || q.data.length === 0) return null;
  return (
    <p role="note" className="rounded-md border border-alerta-borda bg-alerta-bg px-3 py-2 text-sm text-alerta-texto">
      Baixa automática de estoque: {q.data.map((v) => `−${v.quantidadeNecessaria} ${v.itemEstoqueNome}`).join(', ')}
    </p>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-aco">{rotulo}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}

export function PedidoDetalhePage() {
  const id = Number(useParams().id);
  const pedidoQ = usePedido(id);
  const histQ = useHistorico(id);
  const pagQ = usePagamentosDoPedido(id);
  const { solicitar, dialogo, processando } = useTrocaStatus();
  const formaRef = useRef<HTMLSelectElement>(null);

  const voltar = (
    <Link to="/pedidos" className="flex items-center gap-1 text-sm font-semibold text-mercosul hover:underline">
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      Pedidos
    </Link>
  );

  if (pedidoQ.isPending) {
    return (
      <div className="max-w-[1200px] px-6 py-5" aria-busy="true">
        <div className="mb-3.5">{voltar}</div>
        <div className="grid grid-cols-[1.6fr_1fr] gap-3.5 max-[899px]:grid-cols-1">
          <div className="flex flex-col gap-3.5"><Skeleton className="h-[170px]" /><Skeleton className="h-[130px]" /><Skeleton className="h-[130px]" /></div>
          <Skeleton className="h-[320px]" />
        </div>
      </div>
    );
  }
  if (pedidoQ.isError) {
    const naoExiste = naoEncontrado(pedidoQ.error);
    return (
      <div className="max-w-[1200px] px-6 py-5">
        <div className="mb-3.5">{voltar}</div>
        <ErrorState mensagem={naoExiste ? 'Pedido não encontrado.' : undefined} onRetry={() => void pedidoQ.refetch()} />
      </div>
    );
  }

  const pedido = pedidoQ.data;
  const pago = pedido.pago; // vem da API (soma dos pagamentos PAGO ≥ preço do serviço)
  const alvo = { id: pedido.id, status: pedido.status, pago };

  const idx = FLUXO.indexOf(pedido.status);
  const proximoStatus = idx >= 0 && idx < FLUXO.length - 1 ? FLUXO[idx + 1] : undefined;
  const entregueSemPagar = pedido.status === 'ENTREGUE' && pago === false;
  // Regra de produto: só dá para cancelar antes de a placa ficar pronta (o backend só trava os status finais).
  const podeCancelar = pedido.status === 'RECEBIDO' || pedido.status === 'EM_PROCESSAMENTO';

  const acaoPrincipal = () => {
    if (entregueSemPagar) { formaRef.current?.focus(); formaRef.current?.scrollIntoView?.({ block: "center" }); return; }
    if (proximoStatus) solicitar(alvo, proximoStatus);
  };
  const rotuloPrincipal = entregueSemPagar ? 'Registrar pagamento' : PROXIMO_PASSO[pedido.status];

  return (
    <Pagina
      titulo={<span className="font-mono">#{pedido.id}</span>}
      acoes={
        <>
          <StatusBadge status={pedido.status} />
          {podeCancelar && (
            <Menu.Root>
              <Menu.Trigger
                aria-label="Mais ações"
                className="flex h-[30px] items-center gap-1 rounded border border-linha-forte bg-white px-2.5 text-sm font-medium text-aco hover:bg-fundo"
              >
                Ações <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content align="end" className="z-50 min-w-[170px] rounded-md border border-linha bg-white p-1 shadow-placa">
                  <Menu.Item
                    onSelect={() => solicitar(alvo, 'CANCELADO')}
                    className="cursor-pointer rounded-sm px-3 py-2 text-sm font-medium text-erro outline-none data-[highlighted]:bg-erro-bg"
                  >
                    Cancelar pedido
                  </Menu.Item>
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          )}
        </>
      }
    >
      <div className="-mt-2 mb-3.5">{voltar}</div>

      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-3.5 max-[899px]:grid-cols-1">
        <div className="flex flex-col gap-3.5">
          <Cartao titulo="Veículo">
            <div className="flex flex-wrap items-center gap-5">
              <PlacaBadge placa={pedido.veiculo.placa} tam="lg" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                <Campo rotulo="Marca / modelo">{pedido.veiculo.marcaModelo}</Campo>
                <Campo rotulo="Ano">{pedido.veiculo.anoFabricacao}/{pedido.veiculo.anoModelo}</Campo>
                {pedido.veiculo.chassi && <Campo rotulo="Chassi"><span className="font-mono text-sm">{pedido.veiculo.chassi}</span></Campo>}
              </dl>
            </div>
          </Cartao>

          <Cartao titulo="Cliente">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <Campo rotulo="Nome"><Link to={`/clientes/${pedido.cliente.id}`} className="font-medium text-mercosul hover:underline">{pedido.cliente.nome}</Link></Campo>
              <Campo rotulo="CPF/CNPJ"><span className="tabular-nums">{pedido.cliente.cpfCnpj}</span></Campo>
              <Campo rotulo="Telefone"><span className="tabular-nums">{pedido.cliente.telefone}</span></Campo>
              <Campo rotulo="Origem"><OrigemTag origem={pedido.origem} /></Campo>
            </dl>
          </Cartao>

          {pagQ.isPending ? <Skeleton className="h-[130px]" /> : <PagamentoCard ref={formaRef} pedido={pedido} pagamentos={pagQ.data ?? []} />}
        </div>

        <div className="flex flex-col gap-3.5">
          {rotuloPrincipal && (
            <button
              type="button"
              disabled={processando}
              onClick={acaoPrincipal}
              className="h-10 rounded bg-mercosul px-4 text-base font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60"
            >
              {rotuloPrincipal}
            </button>
          )}
          {pedido.status === 'RECEBIDO' && <AvisoBaixaEstoque servicoId={pedido.servico.id} />}
          {pedido.status === 'CANCELADO' && <p className="text-sm text-aco">Este pedido foi cancelado.</p>}

          <Cartao titulo="Linha do tempo">
            {histQ.isPending ? <Skeleton className="h-[160px]" />
              : histQ.isError ? <ErrorState onRetry={() => void histQ.refetch()} />
              : <LinhaDoTempo historico={histQ.data} status={pedido.status} />}
          </Cartao>
        </div>
      </div>
      {dialogo}
    </Pagina>
  );
}

