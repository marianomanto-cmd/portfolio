// Validación de los formularios de Datos (y del alta de un activo desde
// Cargar). Los números se tipean en formato argentino y viajan como texto
// decimal (D-32): nunca como number de JavaScript.

import { z } from 'zod'
import { Decimal, leerNumeroAR } from '@/lib/domain/dinero'
import { GEOGRAFIAS, INDEXACIONES, MONEDAS, TIPOS_ACTIVO } from './catalogo'

export { GEOGRAFIAS, INDEXACIONES, MONEDAS, TIPOS_ACTIVO }

const vacio = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

/** Número es-AR → texto decimal normalizado. */
function numeroAR(opciones: { min?: 'positivo' | 'cero' } = {}) {
  return z.string().transform((s, ctx) => {
    const v = leerNumeroAR(s)
    if (v === null) {
      ctx.addIssue({ code: 'custom', message: 'No lo entiendo como número (ej.: 1.234,56).' })
      return z.NEVER
    }
    const d = new Decimal(v)
    if (opciones.min === 'positivo' && d.lte(0)) {
      ctx.addIssue({ code: 'custom', message: 'Tiene que ser mayor que cero.' })
      return z.NEVER
    }
    if (opciones.min === 'cero' && d.lt(0)) {
      ctx.addIssue({ code: 'custom', message: 'No puede ser negativo.' })
      return z.NEVER
    }
    return d.toFixed()
  })
}

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí una fecha.')
const fechaOpcional = z.preprocess(vacio, fecha.optional()).transform((v) => v ?? null)
const texto = (max: number, mensaje = 'Completalo.') => z.string().trim().min(1, mensaje).max(max, `Hasta ${max} caracteres.`)
const id = z.coerce.number().int().positive()

