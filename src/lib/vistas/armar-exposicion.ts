// Lo que suma la pantalla Exposición del rediseño (15/10, D-158) a la vista
// del motor (armarExposicion, en ./armar): cada barra del gráfico "Largo y
// corto" partida por activo, la serie del neto también en dólares y quiénes
// son las posiciones más grandes. Función pura: se testea sin base. No calcula
// nada nuevo: agrupa las partidas de la foto (cada una con su traza) y pasa el
// neto de cada día a dólares al CCL de ese día, con la misma fórmula que el
// motor usa para el de hoy.

import { vista, type Calc } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import { cclA, financieros, foto, indexar, sumaCalc, type ItemFoto } from '@/lib/domain/foto'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import { armarExposicion, fechasDeCarga } from './armar'
import type { Par } from './contratos'
import type { PuntoNetoExposicion, TramoExposicion, VistaExposicionPantalla } from './contratos-exposicion'

type Modo = 'financiero' | 'total'

const par = (ars: Calc, usd: Calc): Par => ({ ars: vista(ars), usd: vista(usd) })

/** De mayor a menor por su valor en pesos; lo que no tiene valor, al final. */
function porValor(a: ItemFoto, b: ItemFoto): number {
  const va = a.valor_ars.valor
  const vb = b.valor_ars.valor
  if (va === null && vb === null) return 0
  if (va === null) return 1
  if (vb === null) return -1
  return vb.abs().cmp(va.abs())
}

function tramoDe(i: ItemFoto, etiqueta: string): TramoExposicion {
  return { clave: i.clave, etiqueta, nombre: i.nombre, color: i.color, valor: par(i.valor_ars, i.valor_usd) }
}

/** La liquidez de una moneda, junta en un tramo ("LIQ"): la suma de cada saldo, con su traza. */
function liquidez(saldos: ItemFoto[], moneda: 'ARS' | 'USD'): TramoExposicion | null {
  if (!saldos.length) return null
  const nombre = moneda === 'ARS' ? 'Liquidez en pesos' : 'Liquidez en dólares'
  const explicacion = moneda === 'ARS' ? 'Los pesos de tus cuentas, sumados.' : 'Los dólares de tus cuentas, sumados.'
  const ars = sumaCalc(saldos.map((s) => ({ nombre: s.nombre, calc: s.valor_ars })), 'ARS', `${explicacion} En pesos.`)
  const usd = sumaCalc(saldos.map((s) => ({ nombre: s.nombre, calc: s.valor_usd })), 'USD', `${explicacion} En dólares al CCL de la carga.`)
  return { clave: `liq:${moneda}`, etiqueta: moneda === 'ARS' ? 'LIQ' : 'LIQ US$', nombre, color: saldos[0].color, valor: par(ars, usd) }
}

/** Los tramos de una barra: cada título por su ticker y la liquidez junta, de mayor a menor. */
function tramosDe(items: ItemFoto[], moneda: 'ARS' | 'USD'): TramoExposicion[] {
  const titulos = items.filter((i) => i.clase === 'posicion').sort(porValor)
  const liq = liquidez(
    items.filter((i) => i.clase === 'saldo'),
    moneda,
  )
  const out = titulos.map((i) => tramoDe(i, i.ticker))
  if (liq) out.push(liq)
  return out
}

/** El nombre corto de una deuda para adentro de su tramo: la primera palabra ("Leasing de la camioneta" → "Leasing"). */
export function etiquetaDeuda(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre
}

/** El neto de cada fecha de la serie del motor, también en dólares al CCL de esa fecha (la misma cuenta que el neto de hoy). */
export function serieNeta(h: Hechos, v: Pick<VistaExposicionPantalla, 'serie'>): PuntoNetoExposicion[] {
  const ix = indexar(h)
  return v.serie.map((p) => {
    const ccl = cclA(ix, p.fecha).calc.valor
    const neto = p.neto_ars === null ? null : new Decimal(p.neto_ars)
    return {
      fecha: p.fecha,
      neto_ars: p.neto_ars,
      neto_usd: neto === null || ccl === null || ccl.isZero() ? null : neto.div(ccl).toFixed(),
      pesos_ars: p.activos_ars,
      deuda_ars: p.deuda_ars,
      ccl: ccl === null ? null : ccl.toFixed(),
    }
  })
}

/** Lo que pesa más en el financiero, en el orden de la concentración (D-03): el ticker de un título, el nombre de un saldo. */
function mayores(items: ItemFoto[]): string[] {
  return items
    .filter((i) => i.valor_ars.valor !== null)
    .sort((a, b) => (b.valor_ars.valor as Decimal).cmp(a.valor_ars.valor as Decimal))
    .slice(0, 3)
    .map((i) => (i.clase === 'posicion' ? i.ticker : i.nombre))
}

export function armarExposicionPantalla(h: Hechos, hoy: Fecha, modo: Modo): VistaExposicionPantalla {
  const v = armarExposicion(h, hoy, modo)
  const d1 = fechasDeCarga(h).at(-1) ?? null
  const vacio = { pesos: [], deudas: [], dolares: [], bienes: [] }
  if (!d1) return { ...v, tramos: vacio, serie_neto: [], mayores: [] }
  const f = foto(h, d1, { hoy, ix: indexar(h) })
  const fin = financieros(f)
  const bienes = modo === 'total' ? f.items.filter((i) => i.clase === 'bien') : []
  // Las deudas cuentan en las dos vistas (el neto es pesos − deuda en pesos). Van con su signo, negativo, y su traza tal cual.
  const deudas = f.items.filter((i) => i.clase === 'pasivo' && i.moneda_riesgo === 'ARS').map((i) => tramoDe(i, etiquetaDeuda(i.nombre)))
  return {
    ...v,
    tramos: {
      pesos: tramosDe(
        fin.filter((i) => i.moneda_riesgo === 'ARS'),
        'ARS',
      ),
      deudas,
      dolares: tramosDe(
        fin.filter((i) => i.moneda_riesgo === 'USD'),
        'USD',
      ),
      bienes: bienes.sort(porValor).map((i) => tramoDe(i, i.nombre)),
    },
    serie_neto: serieNeta(h, v),
    mayores: mayores(fin),
  }
}
