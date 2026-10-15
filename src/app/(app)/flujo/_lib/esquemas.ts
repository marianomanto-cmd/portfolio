// Esquemas de los formularios de Flujo (zod 4): los números se tipean en
// formato argentino ("1.234,56") y viajan como texto decimal (D-32).

import { z } from 'zod'
import { leerNumeroAR } from '@/lib/domain/dinero'

const vacio = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

function numeroAR(min: 'positivo' | 'cero' = 'positivo') {
  return z.string({ message: 'Escribí un número, como 1.234,56.' }).transform((t, ctx) => {
    const n = leerNumeroAR(t)
    if (n === null) {
      ctx.addIssue({ code: 'custom', message: 'Escribí un número, como 1.234,56.' })
      return z.NEVER
    }
    if (min === 'positivo' ? !(Number(n) > 0) : Number(n) < 0) {
      ctx.addIssue({ code: 'custom', message: min === 'positivo' ? 'Tiene que ser mayor que cero.' : 'No puede ser negativo.' })
      return z.NEVER
    }
    return n
  })
}
const opcional = <T extends z.ZodType>(e: T) => z.preprocess(vacio, e.optional()).transform((v) => (v ?? null) as z.output<T> | null)
const fecha = z.string({ message: 'Elegí una fecha.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí una fecha.')

export const esquemaFlujoReal = z
  .object({
    sentido: z.enum(['ingreso', 'gasto']),
    concepto: z.enum(['mensual', 'extraordinario'], { message: 'Elegí el concepto.' }),
    moneda: z.enum(['ARS', 'USD'], { message: 'Elegí US$ o $.' }),
    monto: numeroAR(),
    fecha,
    cuenta: z.string({ message: 'Elegí la cuenta (o «Afuera»).' }).regex(/^(afuera|\d+)$/, 'Elegí la cuenta (o «Afuera»).'),
    cripto: opcional(numeroAR()),
    pesos: opcional(numeroAR()),
    notas: opcional(z.string().trim().max(500, 'Hasta 500 caracteres.')),
  })
  .superRefine((d, ctx) => {
    if ((d.cripto === null) !== (d.pesos === null)) {
      ctx.addIssue({ code: 'custom', path: [d.cripto === null ? 'cripto' : 'pesos'], message: 'El cripto y los pesos van juntos: completá los dos o ninguno.' })
    }
    if (d.cripto !== null && (d.moneda !== 'USD' || d.sentido !== 'ingreso')) {
      ctx.addIssue({ code: 'custom', path: ['cripto'], message: 'El cripto va solo con dólares que vendiste.' })
    }
  })

export const esquemaRecurrente = z
  .object({
    accion: z.enum(['alta', 'cambiar_desde', 'cerrar', 'anular']),
    sentido: z.enum(['ingreso', 'gasto']),
    id: opcional(z.coerce.number().int().positive()),
    concepto: opcional(z.string().trim().min(1).max(80, 'Hasta 80 caracteres.')),
    moneda: opcional(z.enum(['ARS', 'USD'])),
    monto: opcional(numeroAR()),
    desde: opcional(fecha),
    hasta: opcional(fecha),
    frecuencia: opcional(z.enum(['mensual', 'bimestral', 'trimestral', 'semestral', 'anual'])),
    primer_mes: opcional(z.string().regex(/^\d{4}-\d{2}$/, 'Elegí el mes.')),
    naturaleza: opcional(z.enum(['sueldo', 'honorarios', 'dividendo', 'retiro_a_cuenta', 'otro'])),
  })
  .superRefine((d, ctx) => {
    if (d.accion === 'alta' && !d.concepto) ctx.addIssue({ code: 'custom', path: ['concepto'], message: 'Poné un concepto.' })
    if (d.accion === 'alta' && !d.moneda) ctx.addIssue({ code: 'custom', path: ['moneda'], message: 'Elegí US$ o $.' })
    if ((d.accion === 'alta' || d.accion === 'cambiar_desde') && !d.monto) ctx.addIssue({ code: 'custom', path: ['monto'], message: 'Poné el monto.' })
    if ((d.accion === 'alta' || d.accion === 'cambiar_desde') && !d.desde) ctx.addIssue({ code: 'custom', path: ['desde'], message: 'Elegí desde cuándo.' })
    if (d.accion === 'cerrar' && !d.hasta) ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'Elegí hasta cuándo.' })
    if (d.accion !== 'alta' && !d.id) ctx.addIssue({ code: 'custom', path: ['id'], message: 'Falta cuál.' })
    if (d.frecuencia && d.frecuencia !== 'mensual' && !d.primer_mes) ctx.addIssue({ code: 'custom', path: ['primer_mes'], message: 'Elegí el primer mes en que se paga.' })
  })

export const esquemaPago = z.object({
  activo_id: z.coerce.number().int().positive(),
  fecha,
  pago_por_vn: numeroAR(),
  fuente: z.string().trim().min(1, 'Decí de dónde lo sacaste (el aviso de licitación, por ejemplo).').max(200, 'Hasta 200 caracteres.'),
})

export function leer<S extends z.ZodType>(esquema: S, form: FormData): { ok: true; datos: z.output<S> } | { ok: false; errores: Record<string, string> } {
  const r = esquema.safeParse(Object.fromEntries(form.entries()))
  if (r.success) return { ok: true, datos: r.data }
  const errores: Record<string, string> = {}
  for (const i of r.error.issues) {
    const k = i.path.length ? String(i.path[0]) : '_'
    errores[k] ??= i.message
  }
  return { ok: false, errores }
}
