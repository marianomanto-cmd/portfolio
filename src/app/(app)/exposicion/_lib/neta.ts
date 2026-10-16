// "Exposición neta al peso · 12 meses" (handoff, captura 05): el neto en pesos
// (pesos financieros − deuda en pesos) en cada fecha de carga del último año,
// como un área bajo una línea punteada de neutralidad. Funciones puras, con
// test: la ventana, la opción de ECharts (la dibuja el envoltorio compartido,
// con el tema), la tabla accesible y la nota de abajo con sus cifras trazables.
//
// Reglas: sangría si estás corto en pesos (es deuda neta), tinta si estás
// largo (son pesos); "sin dato" es un hueco, nunca 0; en el modo privado, ni el
// eje ni el tooltip ni la tabla dicen montos.

import { calc, sinDato, vista, type CalcVista } from '@/lib/domain/calc'
import { compacto, Decimal, monto } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import { colorTema, OCULTO } from '@/components/graficos/tema'
import { cifra, texto, type ParteLectura } from '@/components/pantalla/lectura'
import type { PuntoNetoExposicion } from '@/lib/vistas/contratos-exposicion'

type Opcion = Record<string, unknown>
export interface Tabla {
  columnas: string[]
  filas: string[][]
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** El mismo día de hace `n` meses (si no existe, el último del mes). */
export function mesesAntes(f: Fecha, n: number): Fecha {
  const [a, m, d] = f.split('-').map(Number)
  const total = a * 12 + (m - 1) - n
  const a2 = Math.floor(total / 12)
  const m2 = (total % 12) + 1
  const ultimo = new Date(Date.UTC(a2, m2, 0)).getUTCDate()
  return `${a2}-${String(m2).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

/** Los puntos del último año (hasta la última carga) y si la historia alcanza los 12 meses. */
export function ultimos12Meses(serie: readonly PuntoNetoExposicion[]): { puntos: PuntoNetoExposicion[]; completa: boolean } {
  const ultima = serie.at(-1)?.fecha
  if (!ultima) return { puntos: [], completa: false }
  const corte = mesesAntes(ultima, 12)
  return { puntos: serie.filter((p) => p.fecha >= corte), completa: serie[0].fecha <= corte }
}

/** El rótulo de la tarjeta: "12 meses" si la historia alcanza; si no, desde cuándo. */
export function rotuloNeta(puntos: readonly PuntoNetoExposicion[], completa: boolean): string {
  if (completa || !puntos.length) return 'Exposición neta al peso · 12 meses'
  return `Exposición neta al peso · desde el ${fechaCorta(puntos[0].fecha)}`
}

const num = (x: string | null) => (x === null ? null : Number(x))

/** La etiqueta de una fecha en el eje: "14/10" en una historia corta; el mes ("oct 26") en una de varios meses. */
function etiquetaFecha(f: Fecha, larga: boolean): string {
  const [a, m, d] = f.split('-')
  return larga ? `${MESES[Number(m) - 1]} ${a.slice(2)}` : `${d}/${m}`
}

function cifraTexto(v: string | null, m: 'ARS' | 'USD', privado: boolean): string {
  if (v === null) return 'sin dato'
  if (privado) return OCULTO
  return monto(v, m, { signo: true, decimales: 0 })
}

export function opcionNeta(puntos: readonly PuntoNetoExposicion[], o: { privado: boolean }): { opcion: Opcion; tabla: Tabla } {
  const larga = puntos.length > 1 && puntos[0].fecha < mesesAntes(puntos.at(-1)!.fecha, 3)
  const etiquetas = puntos.map((p) => etiquetaFecha(p.fecha, larga))
  const valores = puntos.map((p) => num(p.neto_ars))
  const conValor = valores.filter((x): x is number => x !== null)
  const corto = conValor.length > 0 && conValor.every((x) => x <= 0)
  const largo = conValor.every((x) => x >= 0)
  const serie = (nombre: string, data: (number | null)[], color: 'acento' | 'texto', conLinea: boolean) => ({
    name: nombre,
    type: 'line',
    data,
    showSymbol: puntos.length < 3,
    symbolSize: 6,
    connectNulls: false,
    lineStyle: { width: 2, color: colorTema(color) },
    itemStyle: { color: colorTema(color) },
    areaStyle: { color: colorTema(color, color === 'acento' ? 0.16 : 0.07) },
    ...(conLinea
      ? {
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { type: [3, 4], width: 1, color: colorTema('bordeFuerte') },
            data: [{ yAxis: 0 }],
          },
        }
      : {}),
  })
  // De un solo signo, un área; si cruza el cero, una por lado (largo en tinta, corto en sangría).
  const series =
    corto && !largo
      ? [serie('Corto en pesos', valores, 'acento', true)]
      : largo
        ? [serie('Largo en pesos', valores, 'texto', true)]
        : [
            serie('Largo en pesos', valores.map((x) => (x === null ? null : Math.max(x, 0))), 'texto', true),
            serie('Corto en pesos', valores.map((x) => (x === null ? null : Math.min(x, 0))), 'acento', false),
          ]
  const tooltip = {
    trigger: 'axis',
    formatter: (ps: { dataIndex: number }[] | { dataIndex: number }) => {
      const i = (Array.isArray(ps) ? ps[0] : ps)?.dataIndex ?? 0
      const p = puntos[i]
      if (!p) return ''
      return `${fechaCorta(p.fecha)}<br/>Neto en pesos: ${cifraTexto(p.neto_ars, 'ARS', o.privado)}<br/>En dólares: ${cifraTexto(p.neto_usd, 'USD', o.privado)}`
    },
  }
  const opcion: Opcion = {
    grid: { left: 8, right: 8, top: 12, bottom: 8 },
    tooltip,
    xAxis: {
      type: 'category',
      data: etiquetas,
      boundaryGap: false,
      axisLabel: larga ? { interval: (i: number) => i === 0 || etiquetas[i] !== etiquetas[i - 1] } : {},
      splitLine: { show: false },
    },
    // Como en el diseño: sin rótulos ni líneas en el eje vertical; la referencia es la línea punteada del cero
    // (los montos, en el tooltip, en "Ver como tabla" y en la nota de abajo, cada uno con su traza).
    yAxis: {
      type: 'value',
      axisLabel: { show: false, formatter: (v: number) => (o.privado ? '' : compacto(String(v), 'ARS')) },
      splitLine: { show: false },
    },
    series,
  }
  const tabla: Tabla = {
    columnas: ['Fecha', 'Neto en pesos', 'Neto en dólares'],
    filas: puntos.map((p) => [fechaCorta(p.fecha), cifraTexto(p.neto_ars, 'ARS', o.privado), cifraTexto(p.neto_usd, 'USD', o.privado)]),
  }
  return { opcion, tabla }
}

/** El neto de un punto con su cuenta: pesos financieros − deuda en pesos, a esa fecha. */
export function netoDe(p: PuntoNetoExposicion): CalcVista {
  const explicacion = 'Tu exposición neta al peso ese día: lo que tenías en pesos menos lo que debías en pesos. Positivo = largo en pesos.'
  const insumos = [
    { nombre: `Pesos financieros al ${fechaCorta(p.fecha)}`, valor: p.pesos_ars, unidad: 'ARS' as const },
    { nombre: `Deuda en pesos al ${fechaCorta(p.fecha)}`, valor: p.deuda_ars, unidad: 'ARS' as const },
  ]
  if (p.neto_ars === null || p.pesos_ars === null || p.deuda_ars === null) return vista(sinDato(`Al ${fechaCorta(p.fecha)} falta un dato de tus pesos o de la deuda.`, insumos, { explicacion }))
  const n = new Decimal(p.neto_ars)
  return vista(calc(n, `${monto(p.pesos_ars, 'ARS', { decimales: 2 })} − ${monto(p.deuda_ars, 'ARS', { decimales: 2 })} = ${monto(n, 'ARS', { decimales: 2, signo: true })}`, insumos, { explicacion }))
}

/** "largo $ 32.783.100" o "corto $ 1.750.000", con la cifra trazable. */
function posicion(p: PuntoNetoExposicion): ParteLectura[] {
  const c = netoDe(p)
  const v = new Decimal(c.valor as string)
  const lado = v.isZero() ? 'neutral' : v.lt(0) ? 'corto' : 'largo'
  if (lado === 'neutral') return [texto('neutral')]
  return [texto(`${lado} `), cifra(monto(v.abs(), 'ARS', { decimales: 0 }), c, `Neto en pesos al ${fechaCorta(p.fecha)}`, 'ARS')]
}

/**
 * La nota de abajo del gráfico: de dónde a dónde fue el neto, con las dos
 * cifras trazables, y qué es la línea punteada. Con un punto, que la curva
 * empieza con la próxima carga.
 */
export function notaNeta(puntos: readonly PuntoNetoExposicion[]): ParteLectura[] {
  const conValor = puntos.filter((p) => p.neto_ars !== null && p.pesos_ars !== null && p.deuda_ars !== null)
  const neutral = texto(' Línea punteada = neutral: arriba, largo en pesos; abajo, corto.')
  if (!puntos.length) return [texto('Aparece con tu primera carga.')]
  if (conValor.length === 0) return [texto('Ninguna fecha tiene el neto completo todavía: falta un dato de tus pesos o de la deuda.'), neutral]
  if (conValor.length === 1) return [texto(`Un punto, el ${fechaCorta(conValor[0].fecha)}: la curva empieza con tu próxima carga.`), neutral]
  const a = conValor[0]
  const b = conValor.at(-1)!
  return [texto(`Del ${fechaCorta(a.fecha)} al ${fechaCorta(b.fecha)}: de `), ...posicion(a), texto(' a '), ...posicion(b), texto('.'), neutral]
}
