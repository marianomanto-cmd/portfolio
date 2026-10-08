import { modoDemo } from '@/lib/server/sesion'
import { cargaPendiente } from '@/components/calculos'
import { FaltaConfiguracion } from '@/lib/server/supabase'
import { ejemploHoyVariante } from '@/lib/vistas/ejemplo'
import { ChipEstado, type EstadoChip } from './chip-estado'
import { hoyDelPedido } from './datos'

/** Indicador de la barra superior: "Datos al cierre del mié 14/10 · ✓ 5 de 5 fuentes". */
export async function EstadoDatos() {
  try {
    const v = await hoyDelPedido()
    // En el modo demo, las variantes (?demo=…) muestran su propio estado.
    const variantes: Record<string, EstadoChip> | undefined = modoDemo()
      ? Object.fromEntries(
          (['vacio', 'express', 'viejo'] as const).map((k) => {
            const x = ejemploHoyVariante(k)
            return [k, { fechaDatos: x.fecha_datos, fuentes: x.fuentes }]
          }),
        )
      : undefined
    return <ChipEstado fechaDatos={v.fecha_datos} fuentes={v.fuentes} variantes={variantes} />
  } catch (e) {
    return <ChipEstado fechaDatos={null} fuentes={[]} problema={e instanceof FaltaConfiguracion ? 'Falta configurar la base' : 'No pude leer los datos'} />
  }
}

/** Punto gris en Cargar: es día hábil, ya cerró BYMA y todavía no cargaste hoy (visión §3.2). */
export async function PuntoCarga() {
  try {
    const v = await hoyDelPedido()
    // El ejemplo del modo demo no tiene hora: el punto vale siempre que falte la carga.
    const falta = modoDemo() ? v.es_habil_hoy && !v.cargo_hoy : cargaPendiente(v, new Date())
    if (!falta) return null
    return <span aria-hidden className="block size-2 rounded-full bg-surface ring-2 ring-accent" />
  } catch {
    return null
  }
}

export function ChipCargando() {
  return <span aria-hidden className="esqueleto block h-8 w-24 md:w-56" />
}
