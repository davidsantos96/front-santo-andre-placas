import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from '@/api/keys';
import type { ApiError, AtualizarVeiculoRequest, ConsultaHistorico, ConsultaVeicularResultado, NovoVeiculoRequest, Veiculo } from '@/api/types';

/** Assume `GET /veiculos?placa=&clienteId=` → `Veiculo[]`. */
export const useVeiculos = (filtro?: { placa?: string; clienteId?: number }, enabled = true) =>
  useQuery({
    queryKey: qk.veiculos(filtro),
    enabled,
    queryFn: async () => (await api.get<Veiculo[]>('/veiculos', { params: filtro })).data,
  });

export const useCriarVeiculo = () => {
  const qc = useQueryClient();
  return useMutation<Veiculo, ApiError, NovoVeiculoRequest>({
    mutationFn: async (dados) => (await api.post<Veiculo>('/veiculos', dados)).data,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['veiculos'] }); void qc.invalidateQueries({ queryKey: ['clientes'] }); },
  });
};

/** Completa um cadastro parcial: `PUT /veiculos/{id}` aplica só os campos enviados. */
export const useAtualizarVeiculo = (id: number) => {
  const qc = useQueryClient();
  return useMutation<Veiculo, ApiError, AtualizarVeiculoRequest>({
    mutationFn: async (dados) => (await api.put<Veiculo>(`/veiculos/${id}`, dados)).data,
    onSuccess: () => {
      for (const k of [['veiculos'], qk.veiculo(id), ['pedidos'], ['pedido'], ['clientes']]) void qc.invalidateQueries({ queryKey: k });
    },
  });
};

/**
 * Consulta veicular (provedor externo ainda não contratado): o backend responde 400
 * "Consulta veicular ainda não está disponível." — erro ESPERADO, tratado como aviso pela UI.
 */
export const useConsultarVeiculo = () =>
  useMutation<ConsultaVeicularResultado, ApiError, number>({
    mutationFn: async (id) => (await api.post<ConsultaVeicularResultado>(`/veiculos/${id}/consultar`)).data,
  });

/** Assume `GET /veiculos/{id}` (não listado no §14 — ver PENDENCIAS.md). */
export const useVeiculo = (id: number) =>
  useQuery({ queryKey: qk.veiculo(id), queryFn: async () => (await api.get<Veiculo>(`/veiculos/${id}`)).data });

/** Sempre `[]` enquanto não houver provedor de consulta. */
export const useHistoricoConsultas = (id: number) =>
  useQuery({
    queryKey: qk.consultas(id),
    queryFn: async () => (await api.get<ConsultaHistorico[]>(`/veiculos/${id}/historico-consultas`)).data,
  });
