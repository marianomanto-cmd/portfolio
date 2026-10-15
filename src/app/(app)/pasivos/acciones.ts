'use server'

// Escrituras de Pasivos: quién paga la cuota y si la empresa te reintegra el
// IVA. Sesión primero (D-21); en modo demo no se guarda nada.

import { revalidatePath } from 'next/cache'
import { actualizarDatosPasivo } from '@/lib/server/escritura-pasivos'
import { exigirSesion, modoDemo } from '@/lib/server/sesion'
import { configurado } from '@/lib/server/supabase'

export interface EstadoDato {
  ok: boolean
  mensaje: string
}

const texto = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function guardarDatoPasivo(_previo: EstadoDato | null, form: FormData): Promise<EstadoDato> {
  try {
    await exigirSesion()
  } catch {
    return { ok: false, mensaje: 'Sesión vencida: volvé a entrar.' }
  }
  const id = Number(form.get('pasivo_id'))
  const campo = String(form.get('campo') ?? '')
  const valor = String(form.get('valor') ?? '')
  let cambios: Parameters<typeof actualizarDatosPasivo>[1]
  if (campo === 'pagador_habitual' && (valor === 'titular' || valor === 'empresa')) cambios = { pagador_habitual: valor }
  else if (campo === 'reintegra_iva' && (valor === 'si' || valor === 'no' || valor === 'sin_declarar')) cambios = { reintegra_iva: valor === 'sin_declarar' ? null : valor === 'si' }
  else return { ok: false, mensaje: 'No entendí qué querés guardar.' }
  if (!Number.isSafeInteger(id) || id < 1) return { ok: false, mensaje: 'Falta el pasivo.' }
  if (modoDemo() || !configurado()) return { ok: true, mensaje: 'Modo demo: está bien, pero no se guarda.' }
  try {
    await actualizarDatosPasivo(id, cambios)
    revalidatePath('/', 'layout')
    return { ok: true, mensaje: 'Guardado.' }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}` }
  }
}
