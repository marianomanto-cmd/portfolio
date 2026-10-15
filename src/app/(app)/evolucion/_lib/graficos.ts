// Las opciones de ECharts de Evolución (plan §4 B.5), en funciones puras con
// test. El envoltorio compartido (src/components/graficos/grafico.tsx) les pone
// el tema, el tooltip confinado, la leyenda abajo en el teléfono y la tabla
// accesible. Acá: qué se dibuja. Los números ya vienen calculados en la vista
// (texto decimal); acá solo se pasan a número para dibujar.
//
// Reglas: sin tortas; verde y rojo solo para resultados; null donde hay
// "sin dato" (nunca 0); en modo privado, los ejes, el tooltip y la tabla no
// muestran montos.

import { compacto, monto } from '@/lib/domain/dinero'
import { colorTema } from '@/components/graficos/tema'
import type { Moneda } from '@/lib/domain/tipos'
import type { Par } from '@/lib/vistas/contratos'
import type { ContribuyenteVista, FuturoVista, LineaPuenteVista, MesVista, PuntoSerieVista } from '@/lib/vistas/contratos-evolucion'

type Opcion = Record<string, unknown>
export interface Tabla {
  columnas: string[]
  filas: string[][]
}
export interface Colores {
  positivo: string
  negativo: string
  neutro: string
  tenue: string
  acento: string
}
// Los del tema claro (D-157), para el servidor y los tests: en el navegador, los del tema vigente (salvo neutro, que anda en los dos).
export const COLORES_CLAROS: Colores = { positivo: '#0e7340', negativo: '#b8183d', neutro: '#8C8696', tenue: '#635a4b', acento: '#c8193f' }

const OCULTO = '•••'
const k = (m: Moneda) => (m === 'ARS' ? 'ars' : 'usd')
const num = (x: string | null): number | null => (x === null ? null : Number(x))
const enPar = (p: Par, m: Moneda) => p[k(m)].valor

/** Una cifra para la tabla accesible o el tooltip: con su moneda, o "sin dato"; oculta en modo privado. */
export function cifraTexto(v: string | null, m: Moneda, privado: boolean, signo = false): string {
  if (v === null) return 'sin dato'
  if (privado) return OCULTO
  return monto(v, m, { signo, decimales: m === 'ARS' ? 0 : 2 })
}

const etiquetaEje = (m: Moneda, privado: boolean) => ({
  formatter: (v: number) => (privado ? '' : compacto(String(v), m)),
})

/** Rótulos cortos del eje: siete u ocho barras tienen que entrar en el ancho de una tarjeta. */
const NOMBRE_CORTO: Record<string, string> = {
  inicial: 'Inicio',
  aportes: 'Aportes',
  cuotas: 'Cuotas',
  amortizacion: 'Amortiz.',
  activo: 'Activos',
  tc: 'Dólar',
  sin_atribuir: 'Sin atrib.',
  final: 'Final',
}

const ES_RESULTADO = new Set(['activo', 'tc', 'sin_atribuir'])

/** Un monto corto para la etiqueta de una barra ("+$ 2,5 M"); oculto en modo privado. */
function etiquetaBarra(v: number | null, m: Moneda, privado: boolean): string {
  if (v === null) return 'sin dato'
  if (privado) return ''
  const t = compacto(String(v), m)
  return v > 0 ? `+${t}` : t
}

/**
 * Cascada del puente (plan §4 B.5, visión 4.7): una cascada de deltas. Cada
 * línea es un escalón (base transparente y el tramo a la vista) y la última
 * barra es el cambio total; el inicio y el final van escritos en la lista de
 * abajo, no como barras (una barra de cien millones aplasta escalones de un
 * millón). Una línea "sin dato" no tiene barra y corta la cascada desde ahí
 * (no se inventa el escalón). Verde y rojo solo para resultados.
 */
/** Las líneas que son escalones de la cascada, en su orden: el índice de una barra es su posición acá (la última barra es el cambio total). */
export function deltasPuente(lineas: LineaPuenteVista[]): LineaPuenteVista[] {
  return lineas.filter((l) => !l.informativa && l.clave !== 'inicial' && l.clave !== 'final')
}

/**
 * Al tocar "por tus activos" o "por el dólar" en la cascada (visión 4.7): las
 * tres partidas que más sumaron y las dos que más restaron en esa parte, en la
 * moneda del gráfico. Solo ordena lo que ya viene calculado.
 */
