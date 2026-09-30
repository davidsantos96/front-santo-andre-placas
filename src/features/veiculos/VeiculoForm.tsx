import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ApiError, Veiculo } from '@/api/types';
import { aplicarErrosDeCampos } from '@/lib/erros';
import { normalizarPlaca, placaValida } from '@/lib/placa';
import { useCriarVeiculo } from './api';

const ano = new Date().getFullYear() + 1;
const anoSchema = (msg: string) =>
  z.string().regex(/^\d{4}$/, msg).refine((v) => Number(v) >= 1950 && Number(v) <= ano, msg);

const schema = z.object({
  placa: z.string().refine(placaValida, 'Placa inválida'),
  marcaModelo: z.string().trim().min(2, 'Informe marca e modelo'),
  anoFabricacao: anoSchema('Ano inválido'),
  anoModelo: anoSchema('Ano inválido'),
  chassi: z.string().trim().min(1, 'Informe o chassi'),
});
type Dados = z.infer<typeof schema>;

const campo = 'mt-1 block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base';

/** Cadastro manual de veículo (a consulta automática depende de provedor externo — ver PENDENCIAS.md). Todos os campos são obrigatórios no backend. */
export function VeiculoForm({ clienteId, onSalvo, onCancelar }: { clienteId: number; onSalvo: (v: Veiculo) => void; onCancelar: () => void }) {
  const criar = useCriarVeiculo();
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(schema),
    defaultValues: { placa: '', marcaModelo: '', anoFabricacao: '', anoModelo: '', chassi: '' },
  });

  const enviar = handleSubmit(async (d) => {
    try {
      onSalvo(await criar.mutateAsync({
        clienteId, placa: normalizarPlaca(d.placa), marcaModelo: d.marcaModelo,
        anoFabricacao: Number(d.anoFabricacao), anoModelo: Number(d.anoModelo), chassi: d.chassi.trim(),
      }));
    } catch (e) {
      const erro = e as ApiError;
      if (!aplicarErrosDeCampos(erro, setError)) setError('root', { message: erro.mensagem });
    }
  });

  // Enter aqui envia só este mini-formulário (não o pedido inteiro).
  return (
    <form
      onSubmit={(e) => { e.stopPropagation(); void enviar(e); }}
      noValidate
      aria-label="Novo veículo"
      className="rounded-md border border-linha-forte bg-fundo p-3"
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 max-[599px]:grid-cols-1">
        <Controller name="placa" control={control} render={({ field }) => (
          <label className="text-xs font-semibold text-aco">
            Placa
            <input
              {...field} maxLength={8} autoFocus aria-invalid={!!errors.placa}
              onChange={(e) => field.onChange(normalizarPlaca(e.target.value))}
              className={`${campo} font-display text-[18px] font-bold tracking-[1px]`}
            />
            {errors.placa && <span role="alert" className="text-xs font-normal text-erro">{errors.placa.message}</span>}
          </label>
        )} />
        <label className="text-xs font-semibold text-aco">
          Marca / modelo
          <input {...register('marcaModelo')} aria-invalid={!!errors.marcaModelo} className={campo} />
          {errors.marcaModelo && <span role="alert" className="text-xs font-normal text-erro">{errors.marcaModelo.message}</span>}
        </label>
        <label className="text-xs font-semibold text-aco">
          Ano de fabricação
          <input {...register('anoFabricacao')} inputMode="numeric" aria-invalid={!!errors.anoFabricacao} className={campo} />
          {errors.anoFabricacao && <span role="alert" className="text-xs font-normal text-erro">{errors.anoFabricacao.message}</span>}
        </label>
        <label className="text-xs font-semibold text-aco">
          Ano do modelo
          <input {...register('anoModelo')} inputMode="numeric" aria-invalid={!!errors.anoModelo} className={campo} />
          {errors.anoModelo && <span role="alert" className="text-xs font-normal text-erro">{errors.anoModelo.message}</span>}
        </label>
        <label className="col-span-2 text-xs font-semibold text-aco max-[599px]:col-span-1">
          Chassi
          <input {...register('chassi')} aria-invalid={!!errors.chassi} className={campo} />
          {errors.chassi && <span role="alert" className="text-xs font-normal text-erro">{errors.chassi.message}</span>}
        </label>
      </div>
      {errors.root && <p role="alert" className="mt-2 rounded bg-erro-bg px-2.5 py-2 text-sm text-erro">{errors.root.message}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Cancelar</button>
        <button type="submit" disabled={criar.isPending} className="h-8 rounded bg-mercosul px-3.5 text-sm font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60">
          {criar.isPending ? 'Salvando…' : 'Salvar veículo'}
        </button>
      </div>
    </form>
  );
}
