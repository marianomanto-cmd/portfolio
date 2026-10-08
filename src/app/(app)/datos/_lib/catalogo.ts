// Valores del catálogo y sus nombres en castellano (sin zod: lo usan
// componentes de cliente).

export const TIPOS_ACTIVO = ['cedear', 'accion_local', 'bono', 'lecap', 'fci'] as const
export const GEOGRAFIAS = ['AR', 'US', 'BR', 'GLOBAL'] as const
export const INDEXACIONES = ['fija', 'cer', 'tamar', 'dual_cer_tamar', 'dolar_linked', 'hard_dollar'] as const
export const MONEDAS = ['ARS', 'USD'] as const

export const NOMBRE_TIPO: Record<(typeof TIPOS_ACTIVO)[number], string> = {
  cedear: 'CEDEAR',
  accion_local: 'Acción local',
  bono: 'Bono',
  lecap: 'Letra (LECAP)',
  fci: 'Fondo (FCI)',
}

export const NOMBRE_INDEXACION: Record<(typeof INDEXACIONES)[number], string> = {
  fija: 'Tasa fija',
  cer: 'CER',
  tamar: 'TAMAR',
  dual_cer_tamar: 'Dual CER/TAMAR',
  dolar_linked: 'Dólar linked',
  hard_dollar: 'Hard dollar',
}

export const NOMBRE_GEOGRAFIA: Record<(typeof GEOGRAFIAS)[number], string> = {
  AR: 'Argentina',
  US: 'Estados Unidos',
  BR: 'Brasil',
  GLOBAL: 'Global',
}
