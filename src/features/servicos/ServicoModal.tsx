import { useDevolverFoco } from '@/lib/useDevolverFoco';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { z } from 'zod';
import type { ApiError, Servico } from '@/api/types';
import { MoneyInput } from '@/components/MoneyInput';
import { useToast } from '@/components/Toast';
import { aplicarErrosDeCampos } from '@/lib/erros';
import { CATEGORIAS, useAtualizarServico, useCriarServico } from './api';

const schema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  categoria: z.enum(CATEGORIAS, { errorMap: () => ({ message: 'Escolha a categoria' }) }),
  precoCentavos: z.number().int().positive('Informe um preço maior que zero'),
});
type Dados = z.infer<typeof schema>;

const campo = 'mt-1 block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base';

/** Criar/editar serviço. `codigoExterno` não aparece na UI (Fase 1). */
export function ServicoModal({ servico, onFechar }: { servico: Servico | 'novo' | null; onFechar: () => void }) {
  const editando = servico && servico !== 'novo' ? servico : null;
  const toast = useToast();
  const criar = useCriarServico();
  const atualizar = useAtualizarServico(editando?.id ?? 0);
  const mutacao = editando ? atualizar : criar;

  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(schema),
    defaultValues: editando
      ? { nome: editando.nome, categoria: editando.categoria as Dados['categoria'], precoCentavos: editando.precoCentavos }
      : { nome: '', categoria: undefined, precoCentavos: 0 },
  });

  const enviar = handleSubmit(async (d) => {
    try {
      await mutacao.mutateAsync({ ...d, descricao: editando?.descricao ?? '', ativo: editando?.ativo ?? true });
      toast(editando ? 'Serviço atualizado' : 'Serviço criado');
      onFechar();
    } catch (e) {
      const erro = e as ApiError;
      if (!aplicarErrosDeCampos(erro, setError)) setError('root', { message: erro.mensagem });
    }
  });

  const devolverFoco = useDevolverFoco(servico !== null);
  return (
    <Dialog.Root open={servico !== null} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content onCloseAutoFocus={devolverFoco} className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-placa">
          <Dialog.Title className="font-display text-[18px] font-bold">{editando ? 'Editar serviço' : 'Novo serviço'}</Dialog.Title>
          <Dialog.Description className="sr-only">Nome, categoria e preço do serviço.</Dialog.Description>
          <form onSubmit={enviar} noValidate className="mt-4 flex flex-col gap-3">
            <label className="text-xs font-semibold text-aco">
              Nome
              <input {...register('nome')} autoFocus aria-invalid={!!errors.nome} className={campo} />
            </label>
            {errors.nome && <p role="alert" className="-mt-2 text-xs text-erro">{errors.nome.message}</p>}

            <label className="text-xs font-semibold text-aco">
              Categoria
              <select {...register('categoria')} aria-invalid={!!errors.categoria} className={campo} defaultValue={editando?.categoria ?? ''}>
                <option value="" disabled>Selecione…</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {errors.categoria && <p role="alert" className="-mt-2 text-xs text-erro">{errors.categoria.message}</p>}

            <div>
              <label htmlFor="preco-servico" className="text-xs font-semibold text-aco">Preço</label>
              <Controller name="precoCentavos" control={control} render={({ field }) => (
                <MoneyInput id="preco-servico" value={field.value} onChange={field.onChange} aria-invalid={!!errors.precoCentavos} className="mt-1 block !h-9 w-full text-base" />
              )} />
            </div>
            {errors.precoCentavos && <p role="alert" className="-mt-2 text-xs text-erro">{errors.precoCentavos.message}</p>}

            {errors.root && <p role="alert" className="rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{errors.root.message}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={onFechar} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Cancelar</button>
              <button type="submit" disabled={mutacao.isPending} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
                {mutacao.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
