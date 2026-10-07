import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/Skeleton';
import type { EntidadeAuditada, RegistroAuditoria } from '@/api/types';
import { nomeAutor } from '@/lib/autor';
import { dataHoraCompleta } from '@/lib/datas';
import { useDevolverFoco } from '@/lib/useDevolverFoco';
import { fmt } from '@/lib/money';
import { rotuloPapel } from '@/features/usuarios/api';
import type { Papel } from '@/auth/papeis';
import { useAuditoria } from './api';

const ROTULO_CAMPO: Record<EntidadeAuditada, Record<string, string>> = {
  SERVICO: { nome: 'Nome', descricao: 'Descrição', precoCentavos: 'Preço', categoria: 'Categoria' },
  USUARIO: { nome: 'Nome', email: 'E-mail', papel: 'Papel' },
};

/** Os valores vêm SEMPRE como texto (inclusive `precoCentavos`): converte na hora de exibir. */
function formatarValor(entidade: EntidadeAuditada, campo: string | null, valor: string | null): string {
  if (valor === null || valor === '') return '—';
  if (entidade === 'SERVICO' && campo === 'precoCentavos' && /^-?\d+$/.test(valor)) return fmt(Number(valor));
  if (entidade === 'USUARIO' && campo === 'papel') return rotuloPapel(valor as Papel);
  return valor;
}

/** Texto da linha: "Preço: R$ 300,00 → R$ 600,00", "Senha redefinida"… (a senha nunca é registrada, só que ocorreu). */
export function descreverRegistro(r: RegistroAuditoria): string {
  switch (r.acao) {
    case 'CRIACAO': return r.entidade === 'SERVICO' ? 'Serviço criado' : 'Usuário criado';
    case 'ATIVACAO': return r.entidade === 'SERVICO' ? 'Serviço ativado' : 'Usuário reativado';
    case 'DESATIVACAO': return r.entidade === 'SERVICO' ? 'Serviço desativado' : 'Usuário desativado';
    case 'RESET_SENHA': return 'Senha redefinida';
    case 'ATUALIZACAO': {
      const rotulo = (r.campo && ROTULO_CAMPO[r.entidade][r.campo]) || r.campo || 'Campo';
      return `${rotulo}: ${formatarValor(r.entidade, r.campo, r.valorAnterior)} → ${formatarValor(r.entidade, r.campo, r.valorNovo)}`;
    }
  }
}

type Props = {
  entidade: EntidadeAuditada;
  /** `null` = fechado. */
  alvo: { id: number; descricao: string } | null;
  onFechar: () => void;
};

/**
 * Histórico administrativo de um serviço ou usuário (`GET /auditoria`). Uma linha por campo alterado, com quem fez e quando
 * (hora de São Paulo). Em serviços, o filtro "Preço" mostra a evolução do preço. O nome do autor é o gravado na hora da ação.
 */
export function HistoricoModal({ entidade, alvo, onFechar }: Props) {
  const devolverFoco = useDevolverFoco(alvo !== null);
  const q = useAuditoria(entidade, alvo?.id ?? null);
  const [filtro, setFiltro] = useState<'tudo' | 'preco'>('tudo');
  const linhas = (q.data ?? []).filter((r) => filtro === 'tudo' || (r.acao === 'ATUALIZACAO' && r.campo === 'precoCentavos'));

  return (
    <Dialog.Root open={alvo !== null} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content onCloseAutoFocus={devolverFoco} className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[560px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white p-5 shadow-placa">
          <Dialog.Title className="font-display text-[18px] font-bold">Histórico de {alvo?.descricao}</Dialog.Title>
          <Dialog.Description className="sr-only">Quem alterou, o quê e quando, do mais recente para o mais antigo.</Dialog.Description>

          {entidade === 'SERVICO' && (
            <div className="mt-3">
              <SegmentedControl
                ariaLabel="Filtro do histórico" valor={filtro} onChange={setFiltro}
                opcoes={[{ valor: 'tudo', label: 'Tudo' }, { valor: 'preco', label: 'Só preço' }]}
              />
            </div>
          )}

          <div className="mt-3 min-h-[80px] overflow-auto">
            {q.isPending ? <Skeleton className="h-[120px]" />
              : q.isError ? <ErrorState onRetry={() => void q.refetch()} />
              : linhas.length === 0 ? <EmptyState mensagem={filtro === 'preco' ? 'O preço nunca foi alterado.' : 'Nenhum registro de alteração.'} />
              : (
                <ol aria-label="Registros de alteração" className="flex flex-col">
                  {linhas.map((r) => (
                    <li key={r.id} className="border-b border-linha-fraca py-2.5 last:border-b-0">
                      <div className="text-base">{descreverRegistro(r)}</div>
                      <div className="mt-0.5 text-xs text-aco">
                        {nomeAutor(r.feitoPor)} · <time dateTime={r.feitoEm}>{dataHoraCompleta(r.feitoEm)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
          </div>

          <div className="mt-4 flex justify-end">
            <Dialog.Close className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Fechar</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