export function quienesDe(cs: ContribuyenteVista[], parte: 'activo' | 'tc', m: Moneda): { suman: ContribuyenteVista[]; restan: ContribuyenteVista[] } {
  const v = (x: ContribuyenteVista) => num(enPar(x[parte], m))
  const conValor = cs.filter((x) => v(x) !== null)
  const suman = conValor.filter((x) => (v(x) as number) > 0).sort((a, b) => (v(b) as number) - (v(a) as number)).slice(0, 3)
  const restan = conValor.filter((x) => (v(x) as number) < 0).sort((a, b) => (v(a) as number) - (v(b) as number)).slice(0, 2)
  return { suman, restan }
}

export function opcionPuente(lineas: LineaPuenteVista[], m: Moneda, privado: boolean, c: Colores = COLORES_CLAROS): { opcion: Opcion; tabla: Tabla } {
  const deltas = deltasPuente(lineas)
  const nombres = [...deltas.map((l) => NOMBRE_CORTO[l.clave] ?? l.nombre), 'Cambio']
  const base: (number | null)[] = []
  const tramo: { value: number | null; itemStyle: { color: string } }[] = []
  const conSigno: (number | null)[] = []
  let corrido: number | null = 0
  for (const l of deltas) {
    const v = num(l.valor[k(m)].valor)
    if (v === null || corrido === null) {
      base.push(null)
      tramo.push({ value: null, itemStyle: { color: c.neutro } })
      conSigno.push(null)
      corrido = null
      continue
    }
    base.push(Math.min(corrido, corrido + v))
    tramo.push({ value: Math.abs(v), itemStyle: { color: ES_RESULTADO.has(l.clave) ? (v < 0 ? c.negativo : c.positivo) : c.tenue } })
    conSigno.push(v)
    corrido += v
  }
  // El cambio total, desde cero: es lo que el cuadre verifica contra final − inicial.
  base.push(corrido === null ? null : Math.min(0, corrido))
  tramo.push({ value: corrido === null ? null : Math.abs(corrido), itemStyle: { color: c.neutro } })
  conSigno.push(corrido)
  const opcion: Opcion = {
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: nombres, axisLabel: { interval: 0, hideOverlap: false, fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: etiquetaEje(m, privado) },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (ps: { dataIndex: number }[]) => {
        const i = ps[0]?.dataIndex ?? 0
        const nombre = i < deltas.length ? deltas[i].nombre : 'Cambio del período (final − inicial)'
        return `${nombre}: ${conSigno[i] === null ? 'sin dato' : cifraTexto(String(conSigno[i]), m, privado, true)}`
      },
    },
    series: [
      { type: 'bar', name: 'base', stack: 'puente', stackStrategy: 'all', silent: true, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, data: base },
      {
        type: 'bar',
        name: m === 'ARS' ? 'En pesos' : 'En dólares',
        stack: 'puente',
        stackStrategy: 'all',
        barMaxWidth: 48,
        label: { show: !privado, position: 'top', fontSize: 10, formatter: (p: { dataIndex: number }) => etiquetaBarra(conSigno[p.dataIndex] ?? null, m, privado) },
        data: tramo,
      },
    ],
  }
  const tabla: Tabla = {
    columnas: ['Línea', m === 'ARS' ? 'En pesos' : 'En dólares'],
    filas: lineas.map((l) => [l.nombre, cifraTexto(l.valor[k(m)].valor, m, privado, l.clave !== 'inicial' && l.clave !== 'final')]),
  }
  return { opcion, tabla }
}

/**
 * Quién sumó y quién restó: barras horizontales divergentes por partida,
 * partidas en "por el precio" (sólido) y "por el dólar" (rayado), en la moneda
 * elegida. En el teléfono, las `limite` de mayor resultado absoluto.
 */
/** Las partidas en el orden en que las dibuja el gráfico (la de más peso arriba): el índice de una barra es su posición acá. */
export function barrasContribuyentes(cs: ContribuyenteVista[], limite: number | null): ContribuyenteVista[] {
  return (limite ? cs.slice(0, limite) : cs).slice().reverse() // ECharts dibuja la primera categoría abajo
}