const color = z.preprocess(vacio, z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color como #RRGGBB.').optional()).transform((v) => v ?? null)

/** Alta de un activo: la moneda de riesgo la elige el dueño, nunca la app (D-73 de la visión). */
export const esquemaActivo = z
  .object({
    ticker: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Falta el ticker.')
      .max(20, 'Hasta 20 caracteres.')
      .regex(/^[A-Z0-9.\-]+$/, 'Solo letras, números, punto y guion.'),
    nombre: texto(120, 'Falta el nombre.'),
    tipo: z.enum(TIPOS_ACTIVO, { message: 'Elegí el tipo.' }),
    moneda_riesgo: z.enum(MONEDAS, { message: '¿A qué moneda te expone? Elegila vos.' }),
    geografia: z.enum(GEOGRAFIAS, { message: 'Elegí la geografía.' }),
    indexacion: z.preprocess(vacio, z.enum(INDEXACIONES).optional()).transform((v) => v ?? null),
    ticker_subyacente: z.preprocess(vacio, z.string().trim().toUpperCase().max(20).optional()).transform((v) => v ?? null),
    ratio: z.preprocess(vacio, numeroAR({ min: 'positivo' }).optional()).transform((v) => v ?? null),
    color,
    fecha_vencimiento: fechaOpcional,
  })
  .superRefine((a, ctx) => {
    const esBono = a.tipo === 'bono' || a.tipo === 'lecap'
    if (esBono && !a.indexacion) ctx.addIssue({ code: 'custom', path: ['indexacion'], message: 'Un bono o una letra necesita su indexación.' })
    if (!esBono && a.indexacion) ctx.addIssue({ code: 'custom', path: ['indexacion'], message: 'Solo los bonos y las letras tienen indexación.' })
    if (a.tipo === 'cedear' && !a.ticker_subyacente) ctx.addIssue({ code: 'custom', path: ['ticker_subyacente'], message: 'Un CEDEAR necesita el ticker del subyacente.' })
    if (a.tipo === 'cedear' && !a.ratio) ctx.addIssue({ code: 'custom', path: ['ratio'], message: 'Un CEDEAR necesita su ratio (CEDEARs por acción).' })
  })

export type DatosActivo = z.infer<typeof esquemaActivo>

/** Edición de un activo existente (el ticker no cambia). */
export const esquemaEdicionActivo = z
  .object({
    id,
    nombre: texto(120, 'Falta el nombre.'),
    tipo: z.enum(TIPOS_ACTIVO, { message: 'Elegí el tipo.' }),
    moneda_riesgo: z.enum(MONEDAS, { message: 'Elegí la moneda de riesgo.' }),
    geografia: z.enum(GEOGRAFIAS, { message: 'Elegí la geografía.' }),
    indexacion: z.preprocess(vacio, z.enum(INDEXACIONES).optional()).transform((v) => v ?? null),
    ticker_subyacente: z.preprocess(vacio, z.string().trim().toUpperCase().max(20).optional()).transform((v) => v ?? null),
    color,
    fecha_vencimiento: fechaOpcional,
    activo_bool: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
    ratio: z.preprocess(vacio, numeroAR({ min: 'positivo' }).optional()).transform((v) => v ?? null),
    ratio_desde: fechaOpcional,
  })
  .superRefine((a, ctx) => {
    const esBono = a.tipo === 'bono' || a.tipo === 'lecap'
    if (esBono && !a.indexacion) ctx.addIssue({ code: 'custom', path: ['indexacion'], message: 'Un bono o una letra necesita su indexación.' })
    if (!esBono && a.indexacion) ctx.addIssue({ code: 'custom', path: ['indexacion'], message: 'Solo los bonos y las letras tienen indexación.' })
    if (a.tipo === 'cedear' && !a.ticker_subyacente) ctx.addIssue({ code: 'custom', path: ['ticker_subyacente'], message: 'Un CEDEAR necesita el ticker del subyacente.' })
    if (a.ratio && !a.ratio_desde) ctx.addIssue({ code: 'custom', path: ['ratio_desde'], message: '¿Desde cuándo vale el ratio nuevo?' })
  })

export type DatosEdicionActivo = z.infer<typeof esquemaEdicionActivo>

export const esquemaBien = z.object({
  nombre: texto(80, 'Falta el nombre (ej.: Casa, Camioneta).'),
  tipo: z.enum(['inmueble', 'vehiculo', 'otro'], { message: 'Elegí el tipo.' }),
  moneda_valuacion: z.enum(MONEDAS, { message: '¿En qué moneda lo valuás?' }),
  geografia: z.enum(GEOGRAFIAS).default('AR'),
  pasivo_id: z.preprocess(vacio, id.optional()).transform((v) => v ?? null),
})

export const esquemaValuacion = z.object({
  bien_id: id,
  fecha,
  valor: numeroAR({ min: 'positivo' }),
  fuente: texto(200, '¿De dónde sale? (tasación, guía de precios, escritura…)'),
})

export const esquemaPasivo = z.object({
  nombre: texto(80, 'Falta el nombre.'),
  tipo: z.enum(['leasing', 'tarjeta', 'prestamo'], { message: 'Elegí el tipo.' }),
  moneda: z.enum(MONEDAS, { message: 'Elegí la moneda.' }),
  fecha_inicio: fecha,
  cuotas_totales: z.coerce.number({ message: 'Cantidad de cuotas.' }).int('Un número entero.').positive('Mayor que cero.').max(600),
  monto_financiado_neto: z.preprocess(vacio, numeroAR({ min: 'positivo' }).optional()).transform((v) => v ?? null),
  anticipo_neto: z.preprocess(vacio, numeroAR({ min: 'cero' }).optional()).transform((v) => v ?? null),
  opcion_compra_neto: z.preprocess(vacio, numeroAR({ min: 'cero' }).optional()).transform((v) => v ?? null),
  opcion_compra_fecha: fechaOpcional,
  valor_bien: z.preprocess(vacio, numeroAR({ min: 'positivo' }).optional()).transform((v) => v ?? null),
  notas: z.preprocess(vacio, z.string().trim().max(500).optional()).transform((v) => v ?? null),
})

export const esquemaPasivoSaldo = z.object({
  pasivo_id: id,
  fecha,
  capital_pendiente: numeroAR({ min: 'cero' }),
})

export type ResultadoFormulario<T> = { ok: true; datos: T } | { ok: false; errores: Record<string, string> }

/** FormData → datos validados, o el primer error de cada campo. */
export function leerFormulario<S extends z.ZodType>(esquema: S, form: FormData | Record<string, unknown>): ResultadoFormulario<z.output<S>> {
  const crudo = form instanceof FormData ? Object.fromEntries(form.entries()) : form
  const r = esquema.safeParse(crudo)
  if (r.success) return { ok: true, datos: r.data }
  const errores: Record<string, string> = {}
  for (const issue of r.error.issues) {
    const campo = issue.path.length ? String(issue.path[0]) : '_'
    if (!errores[campo]) errores[campo] = issue.message
  }
  return { ok: false, errores }
}
