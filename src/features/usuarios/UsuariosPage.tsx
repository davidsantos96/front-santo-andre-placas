import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';
import type { Usuario } from '@/api/types';
import { useSessao } from '@/auth/SessionProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { Pagina } from '@/components/Pagina';
import { useToast } from '@/components/Toast';
import { dataHora } from '@/lib/datas';
import { rotuloPapel, useAlterarStatusUsuario, useUsuarios } from './api';
import { HistoricoModal } from '@/features/auditoria/HistoricoModal';
import { RedefinirSenhaModal } from './RedefinirSenhaModal';
import { UsuarioModal } from './UsuarioModal';

const btn = 'h-[26px] rounded border border-linha-forte bg-white px-2.5 text-sm font-medium text-aco hover:bg-fundo disabled:cursor-not-allowed disabled:opacity-50';

export function UsuariosPage() {
  const q = useUsuarios();
  const { usuario: eu } = useSessao();
  const toast = useToast();
  const { mutate: alterarStatus } = useAlterarStatusUsuario();
  const [modal, setModal] = useState<Usuario | 'novo' | null>(null);
  const [desativando, setDesativando] = useState<Usuario | null>(null);
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null);
  const [historico, setHistorico] = useState<Usuario | null>(null);

  const alterar = (u: Usuario, ativo: boolean) =>
    alterarStatus({ id: u.id, ativo }, {
      onSuccess: () => toast(`${u.nome} ${ativo ? 'reativado' : 'desativado'}`),
      onError: (e) => toast(`Não foi possível alterar ${u.nome}: ${e.mensagem}`, 'erro'),
    });

  // Colunas estáticas (handlers estáveis): as células não remontam e o foco nos botões se mantém.
  const colunas = useMemo<ColumnDef<Usuario>[]>(() => [
    { header: 'Nome', cell: ({ row }) => <span className={clsx('font-medium', !row.original.ativo && 'text-aco')}>{row.original.nome}</span> },
    { header: 'E-mail', cell: ({ row }) => <span className="text-aco">{row.original.email}</span> },
    { header: 'Papel', cell: ({ row }) => <span className="rounded-sm border border-linha-badge px-1.5 py-[1.5px] text-[11px] font-semibold tracking-[0.6px] text-aco-700">{rotuloPapel(row.original.papel)}</span> },
    {
      header: 'Status',
      cell: ({ row }) => (
        <span className={clsx('inline-block rounded-[10px] px-[9px] py-[2px] text-[11px] font-semibold', row.original.ativo ? 'bg-ok-bg text-ok-texto' : 'bg-linha text-aco-700')}>
          {row.original.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      header: 'Último acesso',
      cell: ({ row }) => <span className="tabular-nums text-aco">{row.original.ultimoAcessoEm ? dataHora(row.original.ultimoAcessoEm) : 'Nunca acessou'}</span>,
    },
    {
      header: 'Ações',
      cell: ({ row }) => {
        const u = row.original;
        const ehEu = u.email.toLowerCase() === eu?.email.toLowerCase();
        return (
          <span className="flex gap-2">
            <button type="button" className={btn} onClick={() => setModal(u)} aria-label={`Editar ${u.nome}`}>Editar</button>
            <button type="button" className={btn} onClick={() => setSenhaDe(u)} aria-label={`Redefinir senha de ${u.nome}`}>Redefinir senha</button>
            <button type="button" className={btn} onClick={() => setHistorico(u)} aria-label={`Histórico de ${u.nome}`}>Histórico</button>
            {u.ativo ? (
              <button
                type="button" className={btn} onClick={() => setDesativando(u)} aria-label={`Desativar ${u.nome}`}
                disabled={ehEu} title={ehEu ? 'Você não pode desativar o próprio usuário' : undefined}
              >
                Desativar
              </button>
            ) : (
              <button type="button" className={btn} onClick={() => alterar(u, true)} aria-label={`Reativar ${u.nome}`}>Reativar</button>
            )}
          </span>
        );
      },
    },
  ], [eu?.email, alterarStatus, toast]);

  const lista = q.data ?? [];
  const estado = q.isPending ? 'loading' : q.isError ? 'erro' : lista.length === 0 ? 'vazio' : 'ok';

  return (
    <Pagina
      titulo="Usuários"
      contagem={q.isSuccess ? `${lista.length} ${lista.length === 1 ? 'usuário' : 'usuários'}` : undefined}
      acoes={<button type="button" onClick={() => setModal('novo')} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover">+ Novo usuário</button>}
    >
      <div className="overflow-hidden rounded-md border border-linha bg-white shadow-card">
        <DataTable
          columns={colunas} data={lista} estado={estado} onRetry={() => void q.refetch()} minWidth={720}
          vazio={<EmptyState mensagem="Nenhum usuário cadastrado." acao={{ label: 'Criar usuário', onClick: () => setModal('novo') }} />}
        />
      </div>

      <UsuarioModal key={modal === 'novo' ? 'novo' : modal?.id ?? 'fechado'} usuario={modal} onFechar={() => setModal(null)} />
      <HistoricoModal entidade="USUARIO" alvo={historico && { id: historico.id, descricao: historico.nome }} onFechar={() => setHistorico(null)} />
      <RedefinirSenhaModal key={senhaDe?.id ?? 'fechado'} usuario={senhaDe} onFechar={() => setSenhaDe(null)} />
      <ConfirmDialog
        aberto={desativando !== null} perigo onFechar={() => setDesativando(null)}
        onConfirmar={() => { if (desativando) alterar(desativando, false); setDesativando(null); }}
        titulo={`Desativar ${desativando?.nome ?? ''}?`}
        descricao="O usuário não conseguirá mais entrar no sistema. Você poderá reativá-lo depois."
        confirmar="Desativar"
      />
    </Pagina>
  );
}
