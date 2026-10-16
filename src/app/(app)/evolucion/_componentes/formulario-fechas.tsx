// "Elegir fechas": un formulario GET con dos fechas de carga. Anda sin
// JavaScript y deja el período en la URL.

import { fechaCorta } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import type { ParametrosEvolucion } from '@/lib/vistas/contratos-evolucion'
import { clasesBoton } from '@/components/ui'
import { POR_DEFECTO } from '../_lib/parametros'

export function FormularioFechas({ p, demo, fechas }: { p: ParametrosEvolucion; demo: string | null; fechas: Fecha[] }) {
  if (fechas.length < 2) return <p className="text-sm text-muted">Con dos cargas o más vas a poder elegir las fechas.</p>
  const desde = p.periodo === 'elegir' && p.desde ? p.desde : fechas[0]
  const hasta = p.periodo === 'elegir' && p.hasta ? p.hasta : fechas.at(-1)
  const campo = 'tocable min-h-11 w-full min-w-0 rounded-item border border-border bg-surface px-2 text-sm'
  return (
    <form action="/evolucion" method="get" className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,10rem)_auto]">
      {demo ? <input type="hidden" name="demo" value={demo} /> : null}
      {p.vista !== POR_DEFECTO.vista ? <input type="hidden" name="vista" value={p.vista} /> : null}
      {p.moneda !== POR_DEFECTO.moneda ? <input type="hidden" name="moneda" value={p.moneda} /> : null}
      {p.s ? <input type="hidden" name="s" value={p.s} /> : null}
      <input type="hidden" name="periodo" value="elegir" />
      <label className="flex min-w-0 flex-col gap-1 text-[13px] text-muted">
        Desde
        <select name="desde" defaultValue={desde} className={campo}>
          {fechas.slice(0, -1).map((f) => (
            <option key={f} value={f}>
              {fechaCorta(f)}/{f.slice(2, 4)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-[13px] text-muted">
        Hasta
        <select name="hasta" defaultValue={hasta} className={campo}>
          {fechas.slice(1).map((f) => (
            <option key={f} value={f}>
              {fechaCorta(f)}/{f.slice(2, 4)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={`${clasesBoton('primario', 'sm')} col-span-2 min-h-11 sm:col-span-1`}>
        Ver
      </button>
    </form>
  )
}
