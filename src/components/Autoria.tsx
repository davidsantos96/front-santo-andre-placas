import { dataBR } from '@/lib/datas';
import { nomeAutor } from '@/lib/autor';

type Props = {
  criadoEm?: string | null; criadoPor?: string | null;
  atualizadoEm?: string | null; atualizadoPor?: string | null;
  /** Verbo do primeiro trecho: "Cadastrado", "Criado"… */
  verbo?: string;
  className?: string;
};

/**
 * Rodapé discreto de rastreabilidade: "Cadastrado por X em 07/10/2026 · Última alteração por Y em 08/10/2026".
 * `atualizadoEm === null` significa "nunca editado" (o trecho de alteração some). Sem nenhum dado, não renderiza.
 */
export function Autoria({ criadoEm, criadoPor, atualizadoEm, atualizadoPor, verbo = 'Cadastrado', className }: Props) {
  const criado = criadoEm || criadoPor ? `${verbo} por ${nomeAutor(criadoPor)}${criadoEm ? ` em ${dataBR(criadoEm)}` : ''}` : null;
  const alterado = atualizadoEm ? `Última alteração por ${nomeAutor(atualizadoPor)} em ${dataBR(atualizadoEm)}` : null;
  if (!criado && !alterado) return null;
  return (
    <p data-testid="autoria" className={className ?? 'mt-4 border-t border-linha-fraca pt-2.5 text-xs text-aco'}>
      {[criado, alterado].filter(Boolean).join(' · ')}
    </p>
  );
}
