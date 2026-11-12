import { useDevolverFoco } from '@/lib/useDevolverFoco';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { z } from 'zod';
import type { ApiError, Usuario } from '@/api/types';
import { useSessao } from '@/auth/SessionProvider';
import { useToast } from '@/components/Toast';
import { aplicarErrosDeCampos } from '@/lib/erros';
import { PAPEIS, useAtualizarUsuario, useCriarUsuario } from './api';

const base = {
  nome: z.string().trim().min(2, 'Informe o nome'),
  login: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,39}$/, 'De 3 a 40 caracteres: letras, números, ponto, hífen ou underscore (sem espaços)'),
  email: z.string().trim().refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v), 'E-mail inválido'),
  papel: z.enum(['ATENDENTE', 'GERENTE', 'ADMIN'], { errorMap: () => ({ message: 'Escolha o papel' }) }),
};
// ADMIN precisa de e-mail (recuperação de acesso); para os demais é opcional.
const exigeEmailDeAdmin = (d: { papel?: string; email: string }, ctx: z.RefinementCtx) => {
  if (d.papel === 'ADMIN' && d.email === '') ctx.addIssue({ code: 'custom', path: ['email'], message: 'Administradores precisam de um e-mail' });
};
const schemaCriar = z.object({ ...base, senha: z.string().min(6, 'A senha provisória deve ter ao menos 6 caracteres') }).superRefine(exigeEmailDeAdmin);
const schemaEditar = z.object({ ...base, senha: z.string().optional() }).superRefine(exigeEmailDeAdmin);
type Dados = z.infer<typeof schemaCriar>;

const campo = 'mt-1 block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base';

/** Criar/editar usuário. A senha provisória só existe na criação (o PUT não altera senha). */
export function UsuarioModal({ usuario, onFechar }: { usuario: Usuario | 'novo' | null; onFechar: () => void }) {
  const editando = usuario && usuario !== 'novo' ? usuario : null;
  const toast = useToast();
  const criar = useCriarUsuario();
  const atualizar = useAtualizarUsuario(editando?.id ?? 0);
  const [mostrar, setMostrar] = useState(false);
  const { usuario: eu } = useSessao();
  // O ADMIN não altera o próprio papel (evita perder o acesso sem querer e sessão com papel desatualizado).
  const proprio = !!editando && editando.login === eu?.login;
  const proprioPapel = proprio;
  const mutando = editando ? atualizar.isPending : criar.isPending;

  const { register, handleSubmit, setError, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(editando ? schemaEditar : schemaCriar) as never,
    defaultValues: editando
      ? { login: editando.login, nome: editando.nome, email: editando.email ?? '', papel: editando.papel, senha: '' }
      : { login: '', nome: '', email: '', papel: undefined, senha: '' },
  });

  const enviar = handleSubmit(async (d) => {
    try {
      if (editando) await atualizar.mutateAsync({ login: d.login, nome: d.nome, email: d.email, papel: d.papel });
      else await criar.mutateAsync({ login: d.login, nome: d.nome, email: d.email, papel: d.papel, senha: d.senha });
      toast(editando ? 'Usuário atualizado' : `Usuário ${d.nome} criado`);
      onFechar();
    } catch (e) {
      const erro = e as ApiError;
      if (!aplicarErrosDeCampos(erro, setError)) setError('root', { message: erro.mensagem });
    }
  });

  const devolverFoco = useDevolverFoco(usuario !== null);
  return (
    <Dialog.Root open={usuario !== null} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content onCloseAutoFocus={devolverFoco} className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-placa">
          <Dialog.Title className="font-display text-[18px] font-bold">{editando ? 'Editar usuário' : 'Novo usuário'}</Dialog.Title>
          <Dialog.Description className="sr-only">Login, nome, e-mail, papel e senha provisória do usuário.</Dialog.Description>
          <form onSubmit={enviar} noValidate className="mt-4 flex flex-col gap-3">
            <label className="text-xs font-semibold text-aco">
              Nome
              <input {...register('nome')} autoFocus aria-invalid={!!errors.nome} className={campo} />
            </label>
            {errors.nome && <p role="alert" className="-mt-2 text-xs text-erro">{errors.nome.message}</p>}

            <label className="text-xs font-semibold text-aco">
              Login
              {/* Trocar o próprio login derrubaria a sessão (a API recusa), então o campo já vem travado. */}
              <input
                {...register('login')} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="ex.: bruna.silva"
                readOnly={proprio} aria-invalid={!!errors.login} className={`${campo} ${proprio ? 'cursor-not-allowed opacity-70' : ''}`}
              />
            </label>
            {errors.login && <p role="alert" className="-mt-2 text-xs text-erro">{errors.login.message}</p>}

            <label className="text-xs font-semibold text-aco">
              E-mail (opcional; obrigatório para administradores)
              <input {...register('email')} type="email" autoComplete="off" aria-invalid={!!errors.email} className={campo} />
            </label>
            {errors.email && <p role="alert" className="-mt-2 text-xs text-erro">{errors.email.message}</p>}

            <label className="text-xs font-semibold text-aco">
              Papel
              {proprioPapel ? (
                <>
                  <select disabled value={editando!.papel} onChange={() => {}} className={`${campo} cursor-not-allowed opacity-70`}>
                    {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                  </select>
                  <input type="hidden" {...register('papel')} value={editando!.papel} />
                  <span className="text-xs font-normal text-aco">Você não pode alterar o próprio papel.</span>
                </>
              ) : (
                <select {...register('papel')} aria-invalid={!!errors.papel} defaultValue={editando?.papel ?? ''} className={campo}>
                  <option value="" disabled>Selecione…</option>
                  {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
                </select>
              )}
            </label>
            {errors.papel && <p role="alert" className="-mt-2 text-xs text-erro">{errors.papel.message}</p>}

            {!editando && (
              <>
                <div>
                  <label htmlFor="senha-provisoria" className="text-xs font-semibold text-aco">Senha provisória</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="senha-provisoria" {...register('senha')} type={mostrar ? 'text' : 'password'} autoComplete="new-password"
                      aria-invalid={!!errors.senha} className="block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base"
                    />
                    <button type="button" onClick={() => setMostrar((m) => !m)} aria-pressed={mostrar}
                      className="h-9 shrink-0 rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">
                      {mostrar ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>
                {errors.senha && <p role="alert" className="-mt-2 text-xs text-erro">{errors.senha.message}</p>}
              </>
            )}

            {errors.root && <p role="alert" className="rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{errors.root.message}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={onFechar} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Cancelar</button>
              <button type="submit" disabled={mutando} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
                {mutando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
