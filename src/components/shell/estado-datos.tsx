import { modoDemo } from '@/lib/server/sesion'
import { cargaPendiente } from '@/components/calculos'
import { FaltaConfiguracion } from '@/lib/server/supabase'
import { ejemploHoyVariante } from '@/lib/vistas/ejemplo'
import { ChipEstado, type EstadoChip } from './chip-estado'
import { hoyDelPedido } from './datos'

/** Chip de la barra superior: "● CARGA DE HOY · 09:41 | CCL 1.485 Cripto 1.510" (D-156). */
export async function EstadoDatos() {
  try {
    const v = await hoyDelPedido()
    // En el modo demo, las variantes (?demo=…) muestran su propio estado.
    const variantes: Record<string, EstadoChip> | undefined = modoDemo()
      ? Object.fromEntries(
          (['vacio', 'express', 'viejo'] as const).map((k) => {
            const x = ejemploHoyVariante(k)
            return [k, { hoy: x.hoy, fechaDatos: x.fecha_datos, guardadoEn: x.guardado_en ?? null, fuentes: x.fuentes }]
          }),
        )
      : undefined
    return <ChipEstado hoy={v.hoy} fechaDatos={v.fecha_datos} guardadoEn={v.guardado_en ?? null} fuentes={v.fuentes} variantes={variantes} />
  } catch (e) {
    return <ChipEstado fechaDatos={null} fuentes={[]} problema={e instanceof FaltaConfiguracion ? 'Falta configurar la base' : 'No pude leer los datos'} />
  }
}

/**
 * El punto de "falta cargar" (visión §3.2, D-127): va encima del botón Cargar
 * de la barra superior y del de la barra inferior. Es día hábil, ya cerró BYMA
 * y todavía no cargaste hoy.
 */
export async function PuntoCarga() {
  try {
    const v = await hoyDelPedido()
    // El ejemplo del modo demo no tiene hora: el punto vale siempre que falte la carga.
    const falta = modoDemo() ? v.es_habil_hoy && !v.cargo_hoy : cargaPendiente(v, new Date())
    if (!falta) return null
    // Un punto de tinta con el borde del fondo, encima de la pastilla sangría (el aviso de Hoy lo dice con palabras).
    return <span aria-hidden className="block size-2.5 rounded-full border-2 border-bg bg-text" title="Todavía no cargaste hoy" />
  } catch {
    return null
  }
}

export function ChipCargando() {
  return <span aria-hidden className="esqueleto block h-9 w-24 rounded-full md:w-56" />
}
