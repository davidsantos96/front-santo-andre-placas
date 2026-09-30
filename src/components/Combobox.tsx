import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';

type Props<T> = {
  rotulo: string;
  texto: string;
  onTexto: (t: string) => void;
  opcoes: T[];
  chave: (o: T) => string | number;
  renderOpcao: (o: T) => ReactNode;
  onSelecionar: (o: T) => void;
  /** Item fixo no fim da lista (ex.: "+ Cadastrar novo cliente"). */
  acaoFinal?: { label: string; onSelecionar: () => void };
  carregando?: boolean;
  vazio?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** Combobox ARIA (padrão "list autocomplete"): setas navegam, Enter seleciona, Esc fecha. */
export function Combobox<T>({
  rotulo, texto, onTexto, opcoes, chave, renderOpcao, onSelecionar, acaoFinal, carregando, vazio, placeholder, disabled, autoFocus,
}: Props<T>) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const total = opcoes.length + (acaoFinal ? 1 : 0);
  const idOpcao = (i: number) => `${id}-opt-${i}`;

  const escolher = (i: number) => {
    if (i < opcoes.length) onSelecionar(opcoes[i]);
    else acaoFinal?.onSelecionar();
    setAberto(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setAtivo((a) => (total ? (a + 1) % total : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAberto(true); setAtivo((a) => (total ? (a - 1 + total) % total : 0)); }
    else if (e.key === 'Enter' && aberto && total > 0) { e.preventDefault(); e.stopPropagation(); escolher(ativo); }
    else if (e.key === 'Escape' && aberto) { e.preventDefault(); e.stopPropagation(); setAberto(false); }
  };

  return (
    <div className="relative">
      <label htmlFor={`${id}-in`} className="text-xs font-semibold text-aco">{rotulo}</label>
      <input
        id={`${id}-in`}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={aberto && total > 0 ? idOpcao(ativo) : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => { onTexto(e.target.value); setAberto(true); setAtivo(0); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={onKey}
        className="mt-1 block h-9 w-full rounded border border-linha-forte bg-white px-2.5 text-base"
      />
      {aberto && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          aria-label={rotulo}
          className="absolute z-20 mt-1 max-h-[280px] w-full overflow-auto rounded-md border border-linha bg-white py-1 shadow-placa"
        >
          {carregando && <li role="presentation" className="px-3 py-2 text-sm text-aco">Buscando…</li>}
          {!carregando && vazio && opcoes.length === 0 && <li role="presentation" className="px-3 py-2 text-sm text-aco">{vazio}</li>}
          {opcoes.map((o, i) => (
            <li
              key={chave(o)}
              id={idOpcao(i)}
              role="option"
              aria-selected={i === ativo}
              onMouseDown={(e) => { e.preventDefault(); escolher(i); }}
              onMouseEnter={() => setAtivo(i)}
              className={clsx('cursor-pointer px-3 py-2 text-base', i === ativo && 'bg-mercosul-claro')}
            >
              {renderOpcao(o)}
            </li>
          ))}
          {acaoFinal && (
            <li
              id={idOpcao(opcoes.length)}
              role="option"
              aria-selected={opcoes.length === ativo}
              onMouseDown={(e) => { e.preventDefault(); escolher(opcoes.length); }}
              onMouseEnter={() => setAtivo(opcoes.length)}
              className={clsx('cursor-pointer border-t border-linha-fraca px-3 py-2 text-base font-semibold text-mercosul', opcoes.length === ativo && 'bg-mercosul-claro')}
            >
              {acaoFinal.label}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
