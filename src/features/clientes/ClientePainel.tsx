import * as Dialog from '@radix-ui/react-dialog';
import type { Cliente } from '@/api/types';
import { ClienteForm } from './ClienteForm';

/** Painel lateral (Radix Dialog ancorado à direita, 420px) com o formulário de cliente. */
export function ClientePainel({ aberto, onFechar, onSalvo }: { aberto: boolean; onFechar: () => void; onSalvo: (c: Cliente) => void }) {
  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-full overflow-auto bg-white p-5 shadow-placa">
          <Dialog.Title className="font-display text-[18px] font-bold">Novo cliente</Dialog.Title>
          <Dialog.Description className="mb-4 mt-1 text-sm text-aco">Ao salvar, o cliente já fica selecionado no pedido.</Dialog.Description>
          <ClienteForm onSalvo={onSalvo} onCancelar={onFechar} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