export function opcionContribuyentes(cs: ContribuyenteVista[], m: Moneda, privado: boolean, limite: number | null, c: Colores = COLORES_CLAROS): { opcion: Opcion; tabla: Tabla } {
  const lista = barrasContribuyentes(cs, limite)
  // El mismo ticker en dos cuentas (los pesos de IEB y los de Mercado Pago) se distingue por la cuenta.
  const repetidos = new Set(cs.map((x) => x.ticker).filter((t, i, todos) => todos.indexOf(t) !== i))
  const nombres = lista.map((x) => (repetidos.has(x.ticker) && x.cuenta ? `${x.ticker} · ${x.cuenta}` : x.ticker))
  const opcion: Opcion = {
    aria: { enabled: true, decal: { show: true } },
    grid: { left: 8, right: 16, top: 24, containLabel: true },
    legend: { top: 0, data: ['Por el precio', 'Por el dólar'] },
    xAxis: { type: 'value', axisLabel: etiquetaEje(m, privado) },
    yAxis: { type: 'category', data: nombres, axisLabel: { fontSize: 11 } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (ps: { dataIndex: number }[]) => {
        const x = lista[ps[0]?.dataIndex ?? 0]
        return `${x.nombre}<br/>Por el precio: ${cifraTexto(enPar(x.activo, m), m, privado, true)}<br/>Por el dólar: ${cifraTexto(enPar(x.tc, m), m, privado, true)}`
      },
    },
    series: [
      {
        type: 'bar',
        name: 'Por el precio',
        stack: 'quien',
        barMaxWidth: 22,
        itemStyle: { decal: { symbol: 'none' } },
        data: lista.map((x) => ({ value: num(enPar(x.activo, m)), itemStyle: { color: x.color } })),
      },
      {
        type: 'bar',
        name: 'Por el dólar',
        stack: 'quien',
        barMaxWidth: 22,
        itemStyle: { color: colorTema('viz'), decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: Math.PI / 4, color: 'rgba(255,255,255,0.55)' } },
        data: lista.map((x) => ({ value: num(enPar(x.tc, m)), itemStyle: { color: colorTema('viz') } })),
      },
    ],
  }
  const tabla: Tabla = {
    columnas: ['Partida', 'Resultado', 'Por el precio', 'Por el dólar'],
    filas: cs.map((x) => [x.nombre, cifraTexto(enPar(x.resultado, m), m, privado, true), cifraTexto(enPar(x.activo, m), m, privado, true), cifraTexto(enPar(x.tc, m), m, privado, true)]),
  }
  return { opcion, tabla }
}

const corta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
const DIA_MS = 86_400_000
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** El último día del mes de una fecha "AAAA-MM-01" (el cierre de un mes proyectado). */
export function finDeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return `${mes.slice(0, 7)}-${String(d).padStart(2, '0')}`
}

