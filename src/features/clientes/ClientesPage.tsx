import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Cliente, Veiculo } from '@/api/types';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Pagina } from '@/components/Pagina';
import { PlacaBadge } from '@/components/PlacaBadge';
import { useToast } from '@/components/Toast';
import { useVeiculos } from '@/features/veiculos/api';
import { useDebounce } from '@/lib/useDebounce';
import { useClientes } from './api';
import { ClientePainel } from './ClientePainel';

export function ClientesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const buscaUrl = sp.get('busca') ?? '';
  const [texto, setTexto] = useState(buscaUrl);
  const busca = useDebounce(texto.trim(), 200);
  const [painel, setPainel] = useState(false);

  useEffect(() => {
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      if (busca) n.set('busca', busca); else n.delete('busca');
      return n;
    }, { replace: true });
  }, [busca, setSp]);

  const clientesQ = useClientes(buscaUrl || undefined);
  const veiculosQ = useVeiculos(); // uma chamada; agrupa por cliente no front

  const porCliente = useMemo(() => {
    const m = new Map<number, Veiculo[]>();
    (veiculosQ.data ?? []).forEach((v) => m.set(v.clienteId, [...(m.get(v.clienteId) ?? []), v]));
    return m;
  }, [veiculosQ.data]);

  const colunas = useMemo<ColumnDef<Cliente>[]>(() => [
    { header: 'Nome', cell: ({ row }) => <span className="font-medium">{row.original.nome}</span> },
    { header: 'CPF/CNPJ', cell: ({ row }) => <span className="tabular-nums">{row.original.cpfCnpj}</span> },
    { header: 'Telefone', cell: ({ row }) => <span className="tabular-nums">{row.original.telefone}</span> },
    {
      header: 'Veículos',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {(porCliente.get(row.original.id) ?? []).map((v) => <PlacaBadge key={v.id} placa={v.placa} />)}
          {veiculosQ.isSuccess && !porCliente.has(row.original.id) && <span className="text-aco">—</span>}
        </span>
      ),
    },
    { header: 'Pedidos', meta: { align: 'right' }, cell: ({ row }) => <span className="tabular-nums">{row.original.totalPedidos ?? '—'}</span> },
  ], [porCliente, veiculosQ.isSuccess]);

  const lista = clientesQ.data ?? [];
  const estado = clientesQ.isPending ? 'loading' : clientesQ.isError ? 'erro' : lista.length === 0 ? 'vazio' : 'ok';

  return (
    <Pagina
      titulo="Clientes"
      contagem={clientesQ.isSuccess ? `${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'}` : undefined}
      acoes={
        <>
          <label className="sr-only" htmlFor="busca-clientes">Buscar cliente</label>
          <input
            id="busca-clientes" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nome, telefone ou CPF/CNPJ"
            className="h-[30px] w-[280px] rounded border border-linha-forte bg-white px-2 text-sm"
          />
          <button type="button" onClick={() => setPainel(true)} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover">
            + Novo cliente
          </button>
        </>
      }
    >
      <div className="overflow-hidden rounded-md border border-linha bg-white shadow-card">
        <DataTable
          columns={colunas} data={lista} estado={estado} onRetry={() => void clientesQ.refetch()}
          onRowClick={(c) => navigate(`/clientes/${c.id}`)}
          vazio={
            buscaUrl
              ? <EmptyState mensagem={`Nenhum cliente encontrado para "${buscaUrl}".`} acao={{ label: 'Cadastrar', onClick: () => setPainel(true) }} />
              : <EmptyState mensagem="Nenhum cliente cadastrado ainda." acao={{ label: 'Cadastrar', onClick: () => setPainel(true) }} />
          }
        />
      </div>

      <ClientePainel
        aberto={painel}
        descricao="Depois de salvar, você vai para a página do cliente."
        onFechar={() => setPainel(false)}
        onSalvo={(c) => { setPainel(false); toast(`Cliente ${c.nome} cadastrado`); navigate(`/clientes/${c.id}`); }}
      />
    </Pagina>
  );
}
