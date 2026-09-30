import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Cliente } from '@/api/types';
import { naoEncontrado } from '@/lib/erros';
import { Cartao } from '@/components/Cartao';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Pagina } from '@/components/Pagina';
import { Skeleton } from '@/components/Skeleton';
import { Tabs } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import { usePedidos } from '@/features/pedidos/api';
import { PedidosTable } from '@/features/pedidos/PedidosTable';
import { useVeiculos } from '@/features/veiculos/api';
import { VeiculoForm } from '@/features/veiculos/VeiculoForm';
import { VeiculosTable } from '@/features/veiculos/VeiculosTable';
import { useCliente } from './api';
import { ClienteForm } from './ClienteForm';

function Dados({ cliente }: { cliente: Cliente }) {
  const [editando, setEditando] = useState(false);
  const toast = useToast();
  return (
    <Cartao titulo="Dados do cliente" className="max-w-[640px]">
      {editando ? (
        <ClienteForm inicial={cliente} onCancelar={() => setEditando(false)} onSalvo={() => { setEditando(false); toast('Cliente atualizado'); }} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div><dt className="text-xs text-aco">Nome</dt><dd className="text-base">{cliente.nome}</dd></div>
            <div><dt className="text-xs text-aco">CPF/CNPJ</dt><dd className="text-base tabular-nums">{cliente.cpfCnpj}</dd></div>
            <div><dt className="text-xs text-aco">Telefone</dt><dd className="text-base tabular-nums">{cliente.telefone}</dd></div>
            <div><dt className="text-xs text-aco">E-mail</dt><dd className="text-base">{cliente.email || '—'}</dd></div>
          </dl>
          <button type="button" onClick={() => setEditando(true)} className="mt-4 h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">
            Editar
          </button>
        </>
      )}
    </Cartao>
  );
}

function AbaVeiculos({ cliente }: { cliente: Cliente }) {
  const q = useVeiculos({ clienteId: cliente.id });
  const [novo, setNovo] = useState(false);
  const toast = useToast();
  const lista = q.data ?? [];
  const estado = q.isPending ? 'loading' : q.isError ? 'erro' : lista.length === 0 ? 'vazio' : 'ok';
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        {novo ? (
          <div className="max-w-[640px]">
            <VeiculoForm clienteId={cliente.id} onCancelar={() => setNovo(false)} onSalvo={(v) => { setNovo(false); toast(`Veículo ${v.placa} cadastrado`); }} />
          </div>
        ) : (
          <button type="button" onClick={() => setNovo(true)} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover">+ Novo veículo</button>
        )}
      </div>
      <VeiculosTable
        veiculos={lista} estado={estado} mostrarCliente={false} onRetry={() => void q.refetch()}
        vazio={<EmptyState mensagem="Este cliente ainda não tem veículos." />}
      />
    </div>
  );
}

export function ClienteDetalhePage() {
  const id = Number(useParams().id);
  const q = useCliente(id);
  const veiculosQ = useVeiculos({ clienteId: id });
  const pedidosQ = usePedidos({ clienteId: id, size: 1 });

  const voltar = (
    <Link to="/clientes" className="flex items-center gap-1 text-sm font-semibold text-mercosul hover:underline">
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      Clientes
    </Link>
  );

  if (q.isPending) return <div className="max-w-[1200px] px-6 py-5" aria-busy="true"><div className="mb-3.5">{voltar}</div><Skeleton className="h-[180px] max-w-[640px]" /></div>;
  if (q.isError) {
    const naoExiste = naoEncontrado(q.error);
    return (
      <div className="max-w-[1200px] px-6 py-5">
        <div className="mb-3.5">{voltar}</div>
        <ErrorState mensagem={naoExiste ? 'Cliente não encontrado.' : undefined} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const cliente = q.data;
  return (
    <Pagina titulo={cliente.nome}>
      <div className="-mt-2 mb-3.5">{voltar}</div>
      <Tabs
        abas={[
          { id: 'dados', label: 'Dados', conteudo: <Dados cliente={cliente} /> },
          { id: 'veiculos', label: 'Veículos', tag: veiculosQ.data?.length, conteudo: <AbaVeiculos cliente={cliente} /> },
          { id: 'pedidos', label: 'Pedidos', tag: pedidosQ.data?.page.totalElements, conteudo: <PedidosTable clienteId={cliente.id} /> },
        ]}
      />
    </Pagina>
  );
}
