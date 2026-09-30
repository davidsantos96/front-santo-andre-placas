import * as Dialog from '@radix-ui/react-dialog';
import clsx from 'clsx';

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
  titulo: string;
  descricao: string;
  confirmar: string;
  perigo?: boolean;
};

export function ConfirmDialog({ aberto, onFechar, onConfirmar, titulo, descricao, confirmar, perigo }: Props) {
  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[400px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-placa"
          onOpenAutoFocus={(e) => {
            if (perigo) {
              e.preventDefault();
              (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-cancelar]')?.focus();
            }
          }}
        >
          <Dialog.Title className="font-display text-[18px] font-bold">{titulo}</Dialog.Title>
          <Dialog.Description className="mt-2 text-base text-aco">{descricao}</Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              data-cancelar
              onClick={onFechar}
              className="h-[30px] rounded border border-linha-forte bg-white px-3 text-sm font-medium text-aco hover:bg-fundo"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              className={clsx(
                'h-8 rounded px-3.5 text-sm font-semibold text-white',
                perigo ? 'bg-erro hover:opacity-90' : 'bg-mercosul hover:bg-mercosul-hover',
              )}
            >
              {confirmar}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
