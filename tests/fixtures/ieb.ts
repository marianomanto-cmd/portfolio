// Excel "Portafolio" de IEB sintético, con la misma estructura que el real y
// números inventados (D-24: los datos reales no van al repo).
//
// Estructura (verificada contra el export real):
//   Patrimonio: A1 "Fecha:" / B1 fecha (03:00 UTC del día, dd/mm/yyyy);
//     A2 "Patrimonio total" / B2; A7 "Tenencia Mercado Argentino"; después,
//     cada sección: título (solo A), encabezado A..J, por posición una fila,
//     su sub-fila Disponible/Liquidar y una fila en blanco; al final, Subtotal.
//   Saldos: bloques "ARS ", "USD " y "USD Ext. " con Plazo | Fecha | Saldo.
//
// Todo se calcula con Decimal y se escribe como número de Excel (un doble),
// igual que el export real. B2 = Σ posiciones + Total ARS + Total USD × precio
// de DOLARUSA, la identidad que cierra en el archivo real.

import * as ExcelJSModulo from 'exceljs'
import type { Worksheet } from 'exceljs'
import { Decimal } from '@/lib/domain/dinero'

type ModuloExcel = typeof ExcelJSModulo
const ExcelJS: ModuloExcel = (ExcelJSModulo as unknown as { default?: ModuloExcel }).default ?? ExcelJSModulo

export type EscalaIEB = '1' | '0.01' | '0.001'

/**
 * Valor para escribir en una celda numérica: texto decimal (se escribe como
 * número), un doble tal cual, "-", o { texto } para guardarlo como texto.
 */
export type ValorCelda = string | number | { texto: string }

export interface PosicionIEB {
  /** "TICKER - NOMBRE". */
  especie: string
  /** Columna B. Por defecto "ARS". */
  moneda?: string
  cantidad: string
  /** En la escala de IEB (cada 100 VN en bonos y letras). */
  precio: string
  /** null → "-" (compra del día). */
  ppp: string | null
  /** Sub-fila. null = sin sub-fila. Por defecto "Disponible". */
  liquidacion?: 'Disponible' | 'Liquidar' | string | null
  /** Escala con que IEB calcula la posición. Por defecto, la de la sección. */
  escala?: EscalaIEB
  /** Pisa la posición total escrita (J), sin cambiar B2 ni el Subtotal. */
  posicionEscrita?: ValorCelda
  /** Pisa el precio escrito (D), sin cambiar la posición ni los totales. */
  precioEscrito?: ValorCelda
  /** Pisa la cantidad escrita (C). */
  cantidadEscrita?: ValorCelda
  /** Pisa la cantidad de la sub-fila. */
  cantidadSubfila?: ValorCelda
}

export interface SeccionIEB {
  titulo: string
  escala: EscalaIEB
  posiciones: PosicionIEB[]
  /** Pisa la posición total del Subtotal; null = sin fila Subtotal. */
  subtotal?: ValorCelda | null
}

export interface BloqueSaldosIEB {
  hoy: string
  h24?: string
  h48?: string
  h72?: string
  mas72?: string
  garantia?: string
  /** Por defecto, la suma de los plazos. "-" = sin dato. */
  total?: ValorCelda
}

export interface PortafolioIEB {
  /** Día del reporte, 'YYYY-MM-DD'. B1 se escribe como las 03:00 UTC de ese día. */
  fecha: string
  /** Pisa el valor crudo de B1: una fecha, un número de serie o un texto. */
  b1?: Date | number | string
  /** Formato de B1 (por defecto dd/mm/yyyy; null = General). */
  b1Formato?: string | null
  secciones: SeccionIEB[]
  saldos: { ars: BloqueSaldosIEB | null; usd: BloqueSaldosIEB | null; usdExt?: ValorCelda }
  /** Pisa B2. */
  patrimonioTotal?: ValorCelda
  /** Dólar para valuar el saldo USD en B2 cuando no hay DOLARUSA. */
  dolarIEB?: string
  /** Nombres de las hojas (null = la hoja no está). */
  hojas?: { patrimonio?: string | null; saldos?: string | null }
  /** Filas en blanco de más entre bloques (robustez). */
  blancosExtra?: number
  /** Combina A:J en los títulos, como hacen algunos exports. */
  combinarTitulos?: boolean
  /** Hojas adicionales, vacías. */
  otrasHojas?: string[]
}

const D = (x: string | number) => new Decimal(x)

function escalaDe(s: SeccionIEB, p: PosicionIEB): EscalaIEB {
  return p.escala ?? s.escala
}

/** Posición total que calcula IEB: cantidad × precio × escala. */
export function posicionIEB(s: SeccionIEB, p: PosicionIEB): Decimal {
  return D(p.cantidad).times(p.precio).times(escalaDe(s, p))
}

