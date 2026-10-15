// Ejemplo INVENTADO de Pasivos para el modo demo (D-24): ningún número es del
// dueño. Un leasing de 35 cánones de $ 1.000.000, 14 pagados, $ 22.000.000
// financiados, opción de compra de $ 1.000.000; CCL de hoy 1.500,00.
//
// Estados (?demo=): sin-pasivo · sin-cuadro · sin-tasa · cuadro (por defecto:
// la planilla importada, como hoy en producción) · completo (con el valor de
// cancelación, el CCL de cada pago, el pagador y un cargo extra).

import { aCargos, aCuotas, leerCuadroMarcha } from '@/lib/carga/cuadro-marcha'
import { Decimal } from '@/lib/domain/dinero'
import type { ContratoPasivo, HechosPasivos } from '@/lib/domain/pasivos/tipos'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import { armarPasivos } from './armar-pasivos'
import type { VistaPasivos } from './contratos-pasivos'

export const HOY_PASIVOS: Fecha = '2026-10-14'
export const VARIANTES_PASIVOS = ['sin-pasivo', 'sin-cuadro', 'sin-tasa', 'cuadro', 'completo'] as const
export type VariantePasivos = (typeof VARIANTES_PASIVOS)[number]

export function variantePasivos(v: unknown): VariantePasivos {
  return typeof v === 'string' && (VARIANTES_PASIVOS as readonly string[]).includes(v) ? (v as VariantePasivos) : 'cuadro'
}

const D = (x: string | number) => new Decimal(x)

function mesDe(k: number): { venc: Fecha; mes: string } {
  const m = 8 + k // la cuota 1 vence el 01/09/2025
  const anio = 2025 + Math.floor((m - 1) / 12)
  const mm = ((m - 1) % 12) + 1
  const venc = `${anio}-${String(mm).padStart(2, '0')}-01`
  const [a2, m2] = mm === 1 ? [anio - 1, 12] : [anio, mm - 1]
  return { venc, mes: `${a2}-${String(m2).padStart(2, '0')}` }
}

const dos = (centavos: number) => `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`

/**
 * La planilla de ejemplo (con 14 pagadas es la misma que
 * tests/fixtures/cuadro-marcha.csv): encabezado real, montos inventados. Con
 * otra cantidad de pagadas y un cargo, la planilla "actualizada" que manda el
 * dueño cuando paga otra cuota (la revisión del demo de Datos › Leasing).
 */
export function csvDeEjemplo(pagadas = 14, conCargo = false): string {
  const filas = [
    'nro_cuota,fecha_vencimiento,mes_del_canon,canon_neto,seguro_neto,subtotal_neto,iva_21,percepcion_iva_rg3337,total_cuota,pagado,origen_seguro,origen_percepcion',
  ]
  for (let k = 1; k <= 35; k++) {
    const pagada = k <= pagadas
    const canon = 1_000_000_00
    const seguro = pagada ? 80_000_00 : 60_000_00
    const sub = canon + seguro
    const iva = Math.floor((sub * 21) / 100)
    const per = pagada && (k === 4 || k === 9) ? 0 : Math.floor((sub * 3) / 100)
    const { venc, mes } = mesDe(k)
    filas.push(
      [k, venc, mes, dos(canon), dos(seguro), dos(sub), dos(iva), dos(per), dos(sub + iva + per), pagada ? 'SI' : 'NO', pagada ? 'comprobante' : 'CONFIRMAR', pagada ? 'comprobante' : 'SUPUESTO'].join(','),
    )
  }
  if (conCargo) filas.push('multa 13,2026-09-10,Multa por pago fuera de término (ejemplo),,,,,,15000.00,SI,comprobante,n/a')
  filas.push('OC,2028-07-01,opcion_compra,1000000.00,0.00,1000000.00,210000.00,0.00,1210000.00,NO,contrato,n/a')
  return filas.join('\n') + '\n'
}

export function contratoEjemplo(cambios: Partial<ContratoPasivo> = {}): ContratoPasivo {
  return {
    id: 1,
    nombre: 'Leasing de la camioneta',
    tipo: 'leasing',
    moneda: 'ARS',
    fecha_inicio: '2025-07-01',
    cuotas_totales: 35,
    monto_financiado_neto: D(22_000_000),
    anticipo_neto: D(3_000_000),
    opcion_compra_neto: D(1_000_000),
    opcion_compra_fecha: '2028-07-01',
    valor_bien: D(25_000_000),
    alicuota_ganancias: null,
    fecha_desembolso: '2025-07-25',
    pagador_habitual: null,
    reintegra_iva: null,
    notas: null,
    ...cambios,
  }
}

const CARGA_CSV = 901

