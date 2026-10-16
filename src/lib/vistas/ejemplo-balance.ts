// Exposición y su balance en modo demo (PORTFOLIO_DEMO=1), con los hechos
// inventados del Apéndice B de docs/vision.md (D-24), por los mismos armadores
// que usa la app. Desde el rediseño (D-156) el Balance vive en /exposicion: los
// dos salen de los mismos hechos, así el neto de arriba y el balance de abajo
// usan la misma deuda. Cada estado (?demo=…) cambia lo mínimo de esos hechos
// para mostrar un caso:
//
// - (ninguno) · estimada: la deuda del leasing es un estimado que aprobaste,
//   como hoy en producción. La cifra grande es "Patrimonio neto · deuda del
//   leasing estimada" y debajo, firme, "sin la camioneta".
// - un-dia: lo mismo con una sola carga (el día cero): la evolución es un punto.
// - completo: la leasera informó el valor de cancelación; con el cuadro de
//   marcha cargado, "lo que falta pagar según contrato" al lado.
// - segun-cuadro: la deuda sale del cuadro de marcha (Pasivos), a la tasa del contrato.
// - sin-deuda: ni informada, ni según cuadro, ni estimada: "sin la camioneta".
// - sin-valuacion: la casa sin valuación: sale de lo firme y se nombra.
// - sin-bienes: todavía no cargaste la casa ni la camioneta.
// - viejo: abrís la app el mié 21/10 sin cargar desde el 14/10.
// - vacio: ninguna carga.

import { calc, type DobleCalc } from '@/lib/domain/calc'
import { Decimal, monto, numero } from '@/lib/domain/dinero'
import { cclA, indexar } from '@/lib/domain/foto'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import { armarBalance, type ExtrasBalance, type PedidoBalance } from './armar-balance'
import { armarExposicionPantalla } from './armar-exposicion'
import type { VistaBalance } from './contratos-balance'
import type { VistaExposicionPantalla } from './contratos-exposicion'
import { HOY_EJEMPLO, hechosEjemplo, hechosVacios } from './ejemplo'

export const VARIANTES_BALANCE = ['estimada', 'un-dia', 'completo', 'segun-cuadro', 'sin-deuda', 'sin-valuacion', 'sin-bienes', 'viejo', 'vacio'] as const
export type VarianteBalance = (typeof VARIANTES_BALANCE)[number]

export function varianteBalance(v: unknown): VarianteBalance {
  return VARIANTES_BALANCE.includes(v as VarianteBalance) ? (v as VarianteBalance) : 'estimada'
}

const D = (x: string | number) => new Decimal(x)

/** La deuda estimada del ejemplo (inventada): la misma del Apéndice B, como estimado del 08/10. */
function conDeudaEstimada(h: Hechos): Hechos {
  return {
    ...h,
    pasivo_saldos: [
      {
        pasivo_id: 1,
        fecha: '2026-10-08',
        capital_pendiente: D(21_400_000),
        naturaleza: 'estimado',
        // Como en producción, la fuente puede traer montos (la cuenta del estimado): el modo privado los tapa.
        fuente: 'ESTIMADO, provisorio: el capital financiado ($ 30.000.000) menos lo amortizado hasta septiembre (ejemplo inventado)',
        carga_id: 25,
      },
    ],
  }
}

function soloElDiaCero(h: Hechos): Hechos {
  const dia: Fecha = '2026-10-14'
  return {
    ...h,
    tipos_cambio: h.tipos_cambio.filter((t) => t.fecha === dia),
    cotizaciones: h.cotizaciones.filter((c) => c.fecha === dia),
    saldos: h.saldos.filter((s) => s.fecha === dia),
    operaciones: h.operaciones.map((o) => ({ ...o, fecha: dia, tipo: o.tipo === 'compra' ? 'apertura' : o.tipo })),
    cargas: h.cargas.filter((c) => c.fecha === dia),
  }
}

/**
 * La deuda según el cuadro de marcha (Pasivos, en la integración): acá, la
 * cuenta de un contrato inventado, hecha de verdad para que la fórmula diga lo
 * que vale: el valor presente de 34 cánones netos vencidos de $ 1.000.000 y de
 * la opción de compra de $ 3.800.000, a la TEA de 50,72% (TEM = 1,5072^(1/12) − 1).
 */
function segunCuadroEjemplo(h: Hechos): ExtrasBalance['segunCuadro'] {
  const ix = indexar(h)
  const tem = D('1.5072').pow(D(1).div(12)).minus(1)
  const v = tem.plus(1).pow(-34)
  const vp = D(1_000_000).times(D(1).minus(v)).div(tem).plus(D(3_800_000).times(v)).toDecimalPlaces(2)
  return (fecha) => {
    const ccl = cclA(ix, fecha).calc
    const ars = vp
    const usd = ccl.valor === null ? null : ars.div(ccl.valor)
    const formula = `VP de 34 cánones netos ($ 1.000.000) y la opción de compra ($ 3.800.000), a la TEA del contrato de 50,72% (TEM ${numero(tem.times(100), 4)}%) (ejemplo inventado)`
    const m: Map<number, DobleCalc> = new Map([
      [
        1,
        {
          ars: calc(ars, `${formula} = ${monto(ars, 'ARS', { decimales: 2 })}`, [], { etiquetas: ['estimado'], explicacion: 'La deuda según el cuadro de marcha (la calcula Pasivos).' }),
          usd:
            usd === null
              ? { valor: null, motivo: 'Falta el CCL.', formula: 'sin dato', insumos: [], etiquetas: ['estimado'] }
              : calc(usd, `${monto(ars, 'ARS', { decimales: 2 })} ÷ CCL ${numero(ccl.valor as Decimal, 2)} = ${monto(usd, 'USD', { decimales: 2 })}`, [], { etiquetas: ['estimado'] }),
        },
      ],
    ])
    return m
  }
}

