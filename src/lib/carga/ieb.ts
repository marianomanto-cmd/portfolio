// Lector del Excel "Portafolio" de IEB (docs/carga-diaria.md; D-11, D-12, D-13,
// D-19, D-37, D-38, D-61, D-66). Determinístico, sin IA.
//
// Recorre las hojas Patrimonio y Saldos y devuelve una LecturaCuenta:
//   - una FilaLeida por posición, con su chequeo aritmético
//     (cantidad × precio × escala ≈ posición total) y la escala detectada;
//   - los saldos ARS y USD (el "Total" de Saldos, no "Hoy"; el USD suma los
//     dólares en especie de DOLARUSA);
//   - los controles: B2 contra lo leído, y cada Subtotal contra su sección;
//   - la lectura cruda de cada celda no vacía, para cargas.lectura_cruda.
//
// Números. Excel guarda dobles binarios. Cada número se lee una sola vez con
// sus 15 cifras significativas (toPrecision(15): la precisión con la que Excel
// trabaja y muestra), que recupera exacto todo decimal de hasta 15 cifras y
// descarta el ruido binario de quien generó el archivo (10118700.000000002 →
// 10118700; 0.30000000000000004 → 0.3). De ahí en más todo es Decimal: ninguna
// cuenta pasa por float (D-32). La lectura cruda guarda el doble tal cual
// (String(n), la representación más corta que lo reproduce).
//
// Tolerancias (D-37): medio último dígito mostrado de cada factor, propagado.
// Los decimales mostrados salen del formato numérico (numFmt) de la celda; con
// formato General, de los decimales del propio valor. La cantidad se toma
// exacta: es un conteo de unidades o de VN.
//
// No importa 'server-only': es puro y se usa también en los tests. Corre en
// Node (Server Action; exceljs está en serverExternalPackages).

import * as ExcelJSModulo from 'exceljs'
import type { Cell, Workbook, Worksheet } from 'exceljs'
import { Decimal, leerNumeroAR, monto, numero } from '@/lib/domain/dinero'
import { fechaEnCordoba, fechaLarga } from '@/lib/domain/fechas'
import type { Fecha, Moneda, TipoActivo } from '@/lib/domain/tipos'
import type { Chequeo, ControlLeido, EstadoFila, FilaLeida, LecturaCuenta, SaldoLeido } from './contratos'

// exceljs es CommonJS: según quién lo cargue (Node ESM, Vitest, el bundler de
// Next), las clases llegan como propiedades del módulo o de su `default`.
type ModuloExcel = typeof ExcelJSModulo
const ExcelJS: ModuloExcel = (ExcelJSModulo as unknown as { default?: ModuloExcel }).default ?? ExcelJSModulo

/** Lector y versión, para cargas.lector. Subirla si cambia lo que se lee o cómo. */
export const LECTOR_IEB = 'ieb-excel@1'

/** Error de lectura con un mensaje para mostrarle al dueño tal cual. */
export class ErrorLectorIEB extends Error {
  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones)
    this.name = 'ErrorLectorIEB'
  }
}

export type Escala = '1' | '0.01' | '0.001'
const ESCALAS: readonly Escala[] = ['1', '0.01', '0.001']

// ───────────── Lectura de celdas ─────────────

type TipoCelda = 'numero' | 'texto' | 'fecha' | 'booleano' | 'error'

interface Celda {
  ref: string
  fila: number
  col: number
  tipo: TipoCelda
  /** El doble tal como lo guarda el archivo (solo tipo 'numero'). */
  numero: number | null
  /** Texto crudo, sin recortar (tipo 'texto', 'booleano' o 'error'). */
  texto: string | null
  fecha: Date | null
  /** Formato numérico de la celda (null = General). */
  formato: string | null
  formula: string | null
}

interface Hoja {
  /** Nombre real de la hoja en el archivo, recortado. */
  nombre: string
  filas: Map<number, Map<number, Celda>>
  ultima: number
}

/** Celda tal como queda en la lectura cruda. */
export interface CeldaCruda {
  ref: string
  tipo: TipoCelda
  /** Número: el doble tal cual (String). Fecha: ISO en UTC. Texto: sin recortar. */
  valor: string
  formato: string | null
  formula?: string
}

export interface LecturaCrudaIEB {
  lector: string
  hojas: { nombre: string; celdas: CeldaCruda[] }[]
  /** Otras hojas del libro, que no se leen. */
  otras_hojas: string[]
}

function letrasColumna(col: number): string {
  let s = ''
  let n = col
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function direccion(fila: number, col: number): string {
  return `${letrasColumna(col)}${fila}`
}

type ValorCelda = Pick<Celda, 'tipo' | 'numero' | 'texto' | 'fecha' | 'formula'>

function valorDe(v: unknown): ValorCelda | null {
  const base = { numero: null, texto: null, fecha: null, formula: null }
  if (v === null || v === undefined) return null
  if (typeof v === 'number') {
    return Number.isFinite(v) ? { ...base, tipo: 'numero', numero: v } : { ...base, tipo: 'error', texto: String(v) }
  }
  if (typeof v === 'string') return v.trim() === '' ? null : { ...base, tipo: 'texto', texto: v }
  if (typeof v === 'boolean') return { ...base, tipo: 'booleano', texto: String(v) }
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? { ...base, tipo: 'error', texto: 'fecha inválida' } : { ...base, tipo: 'fecha', fecha: v }
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      const t = (o.richText as { text?: unknown }[]).map((r) => String(r.text ?? '')).join('')
      return t.trim() === '' ? null : { ...base, tipo: 'texto', texto: t }
    }
    if ('formula' in o || 'sharedFormula' in o) {
      const r = valorDe(o.result)
      const formula = String(o.formula ?? o.sharedFormula ?? '')
      return r ? { ...r, formula } : null
    }
    if ('error' in o) return { ...base, tipo: 'error', texto: String(o.error) }
    if ('text' in o) return valorDe(o.text)
  }
  return { ...base, tipo: 'texto', texto: String(v) }
}

function leerHoja(ws: Worksheet): Hoja {
  const filas = new Map<number, Map<number, Celda>>()
  let ultima = 0
  ws.eachRow({ includeEmpty: false }, (row, nFila) => {
    row.eachCell({ includeEmpty: false }, (cell: Cell, nCol: number) => {
      // En una celda combinada, solo cuenta la principal: las demás repiten su valor.
      if (cell.isMerged && cell.master && cell.master.address !== cell.address) return
      const v = valorDe(cell.value)
      if (!v) return
      const formato = typeof cell.numFmt === 'string' && cell.numFmt.trim() !== '' ? cell.numFmt : null
      let fila = filas.get(nFila)
      if (!fila) {
        fila = new Map()
        filas.set(nFila, fila)
      }
      fila.set(nCol, { ...v, ref: direccion(nFila, nCol), fila: nFila, col: nCol, formato })
      ultima = Math.max(ultima, nFila)
    })
  })
  return { nombre: ws.name.trim(), filas, ultima }
}

