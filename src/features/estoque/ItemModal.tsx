import { useDevolverFoco } from '@/lib/useDevolverFoco';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { z } from 'zod';
import type { ApiError } from '@/api/types';
import { useToast } from '@/components/Toast';
import { useCriarItem } from './api';

const inteiro = (msg: string) => z.string().regex(/^\d+$/, msg);
const schema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do item'),
  sku: z.string().trim(),
  unidade: z.string().trim(),
  quantidade: inteiro('Informe um número inteiro (0 ou mais)'),
  quantidadeMinima: inteiro('Informe um número inteiro (0 ou mais)'),
});
type Dados = z.infer<typeof schema>;

const campo = 'mt-1 block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base';

/** Cadastro de item de estoque (GERENTE/ADMIN). O vínculo serviço↔item fica fora por enquanto. */
export function ItemModal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const toast = useToast();
  const criar = useCriarItem();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', sku: '', unidade: '', quantidade: '0', quantidadeMinima: '0' },
  });

  const enviar = handleSubmit(async (d) => {
    try {
      await criar.mutateAsync({
        nome: d.nome, quantidade: Number(d.quantidade), quantidadeMinima: Number(d.quantidadeMinima),
        ...(d.sku ? { sku: d.sku } : {}), ...(d.unidade ? { unidade: d.unidade } : {}),
      });
      toast(`Item "${d.nome}" cadastrado`);
      onFechar();
    } catch (e) {
      setError('root', { message: (e as ApiError).mensagem });
    }
  });

  const devolverFoco = useDevolverFoco(aberto);
  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content onCloseAutoFocus={devolverFoco} className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-placa">
          <Dialog.Title className="font-display text-[18px] font-bold">Novo item de estoque</Dialog.Title>
          <Dialog.Description className="sr-only">Nome, SKU, unidade, quantidade inicial e quantidade mínima.</Dialog.Description>
          <form onSubmit={enviar} noValidate className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
            <label className="col-span-2 text-xs font-semibold text-aco">
              Nome
              <input {...register('nome')} autoFocus aria-invalid={!!errors.nome} className={campo} />
              {errors.nome && <span role="alert" className="text-xs font-normal text-erro">{errors.nome.message}</span>}
            </label>
            <label className="text-xs font-semibold text-aco">
              SKU <span className="font-normal">(opcional)</span>
              <input {...register('sku')} className={`${campo} font-mono`} />
            </label>
            <label className="text-xs font-semibold text-aco">
              Unidade <span className="font-normal">(opcional)</span>
              <input {...register('unidade')} placeholder="un, par, kit…" className={campo} />
            </label>
            <label className="text-xs font-semibold text-aco">
              Quantidade inicial
              <input {...register('quantidade')} inputMode="numeric" aria-invalid={!!errors.quantidade} className={campo} />
              {errors.quantidade && <span role="alert" className="text-xs font-normal text-erro">{errors.quantidade.message}</span>}
            </label>
            <label className="text-xs font-semibold text-aco">
              Quantidade mínima
              <input {...register('quantidadeMinima')} inputMode="numeric" aria-invalid={!!errors.quantidadeMinima} className={campo} />
              {errors.quantidadeMinima && <span role="alert" className="text-xs font-normal text-erro">{errors.quantidadeMinima.message}</span>}
            </label>
            {errors.root && <p role="alert" className="col-span-2 rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{errors.root.message}</p>}
            <div className="col-span-2 mt-1 flex justify-end gap-2">
              <button type="button" onClick={onFechar} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Cancelar</button>
              <button type="submit" disabled={criar.isPending} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
                {criar.isPending ? 'Salvando…' : 'Salvar item'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
