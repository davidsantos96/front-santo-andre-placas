import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { EntidadeAuditada, RegistroAuditoria } from '@/api/types';

/**
 * `GET /auditoria?entidade=&entidadeId=` (ADMIN/GERENTE; ATENDENTE recebe 403), do mais recente para o mais antigo.
 * Cobre só SERVICO e USUARIO. `enabled` evita consultar com o modal fechado.
 */
export const useAuditoria = (entidade: EntidadeAuditada, entidadeId: number | null) =>
  useQuery({
    queryKey: ['auditoria', entidade, entidadeId],
    enabled: entidadeId !== null,
    queryFn: async () => (await api.get<RegistroAuditoria[]>('/auditoria', { params: { entidade, entidadeId } })).data,
  });
