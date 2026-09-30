import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { PlacaBadge } from '@/components/PlacaBadge';
import { telaInicial } from '@/auth/papeis';
import { useSessao } from '@/auth/SessionProvider';
import type { ApiError } from '@/api/types';

const schema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});
type Dados = z.infer<typeof schema>;

/** `?next=` só vale se for caminho interno (evita open redirect). */
const nextSeguro = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

export function LoginPage() {
  const { usuario, login } = useSessao();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [erro, setErro] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Dados>({ resolver: zodResolver(schema) });

  if (usuario) return <Navigate to={nextSeguro(sp.get('next')) ?? telaInicial(usuario.papel)} replace />;

  const enviar = handleSubmit(async (d) => {
    setErro(null);
    try {
      const u = await login(d);
      navigate(nextSeguro(sp.get('next')) ?? telaInicial(u.papel), { replace: true });
    } catch (e) {
      const status = (e as ApiError).status;
      // A API responde 400 ("Email ou senha inválidos") para credencial errada; 401/403 por garantia.
      setErro([400, 401, 403].includes(status) ? 'E-mail ou senha incorretos' : (e as ApiError).mensagem ?? 'Não foi possível entrar');
    }
  });

  const campo = 'mt-1 h-10 w-full rounded border border-linha-forte bg-white px-2.5 text-base';

  return (
    <>
      <PlacaBadge placa="SAP0001" tam="lg" className="mb-6" />
      <form onSubmit={enviar} noValidate className="w-[360px] max-w-full rounded-lg border border-linha bg-white p-6 shadow-card">
        <h1 className="mb-4 font-display text-[22px] font-bold">Entrar</h1>
        <label className="block text-xs font-semibold text-aco">
          E-mail
          <input type="email" autoComplete="username" autoFocus {...register('email')} aria-invalid={!!errors.email} className={campo} />
        </label>
        {errors.email && <p role="alert" className="mt-1 text-xs text-erro">{errors.email.message}</p>}
        <label className="mt-3 block text-xs font-semibold text-aco">
          Senha
          <input type="password" autoComplete="current-password" {...register('senha')} aria-invalid={!!errors.senha} className={campo} />
        </label>
        {errors.senha && <p role="alert" className="mt-1 text-xs text-erro">{errors.senha.message}</p>}
        {erro && <p role="alert" className="mt-3 rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{erro}</p>}
        <button type="submit" disabled={isSubmitting} className="mt-5 h-10 w-full rounded bg-mercosul text-base font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </>
  );
}