export function esDolarUSA(p: PosicionIEB): boolean {
  return p.especie.trim().toUpperCase().startsWith('DOLARUSA')
}

export function totalSaldos(b: BloqueSaldosIEB): Decimal {
  return [b.hoy, b.h24, b.h48, b.h72, b.mas72].reduce<Decimal>((a, x) => a.plus(x ?? '0'), D(0))
}

function totalInformado(b: BloqueSaldosIEB | null): Decimal | null {
  if (!b) return null
  if (b.total === undefined) return totalSaldos(b)
  if (typeof b.total === 'object' || (typeof b.total === 'string' && b.total.trim() === '-')) return null
  return D(b.total)
}

/** Lo que IEB pondría en B2, con los valores sin adulterar. */
export function patrimonioIEB(p: PortafolioIEB): Decimal {
  let total = D(0)
  let dolar: Decimal | null = p.dolarIEB ? D(p.dolarIEB) : null
  for (const s of p.secciones) {
    for (const x of s.posiciones) {
      total = total.plus(posicionIEB(s, x))
      if (esDolarUSA(x) && dolar === null) dolar = D(x.precio)
    }
  }
  const ars = totalInformado(p.saldos.ars)
  const usd = totalInformado(p.saldos.usd)
  if (ars) total = total.plus(ars)
  if (usd && dolar) total = total.plus(usd.times(dolar))
  return total
}

/** Texto decimal → número de Excel; un número se escribe tal cual; "-" queda texto. */
function celdaValor(v: ValorCelda): string | number {
  if (typeof v === 'number') return v
  if (typeof v === 'object') return v.texto
  return v.trim() === '-' ? '-' : Number(v)
}

const FMT_MONTO = '#,##0.00'
const FMT_CANT = '#,##0'

/** Celda numérica: texto decimal → número de Excel; un doble tal cual; "-" queda texto. */
function escribir(ws: Worksheet, ref: string, valor: ValorCelda | Date | null, numFmt?: string) {
  if (valor === null) return
  const c = ws.getCell(ref)
  c.value = valor instanceof Date ? valor : celdaValor(valor)
  if (numFmt) c.numFmt = numFmt
}

/** Celda de texto. */
function texto(ws: Worksheet, ref: string, valor: string) {
  ws.getCell(ref).value = valor
}

function titulo(ws: Worksheet, fila: number, texto: string, combinar: boolean) {
  ws.getCell(`A${fila}`).value = texto
  if (combinar) ws.mergeCells(`A${fila}:J${fila}`)
}

