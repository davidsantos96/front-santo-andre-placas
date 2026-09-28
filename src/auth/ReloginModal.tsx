import { useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useSessao } from './SessionProvider';

/** Modal de re-login sobre a tela atual (sem desmontá-la). Login completo, não refresh. */
export function ReloginModal() {
  const { sessaoExpirada, usuario, login, logout } = useSessao();
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login({ email, senha });
      setSenha('');
    } catch {
      setErro('E-mail ou senha incorretos');
    } finally {
      setEnviando(false);
    }
  };

  const campo = 'h-9 w-full rounded border border-linha-forte bg-white px-2 text-base';

  return (
    <Dialog.Root open={sessaoExpirada}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[60] w-[360px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-placa"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <Dialog.Title className="font-display text-[18px] font-bold">Sessão expirada</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-aco">
            Entre novamente para continuar de onde parou.
          </Dialog.Description>
          <form onSubmit={enviar} className="mt-4 flex flex-col gap-3">
            <label className="text-xs font-semibold text-aco">
              E-mail
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={`${campo} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-aco">
              Senha
              <input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={`${campo} mt-1`} />
            </label>
            {erro && <p role="alert" className="text-sm text-erro">{erro}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={logout} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">
                Sair
              </button>
              <button type="submit" disabled={enviando} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