/** Los hechos del ejemplo de cada estado. */
export function hechosEjemploPasivos(v: VariantePasivos): { h: Hechos; hp: HechosPasivos } {
  const h: Hechos = {
    cuentas: [{ id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true }],
    activos: [],
    operaciones: [],
    cotizaciones: [],
    tipos_cambio: [{ fecha: '2026-10-14', ccl: D('1500.00'), mep: null, cripto_venta: D('1480.00'), oficial: null, carga_id: 900 }],
    saldos: [],
    movimientos: [],
    pasivos: [{ id: 1, nombre: 'Leasing de la camioneta', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-07-01', cuotas_totales: 35, opcion_compra_fecha: '2028-07-01' }],
    pasivo_saldos: [
      { pasivo_id: 1, fecha: '2026-10-08', capital_pendiente: D(18_900_000), naturaleza: 'estimado', fuente: 'Valor presente de las cuotas que faltan (ejemplo inventado)', carga_id: 902 },
    ],
    bienes: [{ id: 2, nombre: 'Camioneta', tipo: 'vehiculo', moneda_valuacion: 'ARS', geografia: 'AR', pasivo_id: 1, activo_bool: true }],
    valuaciones: [{ bien_id: 2, fecha: '2026-10-14', valor: D(30_000_000), fuente: 'Cotización del seguro (ejemplo inventado)', carga_id: 903 }],
    feriados: [],
    cargas: [],
  }
  if (v === 'sin-pasivo') return { h: { ...h, pasivos: [], pasivo_saldos: [], bienes: [], valuaciones: [] }, hp: { contratos: [], cuotas: [], cargos: [] } }
  const lectura = leerCuadroMarcha(csvDeEjemplo(), { cuotasTotales: 35 })
  const cuotas = aCuotas(lectura, 1, CARGA_CSV)
  if (v === 'sin-cuadro') return { h, hp: { contratos: [contratoEjemplo()], cuotas: [], cargos: [] } }
  if (v === 'sin-tasa') return { h, hp: { contratos: [contratoEjemplo({ monto_financiado_neto: null, fecha_desembolso: null })], cuotas, cargos: [] } }
  if (v === 'cuadro') return { h, hp: { contratos: [contratoEjemplo()], cuotas, cargos: [] } }
  // completo: el dueño cargó la fecha y el CCL de cada pago (débito automático el día del vencimiento, ejemplo),
  // la leasera informó el valor de cancelación, quién paga y un cargo extra.
  const ccls = ['1050', '1080', '1110', '1135', '1160', '1190', '1215', '1240', '1270', '1300', '1340', '1380', '1420', '1460']
  const pagadas = cuotas.map((c) =>
    c.pagada ? { ...c, fecha_pago: c.fecha_vencimiento, ccl_del_dia_pago: D(ccls[c.nro - 1]), ccl_fuente: 'Cierre del día (ejemplo inventado)', carga_id: 905 } : c,
  )
  return {
    h: {
      ...h,
      // Una carga anterior con su CCL: con dos, se ve cuánto licuó el CCL la deuda.
      tipos_cambio: [{ fecha: '2026-09-30', ccl: D('1460.00'), mep: null, cripto_venta: D('1445.00'), oficial: null, carga_id: 906 }, ...h.tipos_cambio],
      pasivo_saldos: [
        ...h.pasivo_saldos,
        { pasivo_id: 1, fecha: '2026-10-10', capital_pendiente: D(19_250_000), naturaleza: 'informado', fuente: 'Nota de la leasera (ejemplo inventado)', carga_id: 904 },
      ],
    },
    hp: {
      contratos: [contratoEjemplo({ pagador_habitual: 'titular', reintegra_iva: false })],
      cuotas: pagadas,
      cargos: aCargos({ cargos: [{ fila: 0, fecha: '2026-03-05', concepto: 'multa', detalle: 'Multa por pago fuera de término (ejemplo)', importe: '15000', cuota_nro: 7, fuente: 'comprobante' }] }, 1, CARGA_CSV),
    },
  }
}

/**
 * Datos › Leasing con la revisión abierta (?demo=revision): la app tiene 13
 * pagadas y llega la planilla actualizada con la 14 facturada y pagada y una
 * multa. Devuelve los hechos de fondo y el texto de la planilla nueva.
 */
export function hechosEjemploRevision(): { h: Hechos; hp: HechosPasivos; csv: string } {
  const { h, hp } = hechosEjemploPasivos('cuadro')
  const cuotas = aCuotas(leerCuadroMarcha(csvDeEjemplo(13), { cuotasTotales: 35 }), 1, CARGA_CSV)
  return { h, hp: { ...hp, cuotas }, csv: csvDeEjemplo(14, true) }
}

export function ejemploPasivos(v: VariantePasivos = 'cuadro'): VistaPasivos {
  const { h, hp } = hechosEjemploPasivos(v)
  return { ...armarPasivos(h, hp, HOY_PASIVOS), aviso: v === 'sin-pasivo' ? armarPasivos(h, hp, HOY_PASIVOS).aviso : null }
}