/** Las etiquetas del eje de tiempo: día y mes si el gráfico abarca pocos meses; mes y año si no. */
export function etiquetaFecha(t: number, largo: boolean): string {
  const d = new Date(t)
  return largo ? `${MESES[d.getMonth()]}-${String(d.getFullYear()).slice(2)}` : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Patrimonio y capital aportado en un eje de tiempo de verdad (lo que queda
 * entre las dos líneas es lo ganado o perdido). Las cargas son días y la
 * proyección son meses: en un eje de categorías doce meses ocuparían lo mismo
 * que doce días y la pendiente del escenario mentiría. Con un escenario, desde
 * hoy el fondo es gris y el patrimonio sigue punteado con su camino (cada mes,
 * a su cierre). Un día con algún precio viejo (CO-5) es un punto hueco.
 */
export function opcionPatrimonio(
  serie: PuntoSerieVista[],
  aportado: PuntoSerieVista[],
  futuro: FuturoVista | null,
  m: Moneda,
  privado: boolean,
  c: Colores = COLORES_CLAROS,
): { opcion: Opcion; tabla: Tabla } {
  const meses = futuro?.estado === 'lista' ? futuro.meses : []
  const real = serie.map((p) => {
    const x: [string, number | null] = [p.fecha, num(p[k(m)])]
    return p.viejo && x[1] !== null ? { value: x, symbol: 'emptyCircle', symbolSize: 7 } : x
  })
  const cap = aportado.map((p): [string, number | null] => [p.fecha, num(p[k(m)])])
  const ultimo = serie.at(-1)
  const esc: [string, number | null][] =
    meses.length && ultimo ? [[ultimo.fecha, num(ultimo[k(m)])], ...meses.map((x): [string, number | null] => [finDeMes(x.mes), num(enPar(x.financiero, m))])] : []
  const desde = serie[0]?.fecha
  const hasta = esc.at(-1)?.[0] ?? ultimo?.fecha
  const largo = Boolean(desde && hasta && (Date.parse(hasta) - Date.parse(desde)) / 86_400_000 > 120)
  const nombreDe = new Map<string, string>([...serie.map((p): [string, string] => [p.fecha, corta(p.fecha)]), ...meses.map((x): [string, string] => [finDeMes(x.mes), `${x.nombre} (cierre, supuesto)`])])
  const viejoEn = new Set(serie.filter((p) => p.viejo).map((p) => p.fecha))
  const series: Opcion[] = [
    { type: 'line', name: 'Tu patrimonio', data: real, connectNulls: false, symbol: serie.length === 1 ? 'circle' : 'none', symbolSize: 8, lineStyle: { width: 2.5, color: colorTema('texto') }, itemStyle: { color: colorTema('texto') } },
    { type: 'line', name: 'Capital aportado', data: cap, connectNulls: false, symbol: serie.length === 1 ? 'diamond' : 'none', symbolSize: 8, lineStyle: { width: 1.5, type: 'dashed', color: c.tenue }, itemStyle: { color: c.tenue } },
  ]
  if (esc.length) {
    series.push({
      type: 'line',
      name: `Escenario: ${futuro!.escenario.nombre}`,
      data: esc,
      connectNulls: false,
      symbol: 'none',
      lineStyle: { width: 2, type: 'dotted', color: colorTema('texto') },
      itemStyle: { color: colorTema('texto') },
      markArea: { silent: true, itemStyle: { color: colorTema('texto', 0.04) }, data: [[{ xAxis: esc[0][0] }, { xAxis: esc.at(-1)![0] }]] },
    })
  }
  const opcion: Opcion = {
    // La leyenda puede ocupar dos líneas en un gráfico angosto (tres con el escenario): el área del gráfico baja para no pisar el eje.
    grid: { left: 8, right: 16, top: esc.length ? 64 : 48, containLabel: true },
    legend: { top: 0 },
    xAxis: {
      type: 'time',
      // Nunca marcas de horas: las cargas son por día. Con un solo punto, una semana alrededor (si no, el eje repetía el mismo día).
      minInterval: DIA_MS,
      ...(esc.length === 0 && serie.length === 1 ? { min: Date.parse(serie[0].fecha) - 3 * DIA_MS, max: Date.parse(serie[0].fecha) + 3 * DIA_MS } : {}),
      axisLabel: { hideOverlap: true, formatter: (t: number) => etiquetaFecha(t, largo) },
      splitLine: { show: false },
    },
    yAxis: { type: 'value', scale: true, axisLabel: etiquetaEje(m, privado) },
    tooltip: {
      trigger: 'axis',
      formatter: (ps: { seriesName: string; value: [string, number | null] | { value: [string, number | null] } }[]) => {
        const par = (p: (typeof ps)[number]) => (Array.isArray(p.value) ? p.value : p.value.value)
        const fecha = ps[0] ? par(ps[0])[0] : ''
        const titulo = `${nombreDe.get(fecha) ?? corta(fecha)}${viejoEn.has(fecha) ? ' · con algún precio viejo' : ''}`
        return [titulo, ...ps.filter((p) => par(p)[1] !== null && par(p)[1] !== undefined).map((p) => `${p.seriesName}: ${cifraTexto(String(par(p)[1]), m, privado)}`)].join('<br/>')
      },
    },
    series,
  }
  const tabla: Tabla = {
    columnas: ['Fecha', 'Tu patrimonio', 'Capital aportado', ...(meses.length ? ['Escenario (supuesto)'] : [])],
    filas: [
      ...serie.map((p, i) => [corta(p.fecha), cifraTexto(p[k(m)], m, privado), cifraTexto(aportado[i]?.[k(m)] ?? null, m, privado), ...(meses.length ? ['—'] : [])]),
      ...meses.map((x) => [x.nombre, '—', '—', cifraTexto(enPar(x.financiero, m), m, privado)]),
    ],
  }
  return { opcion, tabla }
}

/** El índice 100 de una serie: cada punto ÷ el primero con dato × 100 (null donde no hay dato). */
export function indice100(xs: (string | null)[]): (number | null)[] {
  const base = xs.find((x) => x !== null)
  if (base === undefined || base === null || Number(base) === 0) return xs.map(() => null)
  return xs.map((x) => (x === null ? null : (Number(x) / Number(base)) * 100))
}

/**
 * Pesos y dólares en el mismo eje (plan §4 B.1, bloque 5): las dos monedas solo
 * se comparan indexadas a 100 en el día cero (§8). No muestra montos: en modo
 * privado no hay nada que tapar.
 */
export function opcionIndice(serie: PuntoSerieVista[], c: Colores = COLORES_CLAROS): { opcion: Opcion; tabla: Tabla } {
  const ars = indice100(serie.map((p) => p.ars))
  const usd = indice100(serie.map((p) => p.usd))
  const fmt = (x: number | null) => (x === null ? 'sin dato' : x.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
  const desde = serie[0]?.fecha
  const hasta = serie.at(-1)?.fecha
  const largo = Boolean(desde && hasta && (Date.parse(hasta) - Date.parse(desde)) / DIA_MS > 120)
  const opcion: Opcion = {
    grid: { left: 8, right: 16, top: 32, containLabel: true },
    legend: { top: 0 },
    xAxis: { type: 'time', minInterval: DIA_MS, axisLabel: { hideOverlap: true, formatter: (t: number) => etiquetaFecha(t, largo) }, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, axisLabel: { formatter: (x: number) => fmt(x) } },
    tooltip: {
      trigger: 'axis',
      formatter: (ps: { seriesName: string; value: [string, number | null] }[]) =>
        [corta(ps[0]?.value[0] ?? ''), ...ps.map((p) => `${p.seriesName}: ${fmt(p.value[1])}`)].join('<br/>'),
    },
    series: [
      { type: 'line', name: 'En pesos', data: serie.map((p, i) => [p.fecha, ars[i]]), connectNulls: false, symbol: 'none', lineStyle: { width: 2.5, color: colorTema('texto') }, itemStyle: { color: colorTema('texto') } },
      { type: 'line', name: 'En dólares', data: serie.map((p, i) => [p.fecha, usd[i]]), connectNulls: false, symbol: 'none', lineStyle: { width: 2.5, color: colorTema('viz') }, itemStyle: { color: colorTema('viz') } },
    ],
  }
  const tabla: Tabla = { columnas: ['Fecha', 'En pesos (índice)', 'En dólares (índice)'], filas: serie.map((p, i) => [corta(p.fecha), fmt(ars[i]), fmt(usd[i])]) }
  return { opcion, tabla }
}

const SERIES_MES: { clave: string; nombre: string; color: (c: Colores) => string }[] = [
  { clave: 'aportes', nombre: 'Aportes', color: (c) => c.neutro },
  { clave: 'cuotas', nombre: 'Cuotas', color: () => colorTema('acento') },
  { clave: 'activo', nombre: 'Activos', color: () => colorTema('texto') },
  { clave: 'tc', nombre: 'Dólar', color: () => colorTema('viz') },
  { clave: 'sin_atribuir', nombre: 'Sin atrib.', color: () => colorTema('faint') },
]

/** PnL por mes: barras apiladas por línea del puente, lo positivo arriba y lo negativo abajo. */
export function opcionMeses(meses: MesVista[], m: Moneda, privado: boolean, c: Colores = COLORES_CLAROS): { opcion: Opcion; tabla: Tabla } {
  const valor = (x: MesVista, clave: string) => x.lineas.find((l) => l.clave === clave)?.valor[k(m)].valor ?? null
  const presentes = SERIES_MES.filter((s) => meses.some((x) => x.lineas.some((l) => l.clave === s.clave)))
  const opcion: Opcion = {
    grid: { left: 8, right: 8, top: 32, containLabel: true },
    legend: { top: 0 },
    xAxis: { type: 'category', data: meses.map((x) => x.nombre) },
    yAxis: { type: 'value', axisLabel: etiquetaEje(m, privado) },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (ps: { seriesName: string; dataIndex: number; value: number | null }[]) =>
        [meses[ps[0]?.dataIndex ?? 0]?.nombre ?? '', ...ps.map((p) => `${p.seriesName}: ${p.value === null || p.value === undefined ? 'sin dato' : cifraTexto(String(p.value), m, privado, true)}`)].join('<br/>'),
    },
    series: presentes.map((s) => ({ type: 'bar', name: s.nombre, stack: 'mes', barMaxWidth: 40, itemStyle: { color: s.color(c) }, data: meses.map((x) => num(valor(x, s.clave))) })),
  }
  const tabla: Tabla = {
    columnas: ['Mes', ...presentes.map((s) => s.nombre)],
    filas: meses.map((x) => [`${x.nombre}${x.parcial ? ` (${x.parcial})` : ''}`, ...presentes.map((s) => cifraTexto(valor(x, s.clave), m, privado, true))]),
  }
  return { opcion, tabla }
}
