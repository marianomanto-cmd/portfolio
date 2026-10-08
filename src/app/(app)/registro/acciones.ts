'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { revertirLote } from '@/lib/server/escritura'
import { exigirSesion, modoDemo } from '@/lib/server/sesion'
import { MOTIVOS, type EstadoReversion } from '@/components/registro/motivos'

// Revertir un lote (D-17, CA-9): borra sus filas, restaura lo pisado y deja
// cada carga marcada como revertida, con su motivo. Todo pasa por la función de
// la base, en una sola transacción (docs/datos.md, regla 3).


const Entrada = z
  .object({
    lote: z.string().trim().min(1, 'Falta el lote.').max(100),
    motivo: z.enum(MOTIVOS, { message: 'Elegí un motivo.' }),
    detalle: z.string().trim().max(300, 'El detalle es muy largo (máximo 300 caracteres).'),
  })
  .refine((x) => x.motivo !== 'otro' || x.detalle.length >= 3, { message: 'Con "otro", escribí el motivo.', path: ['detalle'] })

export async function revertirLoteAccion(_previo: EstadoReversion | null, datos: FormData): Promise<EstadoReversion> {
  try {
    await exigirSesion()
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : 'Sesión vencida: volvé a entrar.' }
  }
  const p = Entrada.safeParse({
    lote: datos.get('lote') ?? '',
    motivo: datos.get('motivo') ?? '',
    detalle: datos.get('detalle') ?? '',
  })
  if (!p.success) return { ok: false, mensaje: p.error.issues[0]?.message ?? 'Datos inválidos.' }
  const { lote, motivo, detalle } = p.data
  const texto = detalle ? `${motivo}: ${detalle}` : motivo
  if (modoDemo()) {
    return { ok: true, mensaje: 'Modo demo: no se revirtió nada (los datos de ejemplo no se tocan).' }
  }
  try {
    const r: unknown = await revertirLote(lote, texto)
    revalidatePath('/', 'layout')
    const res = r && typeof r === 'object' ? (r as { cargas?: unknown; borradas?: unknown; restauradas?: unknown }) : null
    const n = Array.isArray(res?.cargas) ? res.cargas.length : null
    const borradas = typeof res?.borradas === 'number' ? res.borradas : null
    const restauradas = typeof res?.restauradas === 'number' ? res.restauradas : null
    const partes = [
      n !== null ? `${n} carga${n === 1 ? '' : 's'}` : null,
      borradas !== null ? `${borradas} fila${borradas === 1 ? '' : 's'} borrada${borradas === 1 ? '' : 's'}` : null,
      restauradas !== null ? `${restauradas} restaurada${restauradas === 1 ? '' : 's'}` : null,
    ].filter(Boolean)
    return { ok: true, mensaje: `Lote revertido${partes.length ? `: ${partes.join(' · ')}` : ''}. Queda en el registro, marcado como revertido.` }
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : String(e) }
  }
}
