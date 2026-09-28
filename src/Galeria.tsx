import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { PlacaBadge } from '@/components/PlacaBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Money } from '@/components/Money';
import { MoneyInput } from '@/components/MoneyInput';
import { PlacaCard } from '@/components/PlacaCard';
import { DataTable } from '@/components/DataTable';
import { KpiCard } from '@/components/KpiCard';
import { Tabs } from '@/components/Tabs';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { OrigemTag } from '@/components/OrigemTag';
import { PendenteTag } from '@/components/PendenteTag';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { STATUS, FORMA_PAGAMENTO, type StatusPedido } from '@/components/status';

type Linha = { id: number; placa: string; cliente: string; status: StatusPedido; valor: number };
const dados: Linha[] = [
  { id: 1058, placa: 'ABC1D23', cliente: 'Bruna Costa', status: 'RECEBIDO', valor: 31690 },
  { id: 1057, placa: 'RIO2A18', cliente: 'Marcos Lima', status: 'PLACA_PRONTA', valor: 28900 },
  { id: 1056, placa: 'SAP0001', cliente: 'Auto Peças SA', status: 'ENTREGUE', valor: 45000 },
];
const colunas: ColumnDef<Linha>[] = [
  { header: 'Nº', accessorKey: 'id', cell: (c) => <span className="font-mono text-xs text-aco">#{c.getValue<number>()}</span> },
  { header: 'Placa', accessorKey: 'placa', cell: (c) => <PlacaBadge placa={c.getValue<string>()} /> },
  { header: 'Cliente', accessorKey: 'cliente' },
  { header: 'Status', accessorKey: 'status', cell: (c) => <StatusBadge status={c.getValue<StatusPedido>()} /> },
  { header: 'Valor', accessorKey: 'valor', meta: { align: 'right' }, cell: (c) => <Money centavos={c.getValue<number>()} /> },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-[14px] font-bold uppercase tracking-[0.5px] text-aco">{titulo}</h2>
      {children}
    </section>
  );
}

export function Galeria() {
  const [visao, setVisao] = useState<'quadro' | 'tabela'>('quadro');
  const [preco, setPreco] = useState(31690);
  const [dialog, setDialog] = useState(false);
  const toast = useToast();

  return (
    <BrowserRouter>
      <div className="mx-auto max-w-[1200px] px-6 py-5">
        <h1 className="mb-1 font-display text-[22px] font-bold">Galeria de componentes</h1>
        <p className="mb-5 text-sm text-aco">Fase 2 — página temporária de revisão (sai na Fase 3).</p>

        <Secao titulo="PlacaBadge">
          <div className="flex flex-wrap items-end gap-6 rounded-md bg-white p-4">
            <PlacaBadge placa="ABC1D23" tam="sm" />
            <PlacaBadge placa="ABC1D23" tam="md" />
            <PlacaBadge placa="SAP0001" tam="lg" />
          </div>
        </Secao>

        <Secao titulo="StatusBadge · OrigemTag · PendenteTag">
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-white p-4">
            {(Object.keys(STATUS) as StatusPedido[]).map((s) => <StatusBadge key={s} status={s} />)}
            <OrigemTag origem="WHATSAPP" /><OrigemTag origem="BALCAO" /><PendenteTag />
          </div>
        </Secao>

        <Secao titulo="KpiCard">
          <div className="grid grid-cols-2 gap-3.5 min-[900px]:grid-cols-4">
            <KpiCard rotulo="PEDIDOS HOJE" valor="12" sub="+3 vs ontem" />
            <KpiCard rotulo="EM PRODUÇÃO" valor="4" />
            <KpiCard rotulo="PIX" valor={<Money centavos={124500} />} sub="5 pagamentos" marcador={FORMA_PAGAMENTO.PIX.cor} />
            <KpiCard rotulo="TOTAL DO DIA" valor={<Money centavos={316900} />} sub="9 pagamentos" destaque />
          </div>
        </Secao>

        <Secao titulo="PlacaCard + DataTable (linha clicável, Enter abre)">
          <PlacaCard titulo="PEDIDOS · SP">
            <DataTable columns={colunas} data={dados} estado="ok" onRowClick={(l) => toast(`Abrir pedido #${l.id}`)} />
          </PlacaCard>
        </Secao>

        <Secao titulo="Estados da tabela">
          <div className="grid gap-3.5 min-[900px]:grid-cols-3">
            <PlacaCard titulo="CARREGANDO"><DataTable columns={colunas.slice(0, 3)} data={[]} estado="loading" minWidth={0} /></PlacaCard>
            <PlacaCard titulo="VAZIO"><DataTable columns={colunas.slice(0, 3)} data={[]} estado="vazio" minWidth={0} vazio={<EmptyState mensagem="Nenhum pedido hoje ainda" acao={{ label: 'Criar pedido', onClick: () => toast('Criar') }} />} /></PlacaCard>
            <PlacaCard titulo="ERRO"><DataTable columns={colunas.slice(0, 3)} data={[]} estado="erro" minWidth={0} onRetry={() => toast('Tentando…')} /></PlacaCard>
          </div>
          <div className="mt-3 rounded-md bg-white"><ErrorState onRetry={() => {}} /></div>
        </Secao>

        <Secao titulo="Controles">
          <div className="flex flex-wrap items-center gap-4 rounded-md bg-white p-4">
            <SegmentedControl ariaLabel="Visão" valor={visao} onChange={setVisao} opcoes={[{ valor: 'quadro', label: 'Quadro' }, { valor: 'tabela', label: 'Tabela' }]} />
            <MoneyInput aria-label="Preço" value={preco} onChange={setPreco} className="w-32" />
            <span className="text-sm text-aco">emite {preco} centavos</span>
            <button type="button" onClick={() => toast('Pagamento registrado — R$ 316,90 via Pix')} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover">Toast</button>
            <button type="button" onClick={() => toast('Falhou ao mudar status', 'erro')} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Toast erro</button>
            <button type="button" onClick={() => setDialog(true)} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">ConfirmDialog</button>
          </div>
        </Secao>

        <Secao titulo="Tabs (?aba=)">
          <Tabs abas={[
            { id: 'pagamentos', label: 'Pagamentos', tag: 12, conteudo: <p className="text-sm text-aco">Conteúdo Pagamentos</p> },
            { id: 'caixa', label: 'Caixa', conteudo: <p className="text-sm text-aco">Conteúdo Caixa</p> },
          ]} />
        </Secao>

        <ConfirmDialog aberto={dialog} perigo onFechar={() => setDialog(false)} onConfirmar={() => { setDialog(false); toast('Pedido cancelado'); }}
          titulo="Cancelar pedido?" descricao="Esta ação não pode ser desfeita." confirmar="Cancelar pedido" />
      </div>
    </BrowserRouter>
  );
}
