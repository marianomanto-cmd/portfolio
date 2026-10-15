'use client'

import { useRouter } from 'next/navigation'
import { fechaCorta } from '@/lib/domain/fechas'
import { rutaBalance } from '../_lib/rutas'

// La fecha contra la que se compara el balance: cualquier fecha de carga
// anterior. Vive en la dirección (?comparar=…), como la fecha y el agrupamiento.

export function ElegirComparacion({
  opciones,
  actual,
  porDefecto,
  demo,
  ruta,
}: {
  opciones: string[]
  actual: string
  porDefecto: string
  demo: string | null
  ruta: { fecha: string | null; agrupar: string }
}) {
  const router = useRouter()
  if (opciones.length < 2) return null
  return (
    <label htmlFor="comparar-balance" className="flex min-w-0 flex-col gap-1 text-[13px] text-muted print:hidden">
      Comparar con
      <select
        id="comparar-balance"
        value={actual}
        onChange={(e) => router.push(rutaBalance({ ...ruta, comparar: e.target.value, primera: porDefecto, demo }))}
        className="tocable h-9 min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-text hover:border-border-strong max-md:h-11"
      >
        {[...opciones].reverse().map((f) => (
          <option key={f} value={f}>
            {fechaCorta(f)}/{f.slice(0, 4)}
            {f === porDefecto ? ' · la primera' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
