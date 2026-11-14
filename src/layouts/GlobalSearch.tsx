import { forwardRef, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlacaBadge } from '@/components/PlacaBadge';
import { STATUS } from '@/components/status';
import { MIN_CARACTERES, useBuscaGlobal } from '@/features/busca/api';
import { useDebounce } from '@/lib/useDebounce';
import { modeloDoVeiculo } from '@/lib/veiculo';

type Opcao = { chave: string; grupo: 'Pedidos' | 'Veículos' | 'Clientes'; rota: string; rotulo: string; conteudo: ReactNode };
const GRUPOS = ['Pedidos', 'Veículos', 'Clientes'] as const;

/**
 * Busca global (spec §5.13) como combobox ARIA: setas navegam, Enter abre, Esc limpa e tira o foco.
 * Resultados agrupados em Pedidos · Veículos · Clientes; o primeiro resultado já vem ativo.
 */
export const GlobalSearch = forwardRef<HTMLInputElement>(function GlobalSearch(_, ref) {
  const id = useId();
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  // Celular: a busca fica recolhida numa lupa e abre em tela cheia.
  const [telaCheia, setTelaCheia] = useState(false);
  const campo = useRef<HTMLInputElement | null>(null);
  const termo = useDebounce(texto, 200);
  const { veiculos, clientes, pedidos, ativa } = useBuscaGlobal(termo);
  const digitando = texto.trim().replace(/^#/, '').length >= MIN_CARACTERES;

  const opcoes = useMemo<Opcao[]>(() => [
    ...(pedidos.data ?? []).map((p): Opcao => ({
      chave: `p${p.id}`, grupo: 'Pedidos', rota: `/pedidos/${p.id}`,
      rotulo: `Pedido ${p.id}, ${p.veiculo.placa}, ${p.cliente.nome}, ${STATUS[p.status].label}`,
      conteudo: (
        <>
          <PlacaBadge placa={p.veiculo.placa} />
          <span className="min-w-0 flex-1 truncate"><span className="font-mono text-xs text-aco">#{p.id}</span> {p.cliente.nome}</span>
          <span className="shrink-0 text-xs text-aco">{STATUS[p.status].label}</span>
        </>
      ),
    })),
    ...(veiculos.data ?? []).map((v): Opcao => ({
      chave: `v${v.id}`, grupo: 'Veículos', rota: `/veiculos/${v.id}`,
      rotulo: `Veículo ${v.placa}, ${modeloDoVeiculo(v)}, ${v.clienteNome}`,
      conteudo: (
        <>
          <PlacaBadge placa={v.placa} />
          <span className="min-w-0 flex-1 truncate">{modeloDoVeiculo(v)}</span>
          <span className="max-w-[40%] shrink-0 truncate text-xs text-aco">{v.clienteNome}</span>
        </>
      ),
    })),
    ...(clientes.data ?? []).map((c): Opcao => ({
      chave: `c${c.id}`, grupo: 'Clientes', rota: `/clientes/${c.id}`,
      rotulo: `Cliente ${c.nome}, ${c.telefone}`,
      conteudo: (
        <>
          <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
          <span className="shrink-0 text-xs tabular-nums text-aco">{c.telefone}</span>
        </>
      ),
    })),
  ], [pedidos.data, veiculos.data, clientes.data]);

  const consultas = [pedidos, veiculos, clientes];
  const carregando = digitando && (texto !== termo || (ativa && consultas.some((q) => q.isFetching && q.data === undefined)));
  const falhas = GRUPOS.filter((g) => ({ Pedidos: pedidos, Veículos: veiculos, Clientes: clientes })[g].isError);
  const idOpcao = (i: number) => `${id}-opt-${i}`;
  const mostrar = aberto && digitando;
  const ativoValido = Math.min(ativo, Math.max(0, opcoes.length - 1));

  const fechar = () => { setAberto(false); };
  const limpar = () => { setTexto(''); setAtivo(0); setAberto(false); setTelaCheia(false); };
  const abrirTelaCheia = () => {
    // flushSync: o campo precisa estar visível antes do focus(), ainda dentro do toque, senão o iOS não abre o teclado.
    flushSync(() => setTelaCheia(true));
    campo.current?.focus();
  };
  const abrir = (o: Opcao) => {
    limpar();
    (document.activeElement as HTMLElement | null)?.blur();
    navigate(o.rota);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = opcoes.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setAtivo(n ? (ativoValido + 1) % n : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAberto(true); setAtivo(n ? (ativoValido - 1 + n) % n : 0); }
    else if (e.key === 'Enter' && mostrar && n > 0 && !carregando) { e.preventDefault(); abrir(opcoes[ativoValido]!); }
    else if (e.key === 'Escape') { e.preventDefault(); limpar(); e.currentTarget.blur(); }
  };

  return (
    <>
    <button
      type="button" onClick={abrirTelaCheia} aria-label="Abrir busca"
      className="flex h-[34px] w-[34px] items-center justify-center rounded border border-linha-forte text-aco min-[900px]:hidden"
    >
      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
    <div
      className={clsx(
        'relative w-[400px] max-w-full flex-1 min-[900px]:flex-none',
        telaCheia
          ? 'max-[899px]:fixed max-[899px]:inset-0 max-[899px]:z-50 max-[899px]:flex max-[899px]:w-auto max-[899px]:flex-col max-[899px]:bg-white max-[899px]:px-3 max-[899px]:pb-[calc(0.75rem+var(--kb,0px))] max-[899px]:pt-[max(0.75rem,env(safe-area-inset-top))]'
          : 'max-[899px]:hidden',
      )}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) fechar(); }}
    >
      <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
      <Search size={16} strokeWidth={1.75} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aco" />
      <input
        ref={(el) => {
          campo.current = el;
          if (typeof ref === 'function') ref(el); else if (ref) ref.current = el;
        }}
        type="search"
        role="combobox"
        aria-label="Buscar placa, cliente ou nº do pedido"
        aria-expanded={mostrar}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={mostrar && opcoes.length > 0 && !carregando ? idOpcao(ativoValido) : undefined}
        autoComplete="off"
        placeholder="Buscar placa, cliente ou nº do pedido"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAtivo(0); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={onKey}
        className="h-[34px] w-full rounded border border-linha-forte bg-white pl-8 pr-8 text-sm"
      />
      <kbd aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-linha-badge px-1.5 text-2xs font-semibold text-aco">/</kbd>
      </div>
      {telaCheia && (
        <button type="button" onClick={limpar} className="shrink-0 px-2 text-base font-semibold text-mercosul min-[900px]:hidden">
          Cancelar
        </button>
      )}
      </div>

      {mostrar && (
        <div
          id={`${id}-lista`} role="listbox" aria-label="Resultados da busca"
          className={clsx(
            'absolute left-0 right-0 top-full z-30 mt-1 max-h-[420px] overflow-auto rounded-md border border-linha bg-white py-1 shadow-placa',
            telaCheia && 'max-[899px]:static max-[899px]:mt-2 max-[899px]:max-h-none max-[899px]:min-h-0 max-[899px]:flex-1 max-[899px]:border-0 max-[899px]:shadow-none',
          )}
        >
          {carregando && opcoes.length === 0 && <p role="presentation" className="px-3 py-2 text-sm text-aco">Buscando…</p>}
          {!carregando && opcoes.length === 0 && falhas.length === 0 && (
            <p role="presentation" className="px-3 py-2 text-sm text-aco">Nenhum resultado para “{texto.trim()}”.</p>
          )}
          {GRUPOS.map((g) => {
            const itens = opcoes.map((o, i) => ({ o, i })).filter(({ o }) => o.grupo === g);
            if (itens.length === 0) return null;
            return (
              <div key={g} role="group" aria-labelledby={`${id}-g-${g}`}>
                <div id={`${id}-g-${g}`} className="px-3 pb-0.5 pt-2 text-2xs font-semibold uppercase tracking-[0.6px] text-aco">{g}</div>
                {itens.map(({ o, i }) => (
                  <div
                    key={o.chave} id={idOpcao(i)} role="option" aria-selected={i === ativoValido} aria-label={o.rotulo}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => abrir(o)}
                    onMouseEnter={() => setAtivo(i)}
                    className={clsx('flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-base toque:py-2.5', i === ativoValido && 'bg-mercosul-claro')}
                  >
                    {o.conteudo}
                  </div>
                ))}
              </div>
            );
          })}
          {falhas.length > 0 && (
            <p role="alert" className="px-3 py-2 text-xs text-erro">Não foi possível buscar em: {falhas.join(', ')}.</p>
          )}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {mostrar && !carregando ? (opcoes.length === 0 ? 'Nenhum resultado' : `${opcoes.length} ${opcoes.length === 1 ? 'resultado' : 'resultados'}`) : ''}
      </p>
    </div>
    </>
  );
});
