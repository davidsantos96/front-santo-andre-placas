/** Feature flags. `metas` (progresso de metas) é da Fase 2 do produto. */
export const features = {
  metas: import.meta.env.VITE_FEATURE_METAS === 'true',
} as const;
