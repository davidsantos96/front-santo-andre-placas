import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '@/api/client';
import type { ApiError, Cliente, Servico, Veiculo } from '@/api/types';
import { Cartao } from '@/components/Cartao';
import { Combobox } from '@/components/Combobox';
import { Money } from '@/components/Money';
import { Pagina } from '@/components/Pagina';
import { PlacaBadge } from '@/components/PlacaBadge';
import { FORMA_PAGAMENTO, ORIGEM, type FormaPagamento } from '@/components/status';
import { useToast } from '@/components/Toast';
import { useClientes } from '@/features/clientes/api';
import { ClientePainel } from '@/features/clientes/ClientePainel';
import { useServicos } from '@/features/servicos/api';
import { useConsultarVeiculo, useVeiculos } from '@/features/veiculos/api';
import { VeiculoForm } from '@/features/veiculos/VeiculoForm';
import { useDebounce } from '@/lib/useDebounce';
import { useCriarPedido } from './api';

const schema = z.object({
  clienteId: z.number({ required_error: 'Selecione um cliente' }),
  veiculoId: z.number({ required_error: 'Selecione um veículo' }),
  servicoId: z.number({ required_error: 'Selecione um serviço' }),
  origem: z.enum(['BALCAO', 'WHATSAPP', 'TELEFONE']).default('BALCAO'),
  formaPagamento: z.enum(['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'BOLETO']).optional(),
});
type Dados = z.infer<typeof schema>;

function Bloco({ n, titulo, habilitado, erro, children }: { n: number; titulo: string; habilitado: boolean; erro?: string; children: React.ReactNode }) {
  return (
    <Cartao className={clsx(!habilitado && 'opacity-60')}>
      <fieldset disabled={!habilitado} className="min-w-0 border-0 p-0">
        <legend className="mb-3 flex items-center gap-2.5 p-0">
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-mercosul font-display text-[13px] font-bold text-white">{n}</span>
          <span className="font-display text-[16px] font-bold">{titulo}</span>
        </legend>
        {children}
        {erro && <p role="alert" className="mt-2 text-sm text-erro">{erro}</p>}
      </fieldset>
    </Cartao>
  );
}

const selectCls = 'mt-1 block h-9 rounded border border-linha-forte bg-white px-2 text-base';

export function NovoPedidoPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const criar = useCriarPedido();
  const consultar = useConsultarVeiculo();

  const { handleSubmit, setValue, resetField, register, formState: { errors } } = useForm<Dados>({
    resolver: zodResolver(schema),
    defaultValues: { origem: 'BALCAO' },
  });

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [servico, setServico] = useState<Servico | null>(null);
  const [busca, setBusca] = useState('');
  const [painel, setPainel] = useState(false);
  const [novoVeiculo, setNovoVeiculo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const termo = useDebounce(busca.trim(), 200);
  const clientesQ = useClientes(termo, !cliente && termo.length >= 2);
  const veiculosQ = useVeiculos({ clienteId: cliente?.id }, !!cliente);
  const servicosQ = useServicos();

  const escolherCliente = (c: Cliente) => {
    setCliente(c); setBusca('');
    setValue('clienteId', c.id, { shouldValidate: true });
    setVeiculo(null); resetField('veiculoId');
  };
  const trocarCliente = () => {
    setCliente(null); resetField('clienteId');
    setVeiculo(null); resetField('veiculoId');
    setNovoVeiculo(false);
  };
  const escolherVeiculo = (v: Veiculo) => { setVeiculo(v); setValue('veiculoId', v.id, { shouldValidate: true }); setNovoVeiculo(false); };
  const escolherServico = (s: Servico) => { setServico(s); setValue('servicoId', s.id, { shouldValidate: true }); };

  const enviar = handleSubmit(async (d) => {
    if (enviando) return;
    setEnviando(true);
    try {
      let pedido;
      try {
        pedido = await criar.mutateAsync({ clienteId: d.clienteId, veiculoId: d.veiculoId, servicoId: d.servicoId, origem: d.origem });
      } catch (e) {
        toast(`Não foi possível criar o pedido: ${(e as ApiError).mensagem}`, 'erro'); // formulário permanece preenchido
        return;
      }
      if (d.formaPagamento && servico) {
        try {
          await api.post(`/pedidos/${pedido.id}/pagamento`, { valorCentavos: servico.precoCentavos, formaPagamento: d.formaPagamento });
          for (const k of ['pagamentos', 'caixa', 'dash']) void qc.invalidateQueries({ queryKey: [k] });
        } catch (e) {
          toast(`Pedido #${pedido.id} criado, mas o pagamento falhou: ${(e as ApiError).mensagem}`, 'erro');
          navigate(`/pedidos/${pedido.id}`);
          return;
        }
      }
      toast(`Pedido #${pedido.id} criado`);
      navigate('/pedidos');
    } finally {
      setEnviando(false);
    }
  });

  // Ctrl+Enter cria o pedido (ignora se houver um diálogo aberto, ex.: painel de cliente).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !document.querySelector('[role="dialog"]')) {
        e.preventDefault();
        void enviar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Pagina titulo="Novo pedido">
      <div
        role="form"
        aria-label="Novo pedido"
        className="flex max-w-[760px] flex-col gap-3.5 pb-24"
        onKeyDown={(e) => {
          // Enter num campo não envia o pedido por engano (só o botão / Ctrl+Enter).
          const alvo = e.target as HTMLElement;
          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && alvo.tagName === 'INPUT' && e.currentTarget.contains(alvo) && alvo.closest('form') === null) e.preventDefault();
        }}
      >
        <Bloco n={1} titulo="Cliente" habilitado erro={errors.clienteId?.message}>
          {cliente ? (
            <div className="flex items-center justify-between gap-3 rounded-md bg-mercosul-claro px-3 py-2">
              <div>
                <div className="text-base font-semibold">{cliente.nome}</div>
                <div className="text-xs text-aco">{cliente.cpfCnpj} · {cliente.telefone}</div>
              </div>
              <button type="button" onClick={trocarCliente} className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo">Trocar</button>
            </div>
          ) : (
            <Combobox<Cliente>
              rotulo="Buscar cliente"
              placeholder="Nome, telefone ou CPF/CNPJ (mín. 2 caracteres)"
              texto={busca}
              onTexto={setBusca}
              opcoes={termo.length >= 2 ? clientesQ.data ?? [] : []}
              chave={(c) => c.id}
              carregando={termo.length >= 2 && clientesQ.isFetching}
              vazio={termo.length >= 2 ? 'Nenhum cliente encontrado' : 'Digite ao menos 2 caracteres'}
              renderOpcao={(c) => (
                <span className="flex flex-col"><span className="font-medium">{c.nome}</span><span className="text-xs text-aco">{c.cpfCnpj} · {c.telefone}</span></span>
              )}
              onSelecionar={escolherCliente}
              acaoFinal={{ label: '+ Cadastrar novo cliente', onSelecionar: () => setPainel(true) }}
              autoFocus
            />
          )}
        </Bloco>

        <Bloco n={2} titulo="Veículo" habilitado={!!cliente} erro={errors.veiculoId?.message}>
          {veiculosQ.isPending && !!cliente ? (
            <p className="text-sm text-aco">Carregando veículos…</p>
          ) : (
            <>
              {(veiculosQ.data?.length ?? 0) === 0 && !novoVeiculo && cliente && (
                <p className="mb-2 text-sm text-aco">Este cliente ainda não tem veículos.</p>
              )}
              <div role="radiogroup" aria-label="Veículo do cliente" className="flex flex-wrap gap-3">
                {(veiculosQ.data ?? []).map((v) => {
                  const sel = veiculo?.id === v.id;
                  return (
                    <div key={v.id} className={clsx('flex flex-col rounded-md border-2 bg-white p-2.5', sel ? 'border-mercosul bg-mercosul-claro' : 'border-linha')}>
                      <button
                        type="button" role="radio" aria-checked={sel}
                        aria-label={`${v.placa}, ${v.marcaModelo}, ${v.anoFabricacao}/${v.anoModelo}`}
                        onClick={() => escolherVeiculo(v)}
                        className="flex flex-col items-start gap-1.5 text-left"
                      >
                        <PlacaBadge placa={v.placa} tam="md" />
                        <span className="text-base font-semibold">{v.marcaModelo}</span>
                        <span className="text-xs text-aco">{v.anoFabricacao}/{v.anoModelo}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => consultar.mutate(v.id, { onError: (e) => toast(e.mensagem) })}
                        disabled={consultar.isPending}
                        className="mt-2 self-start text-xs font-semibold text-mercosul hover:underline"
                      >
                        Consultar placa
                      </button>
                    </div>
                  );
                })}
              </div>
              {novoVeiculo && cliente ? (
                <div className="mt-3"><VeiculoForm clienteId={cliente.id} onSalvo={escolherVeiculo} onCancelar={() => setNovoVeiculo(false)} /></div>
              ) : (
                <button type="button" onClick={() => setNovoVeiculo(true)} className="mt-3 h-[30px] rounded border border-mercosul bg-white px-3 text-sm font-semibold text-mercosul hover:bg-mercosul-claro">
                  + Novo veículo
                </button>
              )}
            </>
          )}
        </Bloco>

        <Bloco n={3} titulo="Serviço e pagamento" habilitado={!!veiculo} erro={errors.servicoId?.message}>
          <div role="radiogroup" aria-label="Serviço" className="flex flex-col gap-2">
            {(servicosQ.data ?? []).map((s) => {
              const sel = servico?.id === s.id;
              return (
                <button
                  key={s.id} type="button" role="radio" aria-checked={sel} onClick={() => escolherServico(s)}
                  className={clsx('flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-base',
                    sel ? 'border-mercosul bg-mercosul-claro font-semibold' : 'border-linha bg-white hover:bg-fundo')}
                >
                  <span>{s.nome}</span>
                  <Money centavos={s.precoCentavos} />
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="text-xs font-semibold text-aco">
              Origem
              <select {...register('origem')} className={selectCls}>
                {Object.entries(ORIGEM).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-aco">
              Forma de pagamento
              <select
                className={selectCls}
                defaultValue=""
                onChange={(e) => setValue('formaPagamento', (e.target.value || undefined) as FormaPagamento | undefined)}
              >
                <option value="">Depois</option>
                {(Object.keys(FORMA_PAGAMENTO) as FormaPagamento[]).map((f) => <option key={f} value={f}>{FORMA_PAGAMENTO[f].label}</option>)}
              </select>
            </label>
          </div>
        </Bloco>
      </div>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-4 border-t border-linha bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3 text-base">
          {veiculo ? <PlacaBadge placa={veiculo.placa} /> : <span className="text-aco">Placa</span>}
          <span className="truncate text-aco">{servico?.nome ?? 'Serviço'}</span>
          {servico && <Money centavos={servico.precoCentavos} className="font-display text-[19px] font-bold" />}
        </div>
        <button
          type="button" onClick={() => void enviar()} disabled={enviando}
          className="h-10 shrink-0 rounded bg-mercosul px-5 text-base font-semibold text-white hover:bg-mercosul-hover disabled:opacity-60"
        >
          {enviando ? 'Criando…' : 'Criar pedido'} <kbd aria-hidden="true" className="ml-1 rounded-sm bg-white/20 px-1.5 text-2xs">Ctrl+↵</kbd>
        </button>
      </div>

      <ClientePainel aberto={painel} onFechar={() => setPainel(false)} onSalvo={(c) => { setPainel(false); escolherCliente(c); }} />
    </Pagina>
  );
}
