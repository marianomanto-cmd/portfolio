// Cómo se nombra el origen de cada carga en Registro (manual §4.5: Excel,
// captura, manual). Sin dependencias: lo usan la página y sus tests.

import type { FilaRegistro } from '@/lib/vistas/contratos'

/** De dónde salió lo que se grabó: lo que lleva el renglón después de la cuenta, y su ícono. */
export type Origen = 'Excel' | 'captura' | 'planilla CSV' | 'manual' | 'tipeado'

/**
 * El origen a la vista. Lo que se guarda con un formulario (Datos, "Cargar
 * ingreso" y "Cargar gasto") es "manual"; el cuadro de marcha importado, una
 * "planilla CSV" (un archivo, con su huella, no algo tipeado); el CCL y el
 * cripto, "tipeado".
 */
export function nombreOrigen(f: Pick<FilaRegistro, 'origen' | 'lector' | 'cuenta'>): Origen {
  if (f.origen === 'excel') return 'Excel'
  if (f.origen === 'captura') return 'captura'
  if (f.lector === 'cuadro-marcha-csv@1') return 'planilla CSV'
  if (f.lector === 'flujo_real' || f.cuenta === 'Datos') return 'manual'
  return 'tipeado'
}