function hojaPatrimonio(ws: Worksheet, p: PortafolioIEB) {
  const extra = p.blancosExtra ?? 0
  const b2 = p.patrimonioTotal !== undefined ? p.patrimonioTotal : patrimonioIEB(p).toFixed()
  const b2Num = typeof b2 === 'number' ? D(b2) : typeof b2 === 'object' || b2.trim() === '-' ? null : D(b2)
  ws.getCell('A1').value = 'Fecha:'
  const b1 = ws.getCell('B1')
  b1.value = p.b1 !== undefined ? p.b1 : new Date(`${p.fecha}T03:00:00Z`)
  const formatoB1 = p.b1Formato === undefined ? 'dd/mm/yyyy' : p.b1Formato
  if (formatoB1 !== null) b1.numFmt = formatoB1
  ws.getCell('A2').value = 'Patrimonio total'
  escribir(ws, 'B2', b2, FMT_MONTO)
  titulo(ws, 7, 'Tenencia Mercado Argentino', p.combinarTitulos ?? false)

  let r = 9 + extra
  const actualizado = new Date(`${p.fecha}T20:00:00Z`)
  for (const s of p.secciones) {
    titulo(ws, r, s.titulo, p.combinarTitulos ?? false)
    r++
    const encabezado = [
      'Especie',
      'Moneda de emisión',
      'Cantidad',
      'Precio',
      '% del total',
      'PPP',
      'Var%',
      'Resultado',
      'Actualizado',
      'Posición total',
    ]
    encabezado.forEach((t, i) => (ws.getRow(r).getCell(i + 1).value = t))
    r++
    let sumaJ = D(0)
    let sumaPct = D(0)
    let sumaRes: Decimal | null = null
    for (const x of s.posiciones) {
      const e = escalaDe(s, x)
      const j = posicionIEB(s, x)
      const pct = b2Num && !b2Num.isZero() ? j.div(b2Num).times(100).toDecimalPlaces(7) : null
      const res = x.ppp === null ? null : j.minus(D(x.cantidad).times(x.ppp).times(e)).toDecimalPlaces(2)
      const varPct = x.ppp === null || D(x.ppp).isZero() ? null : D(x.precio).div(x.ppp).minus(1).times(100).toDecimalPlaces(2)
      sumaJ = sumaJ.plus(j)
      if (pct) sumaPct = sumaPct.plus(pct)
      if (res) sumaRes = (sumaRes ?? D(0)).plus(res)
      texto(ws, `A${r}`, x.especie)
      texto(ws, `B${r}`, x.moneda ?? 'ARS')
      escribir(ws, `C${r}`, x.cantidadEscrita ?? x.cantidad, FMT_CANT)
      escribir(ws, `D${r}`, x.precioEscrito ?? x.precio, FMT_MONTO)
      escribir(ws, `E${r}`, pct ? pct.toFixed() : '-', FMT_MONTO)
      escribir(ws, `F${r}`, x.ppp ?? '-', FMT_MONTO)
      escribir(ws, `G${r}`, varPct ? varPct.toFixed() : '-', FMT_MONTO)
      escribir(ws, `H${r}`, res ? res.toFixed() : '-', FMT_MONTO)
      escribir(ws, `I${r}`, actualizado, 'hh:mm')
      escribir(ws, `J${r}`, x.posicionEscrita ?? j.toFixed(), FMT_MONTO)
      r++
      const liq = x.liquidacion === undefined ? 'Disponible' : x.liquidacion
      if (liq !== null) {
        texto(ws, `A${r}`, liq)
        texto(ws, `B${r}`, '-')
        escribir(ws, `C${r}`, x.cantidadSubfila ?? x.cantidadEscrita ?? x.cantidad, FMT_CANT)
        escribir(ws, `D${r}`, x.precioEscrito ?? x.precio, FMT_MONTO)
        for (const col of ['E', 'F', 'G', 'H', 'I']) texto(ws, `${col}${r}`, '-')
        escribir(ws, `J${r}`, x.posicionEscrita ?? j.toFixed(), FMT_MONTO)
        r++
      }
      r += 1 + extra // fila en blanco después de cada posición
    }
    if (s.subtotal !== null) {
      texto(ws, `A${r}`, 'Subtotal')
      for (const col of ['B', 'C', 'D', 'F', 'G', 'I']) texto(ws, `${col}${r}`, '-')
      escribir(ws, `E${r}`, sumaPct.toFixed(), FMT_MONTO)
      escribir(ws, `H${r}`, sumaRes ? sumaRes.toFixed() : '-', FMT_MONTO)
      escribir(ws, `J${r}`, s.subtotal !== undefined ? s.subtotal : sumaJ.toFixed(), FMT_MONTO)
      r++
    }
    r += 1 + extra
  }
}