/** Lo que falta pagar según el contrato (Pasivos, resumenLeasing): 34 cuotas inventadas de $ 1.339.200. */
function referenciaEjemplo(h: Hechos): ExtrasBalance['referencia'] {
  const ix = indexar(h)
  return (fecha) => {
    const ccl = cclA(ix, fecha).calc
    const ars = D(1_339_200).times(34)
    const usd = ccl.valor === null ? null : ars.div(ccl.valor)
    const nota = '34 cuotas con IVA, seguro y percepción, según el cuadro de marcha; la opción de compra, aparte'
    return new Map([
      [
        1,
        {
          falta: {
            ars: calc(ars, `34 cuotas × $ 1.339.200 = ${monto(ars, 'ARS', { decimales: 2 })}`, [], { etiquetas: ['proyectado'], explicacion: 'Lo que falta pagar según el contrato, en pesos nominales. No es la deuda: incluye intereses, IVA y seguro (ejemplo inventado).' }),
            usd:
              usd === null
                ? { valor: null, motivo: 'Falta el CCL.', formula: 'sin dato', insumos: [], etiquetas: ['proyectado'] }
                : calc(usd, `${monto(ars, 'ARS', { decimales: 2 })} ÷ CCL de hoy ${numero(ccl.valor as Decimal, 2)} = ${monto(usd, 'USD', { decimales: 2 })}`, [], {
                    etiquetas: ['proyectado'],
                    explicacion: 'Al CCL de hoy: las cuotas futuras se pagan en pesos, al CCL que haya ese día.',
                  }),
          },
          cuotas: 34,
          nota,
        },
      ],
    ])
  }
}

/**
 * Los hechos de cada estado del demo, con su "hoy" y lo que aporta Pasivos. Los
 * usan el Balance y la Exposición que lo contiene (D-156): los dos muestran el
 * mismo estado, con la misma deuda.
 */
export function hechosBalance(v: VarianteBalance): { h: Hechos; hoy: Fecha; extras: ExtrasBalance } {
  const base = hechosEjemplo()
  switch (v) {
    case 'vacio':
      return { h: hechosVacios(), hoy: HOY_EJEMPLO, extras: {} }
    case 'un-dia':
      return { h: soloElDiaCero(conDeudaEstimada(base)), hoy: HOY_EJEMPLO, extras: {} }
    case 'completo': {
      const h: Hechos = {
        ...base,
        pasivo_saldos: [{ pasivo_id: 1, fecha: '2026-10-13', capital_pendiente: D(20_600_000), naturaleza: 'informado', fuente: 'la leasera, por correo (ejemplo inventado)', carga_id: 33 }],
      }
      return { h, hoy: HOY_EJEMPLO, extras: { referencia: referenciaEjemplo(h) } }
    }
    case 'segun-cuadro': {
      const h = conDeudaEstimada(base)
      const segun = segunCuadroEjemplo(h)
      // Como en producción (hechos-vista.ts): el motor también usa la deuda según el cuadro, así Exposición y el Balance dicen lo mismo.
      const conCuadro: Hechos = { ...h, deuda_segun_cuadro: (pasivo_id, fecha) => segun?.(fecha).get(pasivo_id)?.ars ?? null }
      return { h: conCuadro, hoy: HOY_EJEMPLO, extras: { segunCuadro: segun, referencia: referenciaEjemplo(h) } }
    }
    case 'sin-deuda':
      return { h: { ...base, pasivo_saldos: [] }, hoy: HOY_EJEMPLO, extras: {} }
    case 'sin-valuacion':
      return { h: { ...conDeudaEstimada(base), valuaciones: base.valuaciones.filter((x) => x.bien_id !== 1) }, hoy: HOY_EJEMPLO, extras: {} }
    case 'sin-bienes':
      return { h: { ...conDeudaEstimada(base), bienes: [], valuaciones: [] }, hoy: HOY_EJEMPLO, extras: {} }
    case 'viejo':
      return { h: conDeudaEstimada(base), hoy: '2026-10-21', extras: {} }
    case 'estimada':
    default:
      return { h: conDeudaEstimada(base), hoy: HOY_EJEMPLO, extras: {} }
  }
}

export function ejemploBalance(v: VarianteBalance, pedido: PedidoBalance = {}): VistaBalance {
  const { h, hoy, extras } = hechosBalance(v)
  return armarBalance(h, hoy, pedido, extras)
}

/** La Exposición del demo, con los mismos hechos que el Balance de ese estado (?demo=…). */
export function ejemploExposicionPantalla(modo: 'financiero' | 'total', v: VarianteBalance = 'estimada'): VistaExposicionPantalla {
  const { h, hoy } = hechosBalance(v)
  return armarExposicionPantalla(h, hoy, modo)
}
