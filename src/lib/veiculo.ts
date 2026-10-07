import type { Veiculo } from '@/api/types';

/** Cadastro parcial (só a placa) é válido no backend: marca/modelo e anos podem vir `null`. */
export const modeloDoVeiculo = (v: Pick<Veiculo, 'marcaModelo'>) => v.marcaModelo || 'Dados incompletos';
export const anosDoVeiculo = (v: Pick<Veiculo, 'anoFabricacao' | 'anoModelo'>) =>
  v.anoFabricacao || v.anoModelo ? `${v.anoFabricacao ?? '—'}/${v.anoModelo ?? '—'}` : '—';
