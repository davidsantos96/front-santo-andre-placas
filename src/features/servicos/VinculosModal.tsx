import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { z } from 'zod';
import type { ApiError, Servico } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useCriarVinculo, useEstoque, useRemoverVinculo, useVinculosDoServico } from '@/features/estoque/api';
import { useDevolverFoco } from '@/lib/useDevolverFoco';

const schema = z.object({
  itemEstoqueId: z.string().min(1, 'Escolha o item'),
  quantidade: z.string().regex(/^\d+$/, 'Informe um número inteiro').refine((v) => Number(v) > 0, 'A quantidade deve ser maior que zero'),
});
type Dados = z.infer<typeof schema>;

const campo = 'mt-1 block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base';

function Conteudo({ servico }: { servico: Servico }) {
  const toast = useToast();
  const vinculos = useVinculosDoServico(servico.id);
  const estoque = useEstoque();
  const criar = useCriarVinculo(servico.id);
  const remover = useRemoverVinculo(servico.id);
  const [erroApi, setErroApi] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(schema),
    defaultValues: { itemEstoqueId: '', quantidade: '1' },
  });

  const lista = vinculos.data ?? [];
  const jaVinculados = new Set(lista.map((v) => v.itemEstoqueId));
  // um item só entra uma vez por serviço (o backend recusa repetido): para mudar a quantidade, remove e vincula de novo
  const disponiveis = (estoque.data ?? []).filter((i) => !jaVinculados.has(i.id));

  const vincular = handleSubmit(async (d) => {
    setErroApi(null);
    const item = disponiveis.find((i) => i.id === Number(d.itemEstoqueId));
    try {
      await criar.mutateAsync({ itemEstoqueId: Number(d.itemEstoqueId), quantidadeNecessaria: Number(d.quantidade) });
      toast(`${item?.nome ?? 'Item'} vinculado a ${servico.nome}`);
      reset();
    } catch (e) {
      setErroApi((e as ApiError).mensagem);
    }
  });

  const desvincular = async (id: number, nome: string) => {
    setErroApi(null);
    try {
      await remover.mutateAsync(id);
      toast(`${nome} desvinculado de ${servico.nome}`);
    } catch (e) {
      setErroApi((e as ApiError).mensagem);
    }
  };

  if (vinculos.isPending || estoque.isPending) return <Skeleton className="mt-4 h-[140px]" />;
  if (vinculos.isError || estoque.isError) {
    return <div className="mt-4"><ErrorState onRetry={() => { void vinculos.refetch(); void estoque.refetch(); }} /></div>;
  }

  return (
    <>
      {lista.length === 0 ? (
        <p className="mt-4 rounded bg-fundo px-3 py-2.5 text-sm text-aco">
          Nenhum item vinculado: pedidos deste serviço não dão baixa no estoque.
        </p>
      ) : (
        <ul aria-label="Itens vinculados" className="mt-4 flex flex-col">
          {lista.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 border-b border-linha-fraca py-2 last:border-b-0">
              <span className="text-base">
                <span className="font-medium">{v.itemEstoqueNome}</span>
                <span className="ml-2 text-sm tabular-nums text-aco">−{v.quantidadeNecessaria} por pedido</span>
              </span>
              <button
                type="button" disabled={remover.isPending} aria-label={`Remover ${v.itemEstoqueNome}`}
                onClick={() => void desvincular(v.id, v.itemEstoqueNome)}
                className="h-[26px] shrink-0 rounded border border-linha-forte bg-white px-2.5 text-sm font-medium text-aco hover:bg-fundo disabled:opacity-60"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {(estoque.data ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-aco">Cadastre itens na tela de Estoque para poder vincular.</p>
      ) : disponiveis.length === 0 ? (
        <p className="mt-4 text-sm text-aco">Todos os itens de estoque já estão vinculados a este serviço.</p>
      ) : (
        <form onSubmit={vincular} noValidate className="mt-4 flex flex-col gap-3 border-t border-linha-fraca pt-4">
          <div className="flex items-start gap-3">
            <label className="min-w-0 flex-1 text-xs font-semibold text-aco">
              Item de estoque
              <select {...register('itemEstoqueId')} aria-invalid={!!errors.itemEstoqueId} className={campo}>
                <option value="" disabled>Selecione…</option>
                {disponiveis.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </label>
            <label className="w-[110px] text-xs font-semibold text-aco">
              Qtd. por pedido
              <input {...register('quantidade')} inputMode="numeric" aria-invalid={!!errors.quantidade} className={campo} />
            </label>
          </div>
          {errors.itemEstoqueId && <p role="alert" className="-mt-2 text-xs text-erro">{errors.itemEstoqueId.message}</p>}
          {errors.quantidade && <p role="alert" className="-mt-2 text-xs text-erro">{errors.quantidade.message}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={criar.isPending} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
              {criar.isPending ? 'Vinculando…' : 'Vincular item'}
            </button>
          </div>
        </form>
      )}

      {erroApi && <p role="alert" className="mt-3 rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{erroApi}</p>}
    </>
  );
}

/**
 * Itens de estoque que o serviço consome (`/estoque/vinculos`, GERENTE/ADMIN). É o que alimenta a baixa automática:
 * quando um pedido do serviço entra em "Em processamento", o backend retira essas quantidades do estoque — e recusa
 * a mudança de status se faltar. Sem vínculo, o serviço não mexe no estoque.
 */
export function VinculosModal({ servico, onFechar }: { servico: Servico | null; onFechar: () => void }) {
  const devolverFoco = useDevolverFoco(servico !== null);
  return (
    <Dialog.Root open={servico !== null} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content onCloseAutoFocus={devolverFoco} className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[520px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto rounded-lg bg-white p-5 shadow-placa">
          <Dialog.Title className="font-display text-[18px] font-bold">Baixa de estoque de {servico?.nome}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-aco">
            Itens retirados do estoque automaticamente quando um pedido deste serviço entra em processamento.
          </Dialog.Description>
          {servico && <Conteudo servico={servico} />}
          <div className="mt-4 flex justify-end">
            <Dialog.Close className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Fechar</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
