import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { z } from 'zod';
import type { ApiError, ItemEstoque } from '@/api/types';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useToast } from '@/components/Toast';
import { useMovimentar } from './api';

type Dados = { tipo: 'ENTRADA' | 'SAIDA'; quantidade: string };

const campo = 'mt-1 block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base';

/** Entrada/Saída (segmented), quantidade inteira > 0 (na saída, ≤ saldo) e observação. */
export function MovimentarModal({ item, onFechar }: { item: ItemEstoque | null; onFechar: () => void }) {
  const toast = useToast();
  const mov = useMovimentar();
  const [erroApi, setErroApi] = useState<string | null>(null);

  const schema = useMemo(
    () => z.object({
      tipo: z.enum(['ENTRADA', 'SAIDA']),
      quantidade: z.string().regex(/^\d+$/, 'Informe um número inteiro').refine((v) => Number(v) > 0, 'A quantidade deve ser maior que zero'),
    }).superRefine((d, ctx) => {
      if (item && d.tipo === 'SAIDA' && /^\d+$/.test(d.quantidade) && Number(d.quantidade) > item.quantidade) {
        ctx.addIssue({ code: 'custom', path: ['quantidade'], message: `Saldo insuficiente (disponível: ${item.quantidade})` });
      }
    }),
    [item],
  );

  const { register, control, handleSubmit, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'ENTRADA', quantidade: '' },
  });

  const enviar = handleSubmit(async (d) => {
    if (!item) return;
    setErroApi(null);
    try {
      await mov.mutateAsync({ itemEstoqueId: item.id, tipo: d.tipo, quantidade: Number(d.quantidade) });
      toast(`${d.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} de ${d.quantidade} — ${item.nome}`);
      onFechar();
    } catch (e) {
      setErroApi((e as ApiError).mensagem);
    }
  });

  return (
    <Dialog.Root open={item !== null} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-placa">
          <Dialog.Title className="font-display text-[18px] font-bold">Movimentar estoque</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-aco">
            {item?.nome} · saldo atual <span className="font-semibold tabular-nums">{item?.quantidade}</span>{item?.unidade ? ` ${item.unidade}` : ''}
          </Dialog.Description>
          <form onSubmit={enviar} noValidate className="mt-4 flex flex-col gap-3">
            <Controller name="tipo" control={control} render={({ field }) => (
              <SegmentedControl ariaLabel="Tipo de movimentação" valor={field.value} onChange={field.onChange}
                opcoes={[{ valor: 'ENTRADA', label: 'Entrada' }, { valor: 'SAIDA', label: 'Saída' }]} />
            )} />
            <label className="text-xs font-semibold text-aco">
              Quantidade
              <input {...register('quantidade')} inputMode="numeric" autoFocus aria-invalid={!!errors.quantidade} className={campo} />
            </label>
            {errors.quantidade && <p role="alert" className="-mt-2 text-xs text-erro">{errors.quantidade.message}</p>}
            {erroApi && <p role="alert" className="rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{erroApi}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={onFechar} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Cancelar</button>
              <button type="submit" disabled={mov.isPending} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
                {mov.isPending ? 'Registrando…' : 'Registrar'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
