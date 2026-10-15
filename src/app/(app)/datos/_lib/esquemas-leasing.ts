// Validación de los formularios de Datos › Leasing que suma la entrega 4: el
// CSV del cuadro de marcha, el pago de una cuota y la fecha de desembolso.
// Los números se tipean en formato argentino y viajan como texto (D-32).

import { z } from 'zod'
import { Decimal, leerNumeroAR } from '@/lib/domain/dinero'

const vacio = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí una fecha.')
const id = z.coerce.number().int().positive()
const lote = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Falta el lote.')

const numeroPositivo = z.string().transform((s, ctx) => {
  const v = leerNumeroAR(s)
  if (v === null) {
    ctx.addIssue({ code: 'custom', message: 'No lo entiendo como número (ej.: 1.234,56).' })
    return z.NEVER
  }
  if (new Decimal(v).lte(0)) {
    ctx.addIssue({ code: 'custom', message: 'Tiene que ser mayor que cero.' })
    return z.NEVER
  }
  return new Decimal(v).toFixed()
})

/** El CSV para revisar: el texto entero (del archivo o pegado), su nombre y el pasivo. */
export const esquemaPlanilla = z.object({
  pasivo_id: id,
  nombre: z.preprocess(vacio, z.string().trim().max(200).optional()).transform((v) => v ?? 'cuadro de marcha.csv'),
  texto: z.string().min(1, 'Elegí el archivo o pegá el texto de la planilla.').max(2_000_000, 'El archivo es demasiado grande.'),
})

export const esquemaGuardarPlanilla = esquemaPlanilla.extend({ lote })

export const esquemaDeshacer = z.object({ lote })

/** El pago de una cuota: la fecha (opcional: "fecha sin dato" vale), el CCL de ese día y de dónde salió (los dos o ninguno). */
export const esquemaPago = z
  .object({
    pasivo_id: id,
    nro: id,
    lote,
    fecha_pago: z.preprocess(vacio, fecha.optional()).transform((v) => v ?? null),
    ccl: z.preprocess(vacio, numeroPositivo.optional()).transform((v) => v ?? null),
    ccl_fuente: z.preprocess(vacio, z.string().trim().max(200, 'Hasta 200 caracteres.').optional()).transform((v) => v ?? null),
    pagador: z.preprocess(vacio, z.enum(['titular', 'empresa']).optional()).transform((v) => v ?? null),
  })
  .superRefine((p, ctx) => {
    if ((p.ccl === null) !== (p.ccl_fuente === null)) {
      ctx.addIssue({ code: 'custom', path: [p.ccl === null ? 'ccl' : 'ccl_fuente'], message: 'El CCL del día del pago y de dónde lo sacaste van juntos.' })
    }
    if (p.ccl !== null && p.fecha_pago === null) ctx.addIssue({ code: 'custom', path: ['fecha_pago'], message: 'El CCL es del día del pago: falta la fecha.' })
  })

export const esquemaDesembolso = z.object({ pasivo_id: id, fecha_desembolso: fecha })

/** Un cargo extra a mano: fecha, qué es, importe en pesos (con IVA si lo lleva), la cuota si es de una y de dónde sale. */
export const esquemaCargo = z.object({
  pasivo_id: id,
  lote,
  fecha,
  concepto: z.enum(['multa', 'comision', 'reserva_fondos', 'interes', 'otro'], { message: 'Elegí qué es.' }),
  detalle: z.preprocess(vacio, z.string().trim().max(200, 'Hasta 200 caracteres.').optional()).transform((v) => v ?? null),
  importe: numeroPositivo,
  cuota_nro: z.preprocess(vacio, id.optional()).transform((v) => v ?? null),
  fuente: z.enum(['comprobante', 'contrato', 'a_confirmar', 'supuesto'], { message: 'Elegí de dónde sale.' }),
})

/** La opción de compra que trae la planilla, para guardarla en el contrato. */
export const esquemaOpcion = z.object({ pasivo_id: id, neto: z.string().regex(/^\d+(\.\d+)?$/), fecha })
