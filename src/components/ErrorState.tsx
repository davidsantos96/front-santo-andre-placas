type Props = { mensagem?: string; onRetry: () => void };

export function ErrorState({ mensagem = 'Não foi possível carregar.', onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2.5 p-[26px] text-center">
      <p className="text-base text-erro">{mensagem}</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo"
      >
        Tentar novamente
      </button>
    </div>
  );
}
