import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ApiError, Cliente } from '@/api/types';
import { cpfCnpjValido, mascararCpfCnpj } from '@/lib/documento';
import { aplicarErrosDeCampos } from '@/lib/erros';
import { mascararTelefone, telefoneValido } from '@/lib/telefone';
import { useCriarCliente } from './api';

const schema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  cpfCnpj: z.string().refine(cpfCnpjValido, 'CPF ou CNPJ inválido'),
  telefone: z.string().refine(telefoneValido, 'Telefone inválido'),
  email: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido'),
});
type Dados = z.infer<typeof schema>;

const campo = 'mt-1 block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base';

/** Formulário de cliente — compartilhado entre o painel do Novo pedido e a tela de Clientes. */
export function ClienteForm({ onSalvo, onCancelar }: { onSalvo: (c: Cliente) => void; onCancelar?: () => void }) {
  const criar = useCriarCliente();
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', cpfCnpj: '', telefone: '', email: '' },
  });

  const enviar = handleSubmit(async (d) => {
    try {
      onSalvo(await criar.mutateAsync(d));
    } catch (e) {
      const erro = e as ApiError;
      if (!aplicarErrosDeCampos(erro, setError)) setError('root', { message: erro.mensagem });
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <label className="text-xs font-semibold text-aco">
        Nome
        <input {...register('nome')} autoFocus aria-invalid={!!errors.nome} className={campo} />
      </label>
      {errors.nome && <p role="alert" className="-mt-2 text-xs text-erro">{errors.nome.message}</p>}

      <Controller name="cpfCnpj" control={control} render={({ field }) => (
        <label className="text-xs font-semibold text-aco">
          CPF/CNPJ
          <input
            {...field} inputMode="numeric" aria-invalid={!!errors.cpfCnpj}
            onChange={(e) => field.onChange(mascararCpfCnpj(e.target.value))} className={campo}
          />
        </label>
      )} />
      {errors.cpfCnpj && <p role="alert" className="-mt-2 text-xs text-erro">{errors.cpfCnpj.message}</p>}

      <Controller name="telefone" control={control} render={({ field }) => (
        <label className="text-xs font-semibold text-aco">
          Telefone
          <input
            {...field} type="tel" inputMode="tel" placeholder="(11) 98877-1234" aria-invalid={!!errors.telefone}
            onChange={(e) => field.onChange(mascararTelefone(e.target.value))} className={campo}
          />
        </label>
      )} />
      {errors.telefone && <p role="alert" className="-mt-2 text-xs text-erro">{errors.telefone.message}</p>}

      <label className="text-xs font-semibold text-aco">
        E-mail <span className="font-normal">(opcional)</span>
        <input {...register('email')} type="email" aria-invalid={!!errors.email} className={campo} />
      </label>
      {errors.email && <p role="alert" className="-mt-2 text-xs text-erro">{errors.email.message}</p>}

      {errors.root && <p role="alert" className="rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{errors.root.message}</p>}

      <div className="mt-1 flex justify-end gap-2">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Cancelar</button>
        )}
        <button type="submit" disabled={criar.isPending} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
          {criar.isPending ? 'Salvando…' : 'Salvar cliente'}
        </button>
      </div>
    </form>
  );
}