function crudaDe(h: Hoja): { nombre: string; celdas: CeldaCruda[] } {
  const celdas: CeldaCruda[] = []
  for (const nFila of [...h.filas.keys()].sort((a, b) => a - b)) {
    const fila = h.filas.get(nFila)!
    for (const nCol of [...fila.keys()].sort((a, b) => a - b)) {
      const c = fila.get(nCol)!
      const valor =
        c.tipo === 'numero' ? String(c.numero) : c.tipo === 'fecha' ? (c.fecha as Date).toISOString() : (c.texto ?? '')
      celdas.push({ ref: c.ref, tipo: c.tipo, valor, formato: c.formato, ...(c.formula ? { formula: c.formula } : {}) })
    }
  }
  return { nombre: h.nombre, celdas }
}

function celda(h: Hoja, fila: number, col: number | null): Celda | undefined {
  return col === null ? undefined : h.filas.get(fila)?.get(col)
}

function celdasDeFila(h: Hoja, fila: number): Celda[] {
  const f = h.filas.get(fila)
  return f ? [...f.values()].sort((a, b) => a.col - b.col) : []
}

/** Texto normalizado para comparar: sin tildes, minúsculas, espacios simples. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function textoDe(c: Celda | undefined): string | null {
  if (!c) return null
  if (c.tipo === 'texto') return (c.texto ?? '').trim()
  if (c.tipo === 'numero') return String(c.numero)
  return null
}

function esGuion(t: string): boolean {
  return /^[-–—]+$/.test(t.trim())
}

// ───────────── Números ─────────────

/** Doble de Excel → Decimal con las 15 cifras significativas de Excel. */
export function decimalDeExcel(n: number): Decimal {
  if (!Number.isFinite(n)) throw new RangeError(`Número no finito en el Excel: ${n}`)
  const d = new Decimal(n.toPrecision(15))
  return d.isZero() ? new Decimal(0) : d
}

/**
 * Decimales que muestra un formato numérico de Excel ("#,##0.00" → 2,
 * "#,##0" → 0, "0.00%" → 4 sobre el valor). Con formato General (null) o
 * científico, los decimales del propio valor.
 */
