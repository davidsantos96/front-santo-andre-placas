type Props = { mensagem: string; acao?: { label: string; onClick: () => void } };

export function EmptyState({ mensagem, acao }: Props) {
  return (
    <div className="flex flex-col items-center gap-2.5 p-[26px] text-center">
      <p className="text-base text-aco">{mensagem}</p>
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          className="h-[30px] rounded border border-mercosul bg-white px-3 text-sm font-semibold text-mercosul hover:bg-mercosul-claro"
        >
          {acao.label}
        </button>
      )}
    </div>
  );
}