function bloqueSaldos(ws: Worksheet, fila: number, rotulo: string, b: BloqueSaldosIEB, fecha: string): number {
  ws.getCell(`A${fila}`).value = rotulo
  ;['Plazo', 'Fecha', 'Saldo'].forEach((t, i) => (ws.getRow(fila + 1).getCell(i + 1).value = t))
  const dia = (n: number) => {
    const d = new Date(`${fecha}T03:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d
  }
  const filas: [string, Date | string, string | ValorCelda][] = [
    ['Hoy', new Date(`${fecha}T21:15:00Z`), b.hoy],
    ['24h', dia(1), b.h24 ?? '0'],
    ['48h', dia(2), b.h48 ?? '0'],
    ['72h', dia(3), b.h72 ?? '0'],
    ['Más de 72h', '-', b.mas72 ?? '0'],
    ['Garantía de Opciones', '-', b.garantia ?? '0'],
    ['Total', '-', b.total ?? totalSaldos(b).toFixed()],
  ]
  filas.forEach(([plazo, f, saldo], i) => {
    const r = fila + 2 + i
    ws.getCell(`A${r}`).value = plazo
    if (f instanceof Date) escribir(ws, `B${r}`, f, plazo === 'Hoy' ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy')
    else texto(ws, `B${r}`, f)
    escribir(ws, `C${r}`, saldo, FMT_MONTO)
  })
  return fila + 2 + filas.length
}

function hojaSaldos(ws: Worksheet, p: PortafolioIEB) {
  let r = 1
  if (p.saldos.ars) r = bloqueSaldos(ws, r, 'ARS ', p.saldos.ars, p.fecha) + 2
  if (p.saldos.usd) r = bloqueSaldos(ws, r, 'USD ', p.saldos.usd, p.fecha) + 2
  ws.getCell(`A${r}`).value = 'USD Ext. '
  ;['Plazo', 'Fecha', 'Saldo'].forEach((t, i) => (ws.getRow(r + 1).getCell(i + 1).value = t))
  ws.getCell(`A${r + 2}`).value = 'Total'
  ws.getCell(`B${r + 2}`).value = '-'
  escribir(ws, `C${r + 2}`, p.saldos.usdExt ?? '-', FMT_MONTO)
}

/** Arma el .xlsx en memoria. */
export async function construirExcelIEB(p: PortafolioIEB): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook()
  const nombreP = p.hojas?.patrimonio === undefined ? 'Patrimonio' : p.hojas.patrimonio
  const nombreS = p.hojas?.saldos === undefined ? 'Saldos' : p.hojas.saldos
  if (nombreP !== null) hojaPatrimonio(libro.addWorksheet(nombreP), p)
  if (nombreS !== null) hojaSaldos(libro.addWorksheet(nombreS), p)
  for (const n of p.otrasHojas ?? []) libro.addWorksheet(n).getCell('A1').value = 'otra'
  if (libro.worksheets.length === 0) libro.addWorksheet('Hoja1').getCell('A1').value = 'vacía'
  const buf = await libro.xlsx.writeBuffer()
  return new Uint8Array(buf)
}

// ───────────── Portafolios de ejemplo (números inventados) ─────────────

/**
 * Un día con de todo: acciones, bonos (uno con "LETRA"), un CEDEAR comprado
 * hoy (PPP "-", a liquidar), dólares en especie y saldo en pesos negativo.
 */
export function portafolioEjemplo(): PortafolioIEB {
  return {
    fecha: '2026-10-07',
    secciones: [
      {
        titulo: 'Acciones',
        escala: '1',
        posiciones: [{ especie: 'YPFD - YPF', cantidad: '300', precio: '52300', ppp: '48200' }],
      },
      {
        titulo: 'Bonos',
        escala: '0.01',
        posiciones: [
          { especie: 'T30J7 - BONO TESORO NAC. CAP. 30/06/27 $', cantidad: '9000000', precio: '112.4', ppp: '109.76' },
          { especie: 'TXMJ0 - BONO TES NAC TASA DUAL CER/TAMAR 28/6/30', cantidad: '5000000', precio: '103.1', ppp: '100.5' },
          { especie: 'S29Y7 - LETRA DEL TESORO NAC. CAP. 29/05/27', cantidad: '2500000', precio: '104.35', ppp: '101.2' },
        ],
      },
      {
        titulo: 'Cedears',
        escala: '1',
        posiciones: [
          { especie: 'SPY - CEDEAR SPDR S&P 500', cantidad: '1240', precio: '35150', ppp: '30145.16' },
          { especie: 'XOM - CEDEAR EXXON MOBIL CORP', cantidad: '47', precio: '2873.65', ppp: null, liquidacion: 'Liquidar' },
        ],
      },
      {
        titulo: 'Otros',
        escala: '1',
        posiciones: [{ especie: 'DOLARUSA - DOLARES USA ESP 7000', moneda: 'USD', cantidad: '23.4', precio: '1611', ppp: null }],
      },
    ],
    saldos: {
      // Hoy es bruto; Total, neto de lo que falta liquidar (la compra de XOM
      // con comisiones, a 24 h): 50.000 − 135.500 = −85.500.
      ars: { hoy: '50000', h24: '-135500' },
      usd: { hoy: '4182.2' },
    },
  }
}

/** El set de IEB del Apéndice B de docs/vision.md (mié 14/10): B2 = $80.830.000,00. */
export function portafolioApendiceB(): PortafolioIEB {
  return {
    fecha: '2026-10-14',
    secciones: [
      { titulo: 'Acciones', escala: '1', posiciones: [{ especie: 'YPFD - YPF', cantidad: '300', precio: '52300', ppp: '48200' }] },
      {
        titulo: 'Bonos',
        escala: '0.01',
        posiciones: [
          { especie: 'T30J7 - BONO TESORO NAC. CAP. 30/06/27 $', cantidad: '9000000', precio: '112.4', ppp: '109.76' },
          { especie: 'TXMJ0 - BONO TES NAC TASA DUAL CER/TAMAR 28/6/30', cantidad: '5000000', precio: '103.1', ppp: '100.5' },
        ],
      },
      { titulo: 'Cedears', escala: '1', posiciones: [{ especie: 'SPY - CEDEAR SPDR S&P 500', cantidad: '1240', precio: '35150', ppp: '30145.16' }] },
      {
        titulo: 'Otros',
        escala: '1',
        posiciones: [{ especie: 'DOLARUSA - DOLARES USA ESP 7000', moneda: 'USD', cantidad: '23.4', precio: '1540', ppp: null }],
      },
    ],
    // US$ 4.200 = 4.176,60 de saldo + 23,40 de DOLARUSA; pesos: −185.000 (inventados, D-24).
    saldos: { ars: { hoy: '-185000' }, usd: { hoy: '4176.6' } },
  }
}