export function decimalesMostrados(formato: string | null, valor: Decimal): number {
  const propios = Math.min(valor.decimalPlaces(), 15)
  if (formato === null || /^\s*general\s*$/i.test(formato)) return propios
  let f = formato.split(';')[0]
  f = f
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '')
    .replace(/[_*]./g, '')
  if (/e[+-]/i.test(f)) return propios
  if (!/[0#?]/.test(f)) return propios
  const m = f.match(/\.([0#?]+)/)
  let d = m ? m[1].length : 0
  if (f.includes('%')) d += 2
  return d
}

/** Medio último dígito: 2 decimales → 0,005. */
function medioDigito(decimales: number): Decimal {
  return new Decimal(5).times(new Decimal(10).pow(-(decimales + 1)))
}

type Num =
  | { k: 'n'; v: Decimal; dec: number; ref: string; deTexto: boolean }
  | { k: 'guion'; ref: string }
  | { k: 'vacio'; ref: string }
  | { k: 'otro'; ref: string; texto: string }

function numDe(h: Hoja, fila: number, col: number | null): Num {
  const ref = col === null ? `fila ${fila}` : direccion(fila, col)
  const c = celda(h, fila, col)
  if (!c) return { k: 'vacio', ref }
  if (c.tipo === 'numero') {
    const v = decimalDeExcel(c.numero as number)
    return { k: 'n', v, dec: decimalesMostrados(c.formato, v), ref, deTexto: false }
  }
  if (c.tipo === 'texto') {
    const t = (c.texto ?? '').trim()
    if (esGuion(t)) return { k: 'guion', ref }
    const leido = leerNumeroAR(t)
    if (leido !== null) {
      // Decimales tal como están escritos ("112,40" → 2), con la regla de leerNumeroAR.
      const coma = t.lastIndexOf(',')
      const dec = coma >= 0 ? t.slice(coma + 1).replace(/\D/g, '').length : (/\.(\d{1,2})$/.exec(t)?.[1].length ?? 0)
      return { k: 'n', v: new Decimal(leido), dec, ref, deTexto: true }
    }
    return { k: 'otro', ref, texto: t }
  }
  if (c.tipo === 'fecha') return { k: 'otro', ref, texto: (c.fecha as Date).toISOString() }
  return { k: 'otro', ref, texto: c.texto ?? '' }
}

const valorNum = (n: Num): Decimal | null => (n.k === 'n' ? n.v : null)

// ───────────── Formato para los mensajes (es-AR) ─────────────

const fCant = (d: Decimal) => numero(d, 6, { min: 0 })
const fPrecio = (d: Decimal) => numero(d, 6, { min: 2 })
const fPesos = (d: Decimal) => monto(d, 'ARS', { decimales: 2 })
/** Tolerancia en pesos, redondeada hacia arriba al centavo: nunca se muestra menor que la usada (±575,005 → ±$ 575,01). */
const fTol = (d: Decimal) => monto(d.toDecimalPlaces(2, Decimal.ROUND_UP), 'ARS', { decimales: 2 })

function textoEscala(e: Escala): string {
  return e === '1' ? '' : e === '0.01' ? ' ÷ 100' : ' ÷ 1.000'
}

// ───────────── Escala y chequeo (D-12, D-37) ─────────────

export interface ResultadoEscala {
  /** null: ninguna escala cierra la cuenta. */
  escala: Escala | null
  /** La escala con la que se armó el chequeo: la elegida o, si ninguna cierra, la que más se acerca. */
  probada: Escala
  /** El chequeo con la escala probada. */
  chequeo: Chequeo
  /** Más de una escala cierra (cantidad o precio muy chicos): se eligió la preferida. */
  ambigua: boolean
}

/**
 * Detecta la escala del precio (×1, ÷100, ÷1000) comparando
 * cantidad × precio × escala contra el valorizado. Tolerancia (D-37):
 * |cantidad| × escala × medio último dígito del precio + medio último dígito
 * del valorizado.
 */
export function detectarEscala(e: {
  cantidad: Decimal
  precio: Decimal
  decimalesPrecio: number
  valorizado: Decimal
  decimalesValorizado: number
  /** La escala habitual de la sección, para desempatar. */
  preferida: Escala | null
}): ResultadoEscala {
  const tolPrecio = medioDigito(e.decimalesPrecio)
  const tolValorizado = medioDigito(e.decimalesValorizado)
  const pruebas = ESCALAS.map((escala) => {
    const x = new Decimal(escala)
    const calculado = e.cantidad.times(e.precio).times(x)
    const tolerancia = e.cantidad.abs().times(x).times(tolPrecio).plus(tolValorizado)
    const dif = calculado.minus(e.valorizado).abs()
    return { escala, calculado, tolerancia, dif, ok: dif.lte(tolerancia) }
  })
  const cierran = pruebas.filter((p) => p.ok)
  const masCerca = [...pruebas].sort((a, b) => a.dif.comparedTo(b.dif))[0]
  const elegida =
    cierran.length === 0
      ? masCerca
      : (cierran.find((p) => p.escala === e.preferida) ?? [...cierran].sort((a, b) => a.dif.comparedTo(b.dif))[0])
  return {
    escala: cierran.length ? elegida.escala : null,
    probada: elegida.escala,
    ambigua: cierran.length > 1,
    chequeo: {
      regla: `cantidad × precio${textoEscala(elegida.escala)} ≈ posición total`,
      esperado: e.valorizado.toFixed(),
      calculado: elegida.calculado.toFixed(),
      tolerancia: elegida.tolerancia.toFixed(),
      ok: elegida.ok,
    },
  }
}

// ───────────── Fechas (D-61) ─────────────

function fechaValida(f: Fecha): boolean {
  const [a, m, d] = f.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d))
  return a >= 2000 && a <= 2100 && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/**
 * Fecha del reporte a partir de la celda B1. IEB guarda el día como las 03:00
 * UTC (la medianoche de Córdoba): vale el día calendario en Córdoba. Un valor
 * de solo fecha (00:00) es ese día tal cual. Si el día en Córdoba no coincide
 * con el que muestra Excel, se avisa.
 */
function fechaDeCelda(c: Celda | undefined): { fecha: Fecha | null; aviso: string | null } {
  if (!c) return { fecha: null, aviso: 'No encontré la fecha del reporte (celda B1).' }
  let instante: Date | null = null
  if (c.tipo === 'fecha') instante = c.fecha
  else if (c.tipo === 'numero') instante = new Date(Math.round(((c.numero as number) - 25569) * 86_400_000))
  else if (c.tipo === 'texto') {
    const t = (c.texto ?? '').trim()
    const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
    const ymd = t.match(/^(\d{4})-(\d{2})-(\d{2})\b/)
    const f = dmy
      ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
      : ymd
        ? `${ymd[1]}-${ymd[2]}-${ymd[3]}`
        : null
    if (f && fechaValida(f)) return { fecha: f, aviso: null }
    return { fecha: null, aviso: `No pude leer la fecha del reporte en ${c.ref} («${t}»).` }
  }
  if (!instante || Number.isNaN(instante.getTime())) {
    return { fecha: null, aviso: `No pude leer la fecha del reporte en ${c.ref}.` }
  }
  const visible = instante.toISOString().slice(0, 10)
  const soloFecha =
    instante.getUTCHours() === 0 &&
    instante.getUTCMinutes() === 0 &&
    instante.getUTCSeconds() === 0 &&
    instante.getUTCMilliseconds() === 0
  const fecha = soloFecha ? visible : fechaEnCordoba(instante)
  if (!fechaValida(fecha)) return { fecha: null, aviso: `La fecha del reporte en ${c.ref} no es válida.` }
  if (fecha !== visible) {
    const hora = instante.toISOString().slice(11, 16)
    return {
      fecha,
      aviso: `${c.ref} trae fecha y hora (${fechaLarga(visible)} ${hora}); en hora de Córdoba es el ${fechaLarga(fecha)}, y esa es la fecha que se usa.`,
    }
  }
  return { fecha, aviso: null }
}

// ───────────── Hoja Patrimonio ─────────────

type ClaveColumna =
  | 'especie'
  | 'moneda'
  | 'cantidad'
  | 'precio'
  | 'pct'
  | 'ppp'
  | 'var'
  | 'resultado'
  | 'actualizado'
  | 'posicion'

const OBLIGATORIAS: readonly ClaveColumna[] = ['especie', 'cantidad', 'precio', 'posicion']

const NOMBRE_COLUMNA: Record<ClaveColumna, string> = {
  especie: 'Especie',
  moneda: 'Moneda de emisión',
  cantidad: 'Cantidad',
  precio: 'Precio',
  pct: '% del total',
  ppp: 'PPP',
  var: 'Var%',
  resultado: 'Resultado',
  actualizado: 'Actualizado',
  posicion: 'Posición total',
}

function claveColumna(t: string): ClaveColumna | null {
  const n = norm(t)
  if (n === 'especie') return 'especie'
  if (n.startsWith('moneda')) return 'moneda'
  if (n === 'cantidad') return 'cantidad'
  if (n === 'precio') return 'precio'
  if (n.includes('%') && n.includes('total')) return 'pct'
  if (n === 'ppp' || n === 'ppc' || n.startsWith('precio promedio')) return 'ppp'
  if (n.replace(/\s/g, '') === 'var%' || n.startsWith('variacion')) return 'var'
  if (n === 'resultado') return 'resultado'
  if (n === 'actualizado') return 'actualizado'
  if (n === 'posicion total' || n === 'posicion' || n === 'valorizado') return 'posicion'
  return null
}

type Columnas = Partial<Record<ClaveColumna, number>>

interface Subfila {
  fila: number
  etiqueta: string
  cantidad: Num
}

interface Posicion {
  fila: number
  especie: string
  ticker: string
  nombre: string | null
  moneda: string | null
  cantidad: Num
  precio: Num
  ppp: Num
  posicion: Num
  subfilas: Subfila[]
}

interface Seccion {
  titulo: string | null
  columnas: Columnas
  /** Faltan columnas obligatorias: la sección no se pudo leer. */
  faltan: ClaveColumna[]
  posiciones: Posicion[]
  subtotal: { fila: number; posicion: Num } | null
}

interface Patrimonio {
  fecha: Fecha | null
  b2: Num | null
  secciones: Seccion[]
  advertencias: string[]
  numerosComoTexto: string[]
}

/** Sub-filas conocidas: dicen si la posición está disponible o pendiente de liquidar. */
const SUBFILAS = new Map<string, 'disponible' | 'liquidar'>([
  ['disponible', 'disponible'],
  ['liquidar', 'liquidar'],
  ['a liquidar', 'liquidar'],
])

function separarEspecie(especie: string): { ticker: string; nombre: string | null } {
  const t = especie.trim()
  const m = t.match(/^(\S+?)\s+-\s+(.+)$/) ?? t.match(/^([A-Za-z0-9.]+)\s*-\s*(.+)$/)
  if (m) {
    const nombre = m[2].trim()
    return { ticker: m[1].trim(), nombre: nombre === '' ? null : nombre }
  }
  return { ticker: t, nombre: null }
}

function leerPatrimonio(h: Hoja): Patrimonio {
  const advertencias: string[] = []
  const secciones: Seccion[] = []
  let fechaCelda: Celda | undefined
  let b2: Num | null = null
  let titulo: { texto: string; fila: number } | null = null
  let actual: Seccion | null = null
  let cerrada = false // la sección actual ya pasó su Subtotal
  let ultima: Posicion | null = null
  let vistaAlgunaSeccion = false

  for (let r = 1; r <= h.ultima; r++) {
    const cs = celdasDeFila(h, r)
    if (cs.length === 0) continue
    const a = celda(h, r, 1)
    const ta = textoDe(a)
    const na = ta ? norm(ta) : ''
    const derecha = (c: Celda | undefined) => (c ? cs.find((x) => x.col > c.col) : undefined)

    // Encabezado del reporte: "Fecha:" y "Patrimonio total" (vale la primera aparición).
    if (/^fecha:?$/.test(na)) {
      fechaCelda ??= derecha(a)
      continue
    }
    if (na === 'patrimonio total') {
      const c = derecha(a)
      b2 ??= c ? numDe(h, r, c.col) : { k: 'vacio', ref: direccion(r, 2) }
      continue
    }

    // Fila de encabezado de una sección.
    if (cs.some((c) => c.tipo === 'texto' && norm(c.texto ?? '') === 'especie')) {
      const columnas: Columnas = {}
      for (const c of cs) {
        const k = c.tipo === 'texto' ? claveColumna(c.texto ?? '') : null
        if (k && columnas[k] === undefined) columnas[k] = c.col
      }
      const faltan = OBLIGATORIAS.filter((k) => columnas[k] === undefined)
      actual = {
        titulo: titulo?.texto ?? null,
        columnas,
        faltan,
        posiciones: [],
        subtotal: null,
      }
      secciones.push(actual)
      vistaAlgunaSeccion = true
      if (!titulo) advertencias.push(`Hay un encabezado sin título de sección (hoja ${h.nombre}, fila ${r}).`)
      if (faltan.length) {
        advertencias.push(
          `El encabezado de ${titulo ? `«${titulo.texto}»` : 'una sección'} (hoja ${h.nombre}, fila ${r}) no tiene ${faltan
            .map((k) => `«${NOMBRE_COLUMNA[k]}»`)
            .join(', ')}: esa sección no se pudo leer.`,
        )
      }
      titulo = null
      cerrada = false
      ultima = null
      continue
    }

    // Fila con un solo texto en A: título de grupo o de sección.
    const soloA = cs.length === 1 && cs[0].col === 1 && cs[0].tipo === 'texto'
    if (soloA && !SUBFILAS.has(na) && na !== 'subtotal') {
      if (na.startsWith('tenencia')) {
        if (na !== 'tenencia mercado argentino') {
          advertencias.push(
            `El Excel trae «${ta}» (hoja ${h.nombre}, fila ${r}), un bloque que este lector no conoce: revisá que sus precios estén en pesos.`,
          )
        }
      } else {
        titulo = { texto: ta as string, fila: r }
      }
      actual = null
      cerrada = false
      ultima = null
      continue
    }

    if (!actual) {
      // Antes de la primera sección van los datos del comitente: no se leen.
      if (vistaAlgunaSeccion && cs.some((c) => c.tipo === 'numero')) {
        advertencias.push(`Fila ${r} de la hoja ${h.nombre} no reconocida: no se leyó.`)
      }
      continue
    }
    if (actual.faltan.length) continue

    const col = actual.columnas
    if (na === 'subtotal') {
      actual.subtotal = { fila: r, posicion: numDe(h, r, col.posicion ?? null) }
      cerrada = true
      ultima = null
      continue
    }

    const tMoneda = col.moneda !== undefined ? textoDe(celda(h, r, col.moneda)) : null
    const esSub = SUBFILAS.has(na) || (ultima !== null && tMoneda !== null && esGuion(tMoneda) && !(ta ?? '').includes(' - '))
    if (esSub) {
      if (ultima === null) {
        advertencias.push(`Sub-fila «${ta}» sin posición arriba (hoja ${h.nombre}, fila ${r}).`)
      } else {
        ultima.subfilas.push({ fila: r, etiqueta: ta ?? '', cantidad: numDe(h, r, col.cantidad ?? null) })
      }
      continue
    }

    if (cerrada) {
      advertencias.push(
        `Fila ${r} de la hoja ${h.nombre}, después del Subtotal de ${actual.titulo ?? 'la sección'}: no se leyó.`,
      )
      continue
    }

    const tEspecie = textoDe(celda(h, r, col.especie ?? null))
    if (!tEspecie) {
      advertencias.push(`Fila ${r} de la hoja ${h.nombre} sin especie: no se leyó.`)
      continue
    }
    const { ticker, nombre } = separarEspecie(tEspecie)
    const pos: Posicion = {
      fila: r,
      especie: tEspecie,
      ticker,
      nombre,
      moneda: tMoneda,
      cantidad: numDe(h, r, col.cantidad ?? null),
      precio: numDe(h, r, col.precio ?? null),
      ppp: numDe(h, r, col.ppp ?? null),
      posicion: numDe(h, r, col.posicion ?? null),
      subfilas: [],
    }
    actual.posiciones.push(pos)
    ultima = pos
  }

  const fechaLeida = fechaDeCelda(fechaCelda)
  if (fechaLeida.aviso) advertencias.push(fechaLeida.aviso)

  const numerosComoTexto: string[] = []
  for (const s of secciones) {
    for (const p of s.posiciones) {
      for (const n of [p.cantidad, p.precio, p.ppp, p.posicion]) if (n.k === 'n' && n.deTexto) numerosComoTexto.push(n.ref)
    }
    if (s.subtotal?.posicion.k === 'n' && s.subtotal.posicion.deTexto) numerosComoTexto.push(s.subtotal.posicion.ref)
  }
  if (b2?.k === 'n' && b2.deTexto) numerosComoTexto.push(b2.ref)

  return { fecha: fechaLeida.fecha, b2, secciones, advertencias, numerosComoTexto }
}

// ───────────── Clasificación de secciones y especies ─────────────

interface ClaseSeccion {
  seccion: FilaLeida['seccion']
  /** Escala habitual de sus precios, para desempatar. */
  escala: Escala | null
  /** Está en el formato verificado del Excel real. */
  conocida: boolean
  tipo: (ticker: string, nombre: string | null) => TipoActivo | null
}

function mayus(s: string | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

const esLetra = (ticker: string, nombre: string | null) =>
  /\bLETRAS?\b|\bLECAPS?\b/.test(mayus(nombre)) || /^S\d{2}[A-Z]\d$/.test(ticker.toUpperCase())

function tipoPorNombre(ticker: string, nombre: string | null): TipoActivo | null {
  const n = mayus(nombre)
  if (/\bCEDEAR\b/.test(n)) return 'cedear'
  if (esLetra(ticker, nombre)) return 'lecap'
  if (/\bBONO\b|\bBONCAP\b|\bOBLIG/.test(n)) return 'bono'
  if (/\bFCI\b|\bFONDO\b/.test(n)) return 'fci'
  if (/\bACCION/.test(n)) return 'accion_local'
  return null
}

function claseDeSeccion(titulo: string | null): ClaseSeccion {
  const n = norm(titulo ?? '')
  const bono = (t: string, nom: string | null): TipoActivo => (esLetra(t, nom) ? 'lecap' : 'bono')
  if (n === 'acciones') return { seccion: 'acciones', escala: '1', conocida: true, tipo: () => 'accion_local' }
  if (n === 'bonos') return { seccion: 'bonos', escala: '0.01', conocida: true, tipo: bono }
  if (n === 'cedears') return { seccion: 'cedears', escala: '1', conocida: true, tipo: () => 'cedear' }
  if (n === 'otros') return { seccion: 'otros', escala: '1', conocida: true, tipo: tipoPorNombre }
  if (n.startsWith('letra')) return { seccion: 'bonos', escala: '0.01', conocida: false, tipo: () => 'lecap' }
  if (n.includes('obligacion') || n.startsWith('bono')) return { seccion: 'bonos', escala: '0.01', conocida: false, tipo: bono }
  if (n.includes('fondo') || n === 'fci') return { seccion: 'fci', escala: null, conocida: false, tipo: () => 'fci' }
  if (n.startsWith('cedear')) return { seccion: 'cedears', escala: '1', conocida: false, tipo: () => 'cedear' }
  if (n.startsWith('accion')) return { seccion: 'acciones', escala: '1', conocida: false, tipo: () => 'accion_local' }
  return { seccion: null, escala: null, conocida: false, tipo: tipoPorNombre }
}

/** Dólares en especie: se leen como liquidez en USD, no como activo. */
function esDolarEnEspecie(p: Posicion): boolean {
  return p.ticker.toUpperCase() === 'DOLARUSA'
}

function monedaDe(t: string | null): Moneda | null {
  const n = (t ?? '').trim().toUpperCase()
  if (n === 'ARS' || n === '$') return 'ARS'
  if (n === 'USD' || n === 'US$' || n === 'U$S') return 'USD'
  return null
}

function describirFalta(n: Num, que: string): string {
  if (n.k === 'otro') return `${que.charAt(0).toUpperCase()}${que.slice(1)} no es un número (${n.ref}: «${n.texto}»).`
  return `Falta ${que} (${n.ref}).`
}

// ───────────── Filas ─────────────

const nombreEscala = (e: Escala) => (e === '1' ? '×1' : e === '0.01' ? '÷100' : '÷1.000')

function armarFila(h: Hoja, s: Seccion, clase: ClaseSeccion, p: Posicion, clave: string): FilaLeida {
  const errores: string[] = []
  const avisos: string[] = []
  const q = valorNum(p.cantidad)
  const precio = valorNum(p.precio)
  const val = valorNum(p.posicion)
  if (q === null) errores.push(describirFalta(p.cantidad, 'la cantidad'))
  if (precio === null) errores.push(describirFalta(p.precio, 'el precio'))
  if (val === null) errores.push(describirFalta(p.posicion, 'la posición total') + ' Sin ella no se puede verificar la cuenta.')

  const moneda = monedaDe(p.moneda)
  if (moneda === null) avisos.push(p.moneda ? `Moneda de emisión desconocida («${p.moneda}»).` : 'Sin moneda de emisión.')

  let escala: Escala | null = null
  let chequeo: Chequeo | null = null
  if (q !== null && precio !== null && val !== null && p.cantidad.k === 'n' && p.precio.k === 'n' && p.posicion.k === 'n') {
    const r = detectarEscala({
      cantidad: q,
      precio,
      decimalesPrecio: p.precio.dec,
      valorizado: val,
      decimalesValorizado: p.posicion.dec,
      preferida: clase.escala,
    })
    chequeo = r.chequeo
    escala = r.escala
    if (r.escala === null) {
      const calculado = new Decimal(r.chequeo.calculado)
      errores.push(
        `La cuenta no cierra: ${fCant(q)} × ${fPrecio(precio)}${textoEscala(r.probada)} = ${fPesos(calculado)}, y la posición total dice ${fPesos(val)} (diferencia ${fPesos(calculado.minus(val))}, tolerancia ±${fTol(new Decimal(r.chequeo.tolerancia))}).`,
      )
    } else if (r.ambigua) {
      avisos.push(
        q.isZero()
          ? `Cantidad 0: la escala del precio no se puede verificar; se tomó ${nombreEscala(r.escala)}.`
          : `La escala del precio es ambigua con estos montos; se tomó ${nombreEscala(r.escala)}.`,
      )
    } else if (clase.escala !== null && r.escala !== clase.escala) {
      avisos.push(`La escala del precio (${nombreEscala(r.escala)}) no es la habitual de ${s.titulo ?? 'la sección'}.`)
    }
  }

  // Liquidación: la sub-fila Disponible / Liquidar (D-19).
  let liquidacion: FilaLeida['liquidacion'] = null
  if (p.subfilas.length === 0) {
    avisos.push('Sin sub-fila Disponible / Liquidar: no se sabe si está pendiente de liquidar.')
  } else {
    const tipos = p.subfilas.map((x) => SUBFILAS.get(norm(x.etiqueta)) ?? null)
    if (tipos.includes('liquidar')) liquidacion = 'liquidar'
    else if (tipos.every((t) => t === 'disponible')) liquidacion = 'disponible'
    for (const [i, t] of tipos.entries()) {
      if (t === null) avisos.push(`Sub-fila desconocida «${p.subfilas[i].etiqueta}» (fila ${p.subfilas[i].fila}).`)
    }
    const cantidades = p.subfilas.map((x) => valorNum(x.cantidad))
    if (q !== null && cantidades.every((c) => c !== null)) {
      const sumaSub = (cantidades as Decimal[]).reduce((a, b) => a.plus(b), new Decimal(0))
      if (!sumaSub.eq(q)) {
        avisos.push(`Las sub-filas suman ${fCant(sumaSub)} y la posición dice ${fCant(q)}.`)
      }
    }
  }

  // PPP: en la escala de la fuente y por 1 VN.
  let ppcMostrado: Decimal | null = null
  if (p.ppp.k === 'n' && p.ppp.v.isPositive()) {
    ppcMostrado = p.ppp.v
  } else if (p.ppp.k === 'n') {
    avisos.push(`PPP en ${fPrecio(p.ppp.v)}: el costo queda sin dato.`)
  } else if (p.ppp.k === 'otro') {
    avisos.push(`PPP ilegible (${p.ppp.ref}: «${p.ppp.texto}»): el costo queda sin dato.`)
  } else if (liquidacion === 'liquidar') {
    avisos.push('PPP todavía no informado: compra del día')
  } else {
    avisos.push('IEB no informa el PPP: el costo queda sin dato.')
  }

  const x = escala === null ? null : new Decimal(escala)
  const estado: EstadoFila = errores.length ? 'error' : avisos.length ? 'advertencia' : 'verificada'
  return {
    clave,
    ticker: p.ticker,
    nombre: p.nombre,
    seccion: clase.seccion,
    tipo_sugerido: clase.tipo(p.ticker, p.nombre),
    moneda_emision: moneda,
    cantidad: q?.toFixed() ?? null,
    precio_mostrado: precio?.toFixed() ?? null,
    escala,
    precio_unitario: precio !== null && x !== null ? precio.times(x).toFixed() : null,
    valorizado: val?.toFixed() ?? null,
    ppc_mostrado: ppcMostrado?.toFixed() ?? null,
    ppc_unitario: ppcMostrado !== null && x !== null ? ppcMostrado.times(x).toFixed() : null,
    costo_total: null,
    liquidacion,
    estado,
    motivos: [...errores, ...avisos],
    chequeo,
    lugar: `hoja ${h.nombre}, fila ${p.fila}`,
  }
}

// ───────────── Hoja Saldos ─────────────

type ClaveBloque = 'ARS' | 'USD' | 'USD_EXT'

interface FilaSaldo {
  fila: number
  etiqueta: string
  saldo: Num
}

interface BloqueSaldos {
  titulo: string
  fila: number
  filas: Map<string, FilaSaldo>
}

function claveBloque(t: string): ClaveBloque | null {
  const n = norm(t).replace(/\.$/, '')
  if (n === 'ars' || n === 'pesos' || n === '$') return 'ARS'
  if (n === 'usd' || n === 'dolares' || n === 'us$' || n === 'u$s') return 'USD'
  if (/^(usd|dolares) ext/.test(n)) return 'USD_EXT'
  return null
}

/** Filas de cada bloque de Saldos. Una de estas sin valor sigue siendo una fila, no un bloque nuevo. */
const PLAZOS = new Set(['hoy', '24h', '48h', '72h', 'mas de 72h', 'garantia de opciones', 'total'])

function leerSaldos(h: Hoja): { bloques: Map<ClaveBloque, BloqueSaldos>; advertencias: string[] } {
  const bloques = new Map<ClaveBloque, BloqueSaldos>()
  const advertencias: string[] = []
  let actual: BloqueSaldos | null = null
  let colSaldo: number | null = null
  for (let r = 1; r <= h.ultima; r++) {
    const cs = celdasDeFila(h, r)
    if (cs.length === 0) continue
    const ta = textoDe(celda(h, r, 1))
    if (!ta) continue
    const na = norm(ta)
    const soloA = cs.length === 1 && cs[0].col === 1
    const clave = claveBloque(ta)
    if (soloA && clave) {
      actual = { titulo: ta, fila: r, filas: new Map() }
      if (bloques.has(clave)) advertencias.push(`La hoja ${h.nombre} repite el bloque «${ta}» (fila ${r}): se usa el primero.`)
      else bloques.set(clave, actual)
      colSaldo = null
      continue
    }
    if (soloA && !(actual && PLAZOS.has(na))) {
      advertencias.push(`Bloque desconocido «${ta}» en la hoja ${h.nombre} (fila ${r}): no se leyó.`)
      actual = null
      continue
    }
    if (!actual) continue
    if (na === 'plazo') {
      const c = cs.find((x) => x.tipo === 'texto' && norm(x.texto ?? '') === 'saldo')
      colSaldo = c ? c.col : null
      continue
    }
    const fs: FilaSaldo = { fila: r, etiqueta: ta, saldo: numDe(h, r, colSaldo ?? 3) }
    if (!actual.filas.has(na)) actual.filas.set(na, fs)
  }
  return { bloques, advertencias }
}

// ───────────── Apertura del archivo ─────────────

function buscarHoja(libro: Workbook, nombre: string): Worksheet | undefined {
  return libro.worksheets.find((w) => norm(w.name) === norm(nombre))
}

function esZip(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)
}

function esXlsViejo(b: Uint8Array): boolean {
  return b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0
}

async function abrirLibro(datos: ArrayBuffer | Uint8Array): Promise<Workbook> {
  const bytes = ArrayBuffer.isView(datos)
    ? new Uint8Array(datos.buffer, datos.byteOffset, datos.byteLength)
    : new Uint8Array(datos)
  if (bytes.byteLength === 0) throw new ErrorLectorIEB('El archivo está vacío.')
  if (esXlsViejo(bytes)) {
    throw new ErrorLectorIEB(
      'Es un Excel en formato viejo (.xls). Abrilo y guardalo como .xlsx, o volvé a descargar el Portafolio de IEB.',
    )
  }
  if (!esZip(bytes)) throw new ErrorLectorIEB('El archivo no es un Excel (.xlsx): ¿es el Portafolio de IEB?')
  const libro = new ExcelJS.Workbook()
  try {
    // exceljs tipa load() con su propio Buffer (un ArrayBuffer): se le pasa una copia exacta de los bytes.
    await libro.xlsx.load(bytes.slice().buffer)
  } catch (e) {
    throw new ErrorLectorIEB('No pude abrir el Excel: está dañado o no es un .xlsx. ¿Es el Portafolio de IEB?', { cause: e })
  }
  return libro
}

// ───────────── Posiciones y Subtotales (D-11, D-38) ─────────────

interface DolarEnEspecie {
  p: Posicion
  /** Chequeo de cantidad × precio ≈ posición total (null: falta un dato). */
  chequeo: ResultadoEscala | null
}

/** Σ de las posiciones totales de todas las secciones (incluida DOLARUSA), para B2. */
interface SumaPosiciones {
  valor: Decimal
  /** Medio último dígito de cada sumando (D-37). */
  tol: Decimal
  /** Lo que no se pudo sumar: con algo acá, B2 no se puede verificar. */
  faltan: string[]
}

function controlSubtotal(s: Seccion, nombre: string, suma: Decimal | null, tol: Decimal): ControlLeido | string | null {
  const sub = s.subtotal
  const n = s.posiciones.length
  if (!sub) return n ? `La sección ${nombre} no tiene fila Subtotal: no se pudo verificar.` : null
  if (sub.posicion.k !== 'n') {
    return n ? `El Subtotal de ${nombre} (fila ${sub.fila}) no trae la posición total: la sección no se pudo verificar.` : null
  }
  const informado = sub.posicion.v
  if (suma === null) {
    return {
      tipo: 'ieb_subtotal',
      seccion: nombre,
      informado: informado.toFixed(),
      calculado: null,
      ok: null,
      detalle: `Falta la posición total de alguna fila de ${nombre}: el Subtotal (fila ${sub.fila}, ${fPesos(informado)}) no se puede verificar.`,
    }
  }
  const tolerancia = tol.plus(medioDigito(sub.posicion.dec))
  const dif = suma.minus(informado)
  return {
    tipo: 'ieb_subtotal',
    seccion: nombre,
    informado: informado.toFixed(),
    calculado: suma.toFixed(),
    ok: dif.abs().lte(tolerancia),
    detalle: `Suma de ${n === 1 ? '1 posición' : `${n} posiciones`}: ${fPesos(suma)} · Subtotal (fila ${sub.fila}): ${fPesos(informado)} · diferencia ${fPesos(dif)} · tolerancia ±${fTol(tolerancia)}.`,
  }
}

function armarPosiciones(h: Hoja, pat: Patrimonio) {
  const filas: FilaLeida[] = []
  const subtotales: ControlLeido[] = []
  const dolares: DolarEnEspecie[] = []
  const advertencias: string[] = []
  const suma: SumaPosiciones = { valor: new Decimal(0), tol: new Decimal(0), faltan: [] }
  const porTicker = new Map<string, FilaLeida[]>()

  for (const s of pat.secciones) {
    const clase = claseDeSeccion(s.titulo)
    const nombre = s.titulo ?? 'sin título'
    if (s.faltan.length) {
      suma.faltan.push(`la sección ${nombre}, que no se pudo leer`)
      continue
    }
    const n = s.posiciones.filter((p) => !esDolarEnEspecie(p)).length
    if (!clase.conocida && n > 0) {
      advertencias.push(
        `La sección «${nombre}» no está en el formato verificado del Excel de IEB: ${n === 1 ? 'su posición se leyó' : `sus ${n} posiciones se leyeron`} igual; revisá el tipo de cada una.`,
      )
    }
    let sumaSeccion: Decimal | null = new Decimal(0)
    let tolSeccion = new Decimal(0)
    for (const p of s.posiciones) {
      const val = valorNum(p.posicion)
      if (val === null || p.posicion.k !== 'n') {
        sumaSeccion = null
        suma.faltan.push(`la posición total de ${p.ticker} (fila ${p.fila})`)
      } else {
        const d = medioDigito(p.posicion.dec)
        if (sumaSeccion !== null) sumaSeccion = sumaSeccion.plus(val)
        tolSeccion = tolSeccion.plus(d)
        suma.valor = suma.valor.plus(val)
        suma.tol = suma.tol.plus(d)
      }
      if (esDolarEnEspecie(p)) {
        const q = valorNum(p.cantidad)
        dolares.push({
          p,
          chequeo:
            q !== null && val !== null && p.precio.k === 'n' && p.posicion.k === 'n'
              ? detectarEscala({
                  cantidad: q,
                  precio: p.precio.v,
                  decimalesPrecio: p.precio.dec,
                  valorizado: val,
                  decimalesValorizado: p.posicion.dec,
                  preferida: '1',
                })
              : null,
        })
        continue
      }
      const repetidas = porTicker.get(p.ticker.toUpperCase()) ?? []
      const clave = `IEB:${p.ticker}${repetidas.length ? `#${repetidas.length + 1}` : ''}`
      const f = armarFila(h, s, clase, p, clave)
      repetidas.push(f)
      porTicker.set(p.ticker.toUpperCase(), repetidas)
      filas.push(f)
    }
    const c = controlSubtotal(s, nombre, sumaSeccion, tolSeccion)
    if (typeof c === 'string') advertencias.push(c)
    else if (c) subtotales.push(c)
  }

  // Un ticker repetido no se puede conciliar por separado (D-15).
  for (const fs of porTicker.values()) {
    if (fs.length < 2) continue
    const lugares = fs.map((f) => f.lugar?.replace(/^.*fila /, '') ?? '?').join(' y ')
    for (const f of fs) {
      f.estado = 'error'
      f.motivos.unshift(`El ticker ${f.ticker} aparece más de una vez en el Excel (filas ${lugares}): no se puede conciliar por separado.`)
    }
    advertencias.push(`El ticker ${fs[0].ticker} aparece más de una vez (filas ${lugares}).`)
  }
  return { filas, subtotales, dolares, suma, advertencias }
}

// ───────────── Saldos (D-13) ─────────────

interface TotalSaldo {
  bloque: BloqueSaldos | null
  fila: FilaSaldo | null
  /** null = sin dato (no hay bloque, ni fila Total, o dice "-"). */
  valor: Decimal | null
  decimales: number
}

function totalDe(sal: ReturnType<typeof leerSaldos>, clave: ClaveBloque): TotalSaldo {
  const bloque = sal.bloques.get(clave) ?? null
  const fila = bloque?.filas.get('total') ?? null
  const valor = fila ? valorNum(fila.saldo) : null
  return { bloque, fila, valor, decimales: fila && fila.saldo.k === 'n' ? fila.saldo.dec : 0 }
}

function sinTotal(hS: Hoja, moneda: 'ARS' | 'USD', t: TotalSaldo): string {
  const cual = `el saldo en ${moneda === 'ARS' ? 'pesos' : 'dólares'} de IEB no se lee.`
  if (!t.bloque) return `La hoja ${hS.nombre} no tiene el bloque ${moneda}: ${cual}`
  if (!t.fila) return `El bloque ${moneda} de la hoja ${hS.nombre} no tiene la fila Total: ${cual}`
  return `El Total ${moneda} de la hoja ${hS.nombre} (fila ${t.fila.fila}) no es un número: ${cual}`
}

/**
 * ARS: el Total de Saldos (neto de lo que falta liquidar; puede ser negativo).
 * USD: el Total de Saldos más los dólares en especie (DOLARUSA), con sus partes.
 */
function armarSaldos(hP: Hoja, hS: Hoja, sal: ReturnType<typeof leerSaldos>, dolares: DolarEnEspecie[]) {
  const saldos: SaldoLeido[] = []
  const advertencias: string[] = []
  const lugar = (t: TotalSaldo) => (t.fila ? `hoja ${hS.nombre}, fila ${t.fila.fila}` : null)

  const ars = totalDe(sal, 'ARS')
  if (ars.valor !== null) {
    saldos.push({
      moneda: 'ARS',
      monto: ars.valor.toFixed(),
      partes: [{ concepto: 'Saldo Total ARS', monto: ars.valor.toFixed() }],
      tna: null,
      estado: 'verificada',
      motivos: [],
      lugar: lugar(ars),
    })
  } else {
    advertencias.push(sinTotal(hS, 'ARS', ars))
  }

  const usd = totalDe(sal, 'USD')
  const partes: SaldoLeido['partes'] = []
  const motivos: string[] = []
  if (usd.valor !== null) partes.push({ concepto: 'Saldo Total USD', monto: usd.valor.toFixed() })
  else if (dolares.length) motivos.push(`${sinTotal(hS, 'USD', usd)} El saldo en dólares queda incompleto.`)
  for (const { p, chequeo } of dolares) {
    const q = valorNum(p.cantidad)
    if (q === null) {
      motivos.push(`DOLARUSA (fila ${p.fila}): ${describirFalta(p.cantidad, 'la cantidad')}`)
      continue
    }
    partes.push({ concepto: 'DOLARUSA (dólares en especie)', monto: q.toFixed() })
    if (!chequeo) {
      motivos.push(`DOLARUSA (fila ${p.fila}): falta el precio o la posición total; no se puede verificar.`)
    } else if (chequeo.escala !== '1') {
      const c = chequeo.chequeo
      motivos.push(
        `DOLARUSA (fila ${p.fila}): la cuenta no cierra: US$ ${fCant(q)} × ${fPrecio(valorNum(p.precio) as Decimal)} = ${fPesos(new Decimal(c.calculado))}, y la posición total dice ${fPesos(new Decimal(c.esperado))}.`,
      )
    }
  }
  if (usd.valor !== null || dolares.length) {
    const lugares = [lugar(usd), ...dolares.map(({ p }) => `DOLARUSA en hoja ${hP.nombre}, fila ${p.fila}`)].filter(Boolean)
    saldos.push({
      moneda: 'USD',
      monto: partes.reduce((a, x) => a.plus(x.monto), new Decimal(0)).toFixed(),
      partes,
      tna: null,
      // Cualquier motivo acá es un dato que falta o que no cierra: no se graba en silencio (D-11).
      estado: motivos.length ? 'error' : 'verificada',
      motivos,
      lugar: lugares.join(' · ') || null,
    })
  } else {
    advertencias.push(sinTotal(hS, 'USD', usd))
  }

  const ext = totalDe(sal, 'USD_EXT')
  if (ext.valor !== null && !ext.valor.isZero()) {
    advertencias.push(
      `La hoja ${hS.nombre} trae US$ ${numero(ext.valor, 2)} en «${ext.bloque?.titulo.trim()}» (fila ${ext.fila?.fila}): no se suman al saldo de IEB. Revisá si corresponde.`,
    )
  }
  return { saldos, ars, usd, advertencias }
}

// ───────────── Control B2 (D-38, D-66) ─────────────

/**
 * B2 = Σ posiciones (incluida DOLARUSA) + Total ARS + Total USD × dólar de
 * IEB (el precio de DOLARUSA). Tolerancia (D-37): medio último dígito de cada
 * término; el producto propaga sus dos factores. Si falta un término, el
 * control queda "no verificable" (ok null), nunca OK.
 */
function controlB2(
  b2: Num | null,
  suma: SumaPosiciones,
  ars: TotalSaldo,
  usd: TotalSaldo,
  dolares: DolarEnEspecie[],
  hS: Hoja,
): { control: ControlLeido | null; advertencias: string[] } {
  const advertencias: string[] = []
  if (!b2 || b2.k !== 'n') {
    advertencias.push(
      !b2 || b2.k === 'vacio'
        ? 'No encontré el Patrimonio total (B2): no se puede controlar la lectura.'
        : `El Patrimonio total (${b2.ref}) no es un número: no se puede controlar la lectura.`,
    )
    return { control: null, advertencias }
  }
  const informado = b2.v
  const tasas = dolares.map(({ p }) => p.precio).filter((x): x is Extract<Num, { k: 'n' }> => x.k === 'n')
  const tasa = tasas[0] ?? null
  if (tasas.some((t) => !t.v.eq(tasas[0].v))) {
    advertencias.push('Hay más de una fila DOLARUSA con distinto precio: para B2 se usa la primera.')
  }
  const sinVerificar = (detalle: string): ControlLeido => ({
    tipo: 'ieb_b2',
    seccion: null,
    informado: informado.toFixed(),
    calculado: null,
    ok: null,
    detalle,
  })
  const faltan = [...suma.faltan]
  if (ars.valor === null) faltan.push('el Total ARS de la hoja Saldos')
  if (usd.valor === null) faltan.push('el Total USD de la hoja Saldos')
  if (faltan.length) {
    return { control: sinVerificar(`Falta ${faltan.join(', ')}: B2 (${fPesos(informado)}) no se puede verificar.`), advertencias }
  }
  const pesos = ars.valor as Decimal
  const dolaresSaldo = usd.valor as Decimal
  if (!dolaresSaldo.isZero() && tasa === null) {
    return {
      control: sinVerificar(
        `Hay US$ ${numero(dolaresSaldo, 2)} en la hoja ${hS.nombre} y el Excel no trae DOLARUSA para valuarlos al dólar de IEB: B2 (${fPesos(informado)}) no se puede verificar. Posiciones más saldo en pesos: ${fPesos(suma.valor.plus(pesos))}.`,
      ),
      advertencias,
    }
  }
  let calculado = suma.valor.plus(pesos)
  let tol = suma.tol.plus(medioDigito(ars.decimales)).plus(medioDigito(b2.dec))
  let usdTexto = ''
  if (tasa !== null) {
    calculado = calculado.plus(dolaresSaldo.times(tasa.v))
    const du = medioDigito(usd.decimales)
    const dt = medioDigito(tasa.dec)
    tol = tol.plus(tasa.v.abs().times(du)).plus(dolaresSaldo.abs().times(dt)).plus(du.times(dt))
    usdTexto = ` + US$ ${numero(dolaresSaldo, 2)} × ${fPrecio(tasa.v)} (dólar de IEB, DOLARUSA)`
  }
  const dif = calculado.minus(informado)
  return {
    control: {
      tipo: 'ieb_b2',
      seccion: null,
      informado: informado.toFixed(),
      calculado: calculado.toFixed(),
      ok: dif.abs().lte(tol),
      detalle: `Posiciones${dolares.length ? ' (con DOLARUSA)' : ''} ${fPesos(suma.valor)} + saldo en pesos ${fPesos(pesos)}${usdTexto} = ${fPesos(calculado)} · B2: ${fPesos(informado)} · diferencia ${fPesos(dif)} · tolerancia ±${fTol(tol)}.`,
    },
    advertencias,
  }
}

// ───────────── Lectura completa ─────────────

/** Lee el Excel "Portafolio" exportado por IEB. Determinístico, sin IA. */
export async function leerExcelIEB(datos: ArrayBuffer | Uint8Array): Promise<LecturaCuenta> {
  const libro = await abrirLibro(datos)
  const nombres = libro.worksheets.map((w) => w.name)
  const lista = nombres.length ? ` (hojas del archivo: ${nombres.join(', ')})` : ''
  const wsP = buscarHoja(libro, 'Patrimonio')
  if (!wsP) throw new ErrorLectorIEB(`El Excel no tiene la hoja Patrimonio: ¿es el Portafolio de IEB?${lista}`)
  const wsS = buscarHoja(libro, 'Saldos')
  if (!wsS) throw new ErrorLectorIEB(`El Excel no tiene la hoja Saldos: ¿es el Portafolio de IEB?${lista}`)

  const hP = leerHoja(wsP)
  const hS = leerHoja(wsS)
  const cruda: LecturaCrudaIEB = {
    lector: LECTOR_IEB,
    hojas: [crudaDe(hP), crudaDe(hS)],
    otras_hojas: nombres.filter((n) => n !== wsP.name && n !== wsS.name),
  }

  const pat = leerPatrimonio(hP)
  const sal = leerSaldos(hS)
  const pos = armarPosiciones(hP, pat)
  const sdo = armarSaldos(hP, hS, sal, pos.dolares)
  const b2 = controlB2(pat.b2, pos.suma, sdo.ars, sdo.usd, pos.dolares, hS)

  const advertencias = [...pat.advertencias, ...sal.advertencias, ...pos.advertencias, ...sdo.advertencias, ...b2.advertencias]
  if (pat.numerosComoTexto.length) {
    const refs = pat.numerosComoTexto
    advertencias.push(
      `Hay números guardados como texto en la hoja ${hP.nombre} (${refs.slice(0, 3).join(', ')}${refs.length > 3 ? '…' : ''}): se leyeron en formato argentino y la cuenta de cada fila los verifica.`,
    )
  }

  return {
    cuenta: 'IEB',
    origen: 'excel',
    fecha_reporte: pat.fecha,
    filas: pos.filas,
    saldos: sdo.saldos,
    controles: b2.control ? [...pos.subtotales, b2.control] : pos.subtotales,
    advertencias,
    lector: LECTOR_IEB,
    cruda,
  }
}
