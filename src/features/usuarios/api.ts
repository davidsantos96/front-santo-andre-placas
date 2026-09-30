import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ApiError, AtualizarUsuarioRequest, NovoUsuarioRequest, Usuario } from '@/api/types';
import type { Papel } from '@/auth/papeis';

export const PAPEIS: { valor: Papel; label: string }[] = [
  { valor: 'ATENDENTE', label: 'Atendente' },
  { valor: 'GERENTE', label: 'Gerente' },
  { valor: 'ADMIN', label: 'Administrador' },
];
export const rotuloPapel = (p: Papel) => PAPEIS.find((x) => x.valor === p)?.label ?? p;

/** `GET /usuarios` (ADMIN) → `UsuarioResponse[]` (`id, nome, email, papel, ativo`; nunca `senhaHash`). */
export const useUsuarios = () =>
  useQuery({ queryKey: qk.usuarios, queryFn: async () => (await api.get<Usuario[]>('/usuarios')).data });

function useInvalidarUsuarios() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: qk.usuarios });
}

export function useCriarUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation<Usuario, ApiError, NovoUsuarioRequest>({
    mutationFn: async (d) => (await api.post<Usuario>('/usuarios', d)).data,
    onSuccess: invalidar,
  });
}

/** `PUT /usuarios/{id}` não altera a senha (não há endpoint de reset ainda). */
export function useAtualizarUsuario(id: number) {
  const invalidar = useInvalidarUsuarios();
  return useMutation<Usuario, ApiError, AtualizarUsuarioRequest>({
    mutationFn: async (d) => (await api.put<Usuario>(`/usuarios/${id}`, d)).data,
    onSuccess: invalidar,
  });
}

/** Ação padrão é desativar (`PATCH ativo=false`); excluir fica fora da Fase 1. */
export function useAlterarStatusUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation<Usuario, ApiError, { id: number; ativo: boolean }>({
    mutationFn: async ({ id, ativo }) => (await api.patch<Usuario>(`/usuarios/${id}/status`, { ativo })).data,
    onSuccess: invalidar,
  });
}

/** `PATCH /usuarios/{id}/senha` com `{ novaSenha }` (ADMIN): define uma nova senha provisória. */
export function useRedefinirSenha(id: number) {
  return useMutation<Usuario, ApiError, string>({
    mutationFn: async (novaSenha) => (await api.patch<Usuario>(`/usuarios/${id}/senha`, { novaSenha })).data,
  });
}
