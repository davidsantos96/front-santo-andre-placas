import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { z } from 'zod';
import type { ApiError, Usuario } from '@/api/types';
import { useToast } from '@/components/Toast';
import { useRedefinirSenha } from './api';

const schema = z.object({ novaSenha: z.string().min(6, 'A senha provisória deve ter ao menos 6 caracteres') });
type Dados = z.infer<typeof schema>;

/** O ADMIN define uma nova senha provisória e a repassa ao usuário por fora do sistema. */
export function RedefinirSenhaModal({ usuario, onFechar }: { usuario: Usuario | null; onFechar: () => void }) {
  const toast = useToast();
  const redefinir = useRedefinirSenha(usuario?.id ?? 0);
  const [mostrar, setMostrar] = useState(false);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(schema),
    defaultValues: { novaSenha: '' },
  });

  const enviar = handleSubmit(async ({ novaSenha }) => {
    try {
      await redefinir.mutateAsync(novaSenha);
      toast(`Senha de ${usuario?.nome} redefinida`);
      onFechar();
    } catch (e) {
      setError('root', { message: (e as ApiError).mensagem });
    }
  });

  return (
    <Dialog.Root open={usuario !== null} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-placa">
          <Dialog.Title className="font-display text-[18px] font-bold">Redefinir senha</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-aco">
            Nova senha provisória para <span className="font-semibold text-grafite">{usuario?.nome}</span>. Informe-a ao usuário por fora do sistema.
          </Dialog.Description>
          <form onSubmit={enviar} noValidate className="mt-4 flex flex-col gap-3">
            <div>
              <label htmlFor="nova-senha" className="text-xs font-semibold text-aco">Nova senha provisória</label>
              <div className="mt-1 flex gap-2">
                <input
                  id="nova-senha" {...register('novaSenha')} type={mostrar ? 'text' : 'password'} autoComplete="new-password" autoFocus
                  aria-invalid={!!errors.novaSenha} className="block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base"
                />
                <button type="button" onClick={() => setMostrar((m) => !m)} aria-pressed={mostrar}
                  className="h-9 shrink-0 rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">
                  {mostrar ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            {errors.novaSenha && <p role="alert" className="-mt-2 text-xs text-erro">{errors.novaSenha.message}</p>}
            {errors.root && <p role="alert" className="rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{errors.root.message}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={onFechar} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Cancelar</button>
              <button type="submit" disabled={redefinir.isPending} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
                {redefinir.isPending ? 'Salvando…' : 'Redefinir senha'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
