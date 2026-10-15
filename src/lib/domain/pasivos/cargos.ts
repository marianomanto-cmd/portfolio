// A qué cuota va cada cargo extra del leasing (multa, comisión, reserva de
// fondos…): se debita con ella. Una sola regla para Pasivos (la apertura de
// cada cuota), Evolución (el costo del leasing) y Flujo (lo que sale del mes).
// Sin dependencias pesadas: Flujo la usa también en el navegador.

import type { CargoExtra, Cuota } from './tipos'

type CuotaClave = Pick<Cuota, 'pasivo_id' | 'nro' | 'fecha_vencimiento'>

/**
 * Los cargos que cuentan (sin anulados), por cuota (`${pasivo_id}-${nro}`):
 * el de su número de cuota; uno que no dice cuota (o dice una que no está en
 * el cuadro), con la primera que vence en el mes de su fecha o después: se
 * debita con la cuota siguiente. Solo uno posterior a la última cuota no va a
 * ninguna (cuenta en el costo total del leasing, y Pasivos lo dice).
 */
export function cargosPorCuota(cuotas: readonly CuotaClave[], cargos: readonly CargoExtra[]): Map<string, CargoExtra[]> {
  const porFecha = [...cuotas].sort((a, b) => (a.fecha_vencimiento === b.fecha_vencimiento ? a.nro - b.nro : a.fecha_vencimiento < b.fecha_vencimiento ? -1 : 1))
  const out = new Map<string, CargoExtra[]>()
  for (const k of cargos) {
    if (k.anulado) continue
    const delPasivo = porFecha.filter((q) => q.pasivo_id === k.pasivo_id)
    const c =
      (k.cuota_nro !== null ? delPasivo.find((q) => q.nro === k.cuota_nro) : undefined) ??
      delPasivo.find((q) => q.fecha_vencimiento.slice(0, 7) >= k.fecha.slice(0, 7))
    if (!c) continue
    const clave = `${c.pasivo_id}-${c.nro}`
    out.set(clave, [...(out.get(clave) ?? []), k])
  }
  return out
}
