// El lote de cada envío de un formulario de Datos (idempotencia de los
// guardados manuales). Puro: lo usa useFormulario y lo prueban los tests.

import type { EstadoFormulario } from '../acciones'

export interface LoteEnvio {
  /** El guardado (estado.vez) al que pertenece: después de guardar bien, lote nuevo. */
  vez: number
  /** Lo que se mandó, sin el lote. */
  contenido: string
  lote: string
}

/** Lo que se manda, ordenado, sin el lote: el mismo contenido da el mismo texto. */
export function contenidoDe(form: FormData | Iterable<[string, FormDataEntryValue]>): string {
  const pares: [string, string][] = []
  for (const [k, v] of form as Iterable<[string, FormDataEntryValue]>) {
    if (k === 'lote') continue
    pares.push([k, typeof v === 'string' ? v : `archivo:${v.name}:${v.size}`])
  }
  pares.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
  return JSON.stringify(pares)
}

/**
 * El mismo envío (mismo guardado, mismo contenido) reusa su lote: si la base ya
 * lo grabó y la respuesta se perdió, el reintento no lo duplica. Otro contenido
 * u otro guardado llevan un lote nuevo.
 */
export function loteDelEnvio(
  anterior: LoteEnvio | null,
  vez: number,
  form: FormData | Iterable<[string, FormDataEntryValue]>,
  nuevo: () => string,
): LoteEnvio {
  const contenido = contenidoDe(form)
  if (anterior && anterior.vez === vez && anterior.contenido === contenido) return anterior
  return { vez, contenido, lote: nuevo() }
}

/** Se cortó la conexión: no se sabe si se guardó. El formulario queda con lo tipeado. */
export function sinConexion(previo: EstadoFormulario): EstadoFormulario {
  return {
    ok: false,
    mensaje: 'No sé si se guardó: se cortó la conexión. Mirá el Registro; si no está, volvé a guardar (el mismo envío no se duplica).',
    errores: {},
    vez: previo.vez,
  }
}
