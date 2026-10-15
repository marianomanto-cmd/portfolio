// Lector del cuadro de marcha del leasing en CSV (lector "cuadro-marcha-csv@1",
// D-141). Puro: recibe el texto y devuelve las cuotas, la opción de compra, los
// cargos extra, los errores (con fila y columna) y las advertencias. No inventa
// nada: guarda lo que dice la planilla (lo facturado, sin derivar: D-142).
//
// Formato real (encabezado del dueño; los montos de los ejemplos son inventados):
//   nro_cuota,fecha_vencimiento,mes_del_canon,canon_neto,seguro_neto,subtotal_neto,
//   iva_21,percepcion_iva_rg3337,total_cuota,pagado,origen_seguro,origen_percepcion
// - separador coma (también punto y coma o tabulador), punto decimal (también
//   "1.234.567,89" entre comillas), fechas AAAA-MM-DD, mes del canon AAAA-MM: el
//   canon del mes M vence el día 1 de M+1;
// - pagado SI o NO; origen_seguro comprobante | CONFIRMAR | contrato; origen_percepcion
//   comprobante | SUPUESTO | n/a. n/a = no aplica (el monto tiene que ser 0 o vacío);
// - una percepción 0.00 de comprobante es un cero real (esa factura no la tuvo);
// - la fila "OC" es la opción de compra: no es una cuota, va a la revisión para
//   compararla con el contrato;
// - una fila cuyo número no es una cuota ni OC es un cargo extra si dice qué es
//   (multa, comisión, reserva de fondos, interés u otro, con la cuota si la trae:
//   "multa 15"); su importe es el total. Si no se reconoce, error con fila y columna.

import { Decimal, leerNumeroAR, monto } from '@/lib/domain/dinero'
import type { CargoExtra, ContratoPasivo, Cuota, FuenteCuota } from '@/lib/domain/pasivos/tipos'
import type { Fecha } from '@/lib/domain/tipos'

export const LECTOR_CUADRO = 'cuadro-marcha-csv@1'

/** Una cuota tal como la dice la planilla (montos como texto decimal, D-32). */
export interface CuotaLeida {
  fila: number
  nro: number
  fecha_vencimiento: Fecha
  periodo: Fecha | null
  canon_neto: string
  seguro: string
  iva_canon: string
  otros_conceptos: string
  total: string
  estado: 'facturada' | 'proyectada'
  fuente_canon: Exclude<FuenteCuota, 'no_aplica'>
  fuente_seguro: FuenteCuota
  fuente_otros: FuenteCuota
  pagada: boolean
}

export interface OpcionLeida {
  fila: number
  fecha: Fecha
  neto: string
  iva: string
  total: string
}

export interface CargoLeido {
  fila: number
  fecha: Fecha
  concepto: CargoExtra['concepto']
  detalle: string | null
  importe: string
  cuota_nro: number | null
  fuente: Exclude<FuenteCuota, 'no_aplica'>
}

export interface ErrorLectura {
  fila: number | null
  columna: string | null
  mensaje: string
}

export interface LecturaCuadro {
  filas: CuotaLeida[]
  opcion: OpcionLeida | null
  cargos: CargoLeido[]
  errores: ErrorLectura[]
  advertencias: string[]
  /** El separador que se usó, para la revisión. */
  separador: ',' | ';' | '\t'
}

// ───────────── CSV ─────────────

/** Separa un CSV respetando comillas ("1.234,56", comillas dobles escapadas). */
export function partirCsv(texto: string, sep: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let comillas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (comillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          celda += '"'
          i++
        } else comillas = false
      } else celda += ch
      continue
    }
    if (ch === '"') comillas = true
    else if (ch === sep) {
      fila.push(celda)
      celda = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      fila.push(celda)
      filas.push(fila)
      fila = []
      celda = ''
    } else celda += ch
  }
  if (celda !== '' || fila.length) {
    fila.push(celda)
    filas.push(fila)
  }
  return filas
}

function detectarSeparador(linea: string): ',' | ';' | '\t' {
  const contar = (c: string) => linea.split(c).length - 1
  const [pc, c, t] = [contar(';'), contar(','), contar('\t')]
  if (t > pc && t > c) return '\t'
  return pc > c ? ';' : ','
}

/** "Percepción IVA RG 3337" → "percepcion_iva_rg_3337". */
export function normalizarEncabezado(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/%/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

type Columna =
  | 'nro'
  | 'vencimiento'
  | 'mes'
  | 'canon'
  | 'seguro'
  | 'subtotal'
  | 'iva'
  | 'percepcion'
  | 'total'
  | 'pagado'
  | 'origen_seguro'
  | 'origen_percepcion'
  | 'origen'

const SINONIMOS: Record<Columna, string[]> = {
  nro: ['nro_cuota', 'nro', 'cuota', 'n_cuota', 'numero_cuota', 'numero', 'n', 'nro_de_cuota'],
  vencimiento: ['fecha_vencimiento', 'vencimiento', 'vto', 'fecha_vto', 'vence', 'fecha_de_vencimiento', 'fecha'],
  mes: ['mes_del_canon', 'mes_canon', 'periodo', 'mes', 'mes_de_canon'],
  canon: ['canon_neto', 'canon'],
  seguro: ['seguro_neto', 'seguro'],
  subtotal: ['subtotal_neto', 'subtotal'],
  iva: ['iva_21', 'iva', 'iva_21_'],
  percepcion: ['percepcion_iva_rg3337', 'percepcion_iva_rg_3337', 'percepcion_rg_3337', 'percepcion_rg3337', 'percepcion', 'percepcion_iva', 'rg3337', 'rg_3337'],
  total: ['total_cuota', 'total', 'total_de_la_cuota'],
  pagado: ['pagado', 'pagada', 'paga', 'pago'],
  origen_seguro: ['origen_seguro', 'fuente_seguro'],
  origen_percepcion: ['origen_percepcion', 'fuente_percepcion'],
  origen: ['origen', 'fuente', 'estado'],
}

const NOMBRE_COLUMNA: Record<Columna, string> = {
  nro: 'nro_cuota',
  vencimiento: 'fecha_vencimiento',
  mes: 'mes_del_canon',
  canon: 'canon_neto',
  seguro: 'seguro_neto',
  subtotal: 'subtotal_neto',
  iva: 'iva_21',
  percepcion: 'percepcion_iva_rg3337',
  total: 'total_cuota',
  pagado: 'pagado',
  origen_seguro: 'origen_seguro',
  origen_percepcion: 'origen_percepcion',
  origen: 'origen',
}

const TOLERANCIA = new Decimal('0.01')
const $ = (d: Decimal) => monto(d, 'ARS', { decimales: 2 })

function fechaValida(s: string): Fecha | null {
  const t = s.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  let a: number, mes: number, d: number
  if (m) [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
    if (!m) return null
    ;[d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  const f = new Date(Date.UTC(a, mes - 1, d))
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null
  return `${String(a).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function mesValido(s: string): Fecha | null {
  const t = s.trim()
  let m = /^(\d{4})-(\d{2})(?:-01)?$/.exec(t)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2]}-01`
  m = /^(\d{1,2})\/(\d{4})$/.exec(t)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${m[1].padStart(2, '0')}-01`
  return null
}

function siNo(s: string): boolean | null {
  const t = normalizarEncabezado(s)
  if (['si', 's', 'x', 'yes', 'true', '1', 'pagado', 'pagada'].includes(t)) return true
  if (['no', 'n', 'false', '0', ''].includes(t)) return false
  return null
}

/** Lo que dice una columna de origen: comprobante, CONFIRMAR, SUPUESTO, contrato o n/a. */
function leerOrigen(s: string): FuenteCuota | null | 'vacio' {
  const t = normalizarEncabezado(s)
  if (t === '') return 'vacio'
  if (t === 'comprobante' || t === 'factura' || t === 'facturado' || t === 'facturada') return 'comprobante'
  if (t === 'confirmar' || t === 'a_confirmar') return 'a_confirmar'
  if (t === 'supuesto' || t === 'supuesta') return 'supuesto'
  if (t === 'contrato') return 'contrato'
  if (t === 'n_a' || t === 'na' || t === 'no_aplica') return 'no_aplica'
  return null
}

const CONCEPTOS: { re: RegExp; concepto: CargoExtra['concepto'] }[] = [
  { re: /^multas?(?=_|$)/, concepto: 'multa' },
  { re: /^(comision|comisiones)(?=_|$)/, concepto: 'comision' },
  { re: /^(reserva|reservas)(_de)?(_fondos?)?(?=_|$)/, concepto: 'reserva_fondos' },
  { re: /^(interes|intereses)(?=_|$)/, concepto: 'interes' },
  { re: /^(otro|otros|cargo|cargos)(_cargos?)?(?=_|$)/, concepto: 'otro' },
]

function leerConcepto(s: string): { concepto: CargoExtra['concepto']; cuota: number | null } | null {
  const t = normalizarEncabezado(s)
  for (const c of CONCEPTOS) {
    if (c.re.test(t)) {
      const n = /(?:^|_)(\d{1,4})(?:_|$)/.exec(t.replace(c.re, ''))
      return { concepto: c.concepto, cuota: n ? Number(n[1]) : null }
    }
  }
  return null
}

const ES_OPCION = /^(oc|opcion|opcion_compra|opcion_de_compra)$/

/**
 * Lee el CSV del cuadro de marcha. `cuotasTotales`, si se pasa, es el total del
 * contrato: una cuota de más es un error.
 */
export function leerCuadroMarcha(texto: string, opciones: { cuotasTotales?: number } = {}): LecturaCuadro {
  const errores: ErrorLectura[] = []
  const advertencias: string[] = []
  const limpio = texto.replace(/^﻿/, '')
  const primera = limpio.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const separador = detectarSeparador(primera)
  const tabla = partirCsv(limpio, separador).filter((f) => f.some((c) => c.trim() !== ''))
  const vacia: LecturaCuadro = { filas: [], opcion: null, cargos: [], errores, advertencias, separador }
  if (tabla.length < 2) {
    errores.push({ fila: null, columna: null, mensaje: 'El archivo no tiene filas: hace falta el encabezado y al menos una cuota.' })
    return vacia
  }

  // Encabezado: cada columna conocida, por su nombre o un sinónimo.
  const encabezado = tabla[0].map(normalizarEncabezado)
  const idx = {} as Record<Columna, number>
  for (const col of Object.keys(SINONIMOS) as Columna[]) {
    idx[col] = -1
    for (const s of SINONIMOS[col]) {
      const i = encabezado.indexOf(s)
      if (i >= 0 && !Object.values(idx).includes(i)) {
        idx[col] = i
        break
      }
    }
  }
  const obligatorias: Columna[] = ['nro', 'vencimiento', 'canon', 'total', 'pagado']
  const faltan = obligatorias.filter((c) => idx[c] < 0)
  if (faltan.length) {
    errores.push({
      fila: 1,
      columna: null,
      mensaje: `Al encabezado le faltan columnas: ${faltan.map((c) => NOMBRE_COLUMNA[c]).join(', ')}. Se esperan nro_cuota, fecha_vencimiento, mes_del_canon, canon_neto, seguro_neto, subtotal_neto, iva_21, percepcion_iva_rg3337, total_cuota, pagado, origen_seguro y origen_percepcion.`,
    })
    return vacia
  }

  const filas: CuotaLeida[] = []
  const cargos: CargoLeido[] = []
  let opcion: OpcionLeida | null = null

  for (let i = 1; i < tabla.length; i++) {
    const fila = i + 1 // como la ve el dueño en la planilla, con el encabezado en la 1
    const celdas = tabla[i]
    const cel = (c: Columna) => (idx[c] >= 0 ? (celdas[idx[c]] ?? '').trim() : '')
    const err = (c: Columna | null, mensaje: string) => errores.push({ fila, columna: c ? NOMBRE_COLUMNA[c] : null, mensaje })
    const numero = (c: Columna, requerido: boolean): Decimal | null => {
      const v = cel(c)
      if (v === '') {
        if (requerido) err(c, 'falta el monto.')
        return null
      }
      const n = leerNumeroAR(v)
      if (n === null) {
        err(c, `no entiendo "${v}" como número.`)
        return null
      }
      const d = new Decimal(n)
      if (d.isNegative()) {
        err(c, `el monto no puede ser negativo (${v}).`)
        return null
      }
      return d
    }
    const rotuloNro = cel('nro')
    const nroNorm = normalizarEncabezado(rotuloNro)

    // ── Opción de compra ──
    if (ES_OPCION.test(nroNorm)) {
      const fecha = fechaValida(cel('vencimiento'))
      if (!fecha) err('vencimiento', `fecha inválida "${cel('vencimiento')}" (se espera AAAA-MM-DD).`)
      const neto = numero('canon', true)
      const iva = numero('iva', false) ?? new Decimal(0)
      const seguro = numero('seguro', false) ?? new Decimal(0)
      const per = numero('percepcion', false) ?? new Decimal(0)
      const total = numero('total', true)
      if (neto && total && !neto.plus(seguro).plus(iva).plus(per).minus(total).abs().lte(TOLERANCIA)) {
        err('total', `la opción de compra dice ${$(total)} y neto + IVA da ${$(neto.plus(seguro).plus(iva).plus(per))}.`)
      }
      if (siNo(cel('pagado')) === true) advertencias.push(`Fila ${fila}: la planilla dice que la opción de compra está pagada; la app la toma del contrato y no la marca pagada.`)
      if (opcion) err('nro', 'hay dos filas de opción de compra.')
      if (fecha && neto && total) opcion = { fila, fecha, neto: neto.toFixed(), iva: iva.toFixed(), total: total.toFixed() }
      continue
    }

    // ── Cargo extra ──
    if (!/^\d+$/.test(rotuloNro)) {
      const concepto = leerConcepto(rotuloNro)
      if (!concepto) {
        err('nro', `no reconozco "${rotuloNro || '(vacío)'}": no es un número de cuota, ni la opción de compra (OC), ni un cargo (multa, comisión, reserva de fondos, interés u otro).`)
        continue
      }
      const fecha = fechaValida(cel('vencimiento'))
      if (!fecha) err('vencimiento', `fecha inválida "${cel('vencimiento')}" (se espera AAAA-MM-DD).`)
      const importe = numero('total', true)
      if (importe && importe.isZero()) err('total', 'un cargo de $ 0 no es un cargo.')
      const os = leerOrigen(cel('origen_seguro'))
      const op = leerOrigen(cel('origen_percepcion'))
      const og = idx.origen >= 0 ? leerOrigen(cel('origen')) : 'vacio'
      const conocida = [os, op, og].find((o) => o !== null && o !== 'vacio' && o !== 'no_aplica') as Exclude<FuenteCuota, 'no_aplica'> | undefined
      const pagado = siNo(cel('pagado'))
      const fuente = conocida ?? (pagado ? 'comprobante' : undefined)
      if (!fuente) err('origen_seguro', 'el cargo no dice de dónde sale (comprobante, CONFIRMAR, SUPUESTO o contrato).')
      const mes = cel('mes')
      const detalle = mes && !mesValido(mes) ? mes.slice(0, 200) : rotuloNro.slice(0, 200)
      if (fecha && importe && !importe.isZero() && fuente) {
        cargos.push({ fila, fecha, concepto: concepto.concepto, detalle, importe: importe.toFixed(), cuota_nro: concepto.cuota, fuente })
      }
      continue
    }

    // ── Cuota ──
    const nro = Number(rotuloNro)
    if (!Number.isSafeInteger(nro) || nro < 1 || nro > 32767) {
      err('nro', `número de cuota inválido "${rotuloNro}".`)
      continue
    }
    const venc = fechaValida(cel('vencimiento'))
    if (!venc) err('vencimiento', `fecha inválida "${cel('vencimiento')}" (se espera AAAA-MM-DD).`)
    let periodo: Fecha | null = null
    if (idx.mes >= 0 && cel('mes') !== '') {
      periodo = mesValido(cel('mes'))
      if (!periodo) err('mes', `mes inválido "${cel('mes')}" (se espera AAAA-MM).`)
    }
    const pagado = siNo(cel('pagado'))
    if (pagado === null) err('pagado', `no entiendo "${cel('pagado')}": se espera SI o NO.`)

    // Fuente por campo: origen_seguro → seguro, origen_percepcion → percepción; una columna "origen" sola vale para los dos.
    const origenDe = (c: 'origen_seguro' | 'origen_percepcion'): FuenteCuota | null => {
      const propio = idx[c] >= 0 ? leerOrigen(cel(c)) : 'vacio'
      const general = idx.origen >= 0 ? leerOrigen(cel('origen')) : 'vacio'
      const o = propio !== 'vacio' ? propio : general
      if (o === null) {
        err(propio !== 'vacio' ? c : 'origen', `no entiendo "${cel(propio !== 'vacio' ? c : 'origen')}": se espera comprobante, CONFIRMAR, SUPUESTO, contrato o n/a.`)
        return null
      }
      if (o === 'vacio') {
        // Sin origen: una pagada viene del comprobante; una impaga no se adivina.
        if (pagado) return 'comprobante'
        err(idx[c] >= 0 ? c : 'origen', 'falta de dónde sale el monto (comprobante, CONFIRMAR, SUPUESTO o contrato).')
        return null
      }
      return o
    }
    const fs = origenDe('origen_seguro')
    const fp = origenDe('origen_percepcion')

    const canon = numero('canon', true)
    const montoCampo = (c: 'seguro' | 'percepcion', fuente: FuenteCuota | null): Decimal | null => {
      const v = numero(c, fuente !== 'no_aplica')
      if (fuente === 'no_aplica') {
        if (v && !v.isZero()) err(c, `dice n/a pero trae un monto (${cel(c)}): n/a es sin monto.`)
        return new Decimal(0)
      }
      return v
    }
    const seguro = idx.seguro >= 0 ? montoCampo('seguro', fs) : new Decimal(0)
    const per = idx.percepcion >= 0 ? montoCampo('percepcion', fp) : new Decimal(0)
    const iva = idx.iva >= 0 ? numero('iva', true) : new Decimal(0)
    const total = numero('total', true)
    const subtotal = idx.subtotal >= 0 ? numero('subtotal', false) : null

    if (canon && seguro && subtotal && !canon.plus(seguro).minus(subtotal).abs().lte(TOLERANCIA)) {
      err('subtotal', `dice ${$(subtotal)} y canon + seguro da ${$(canon.plus(seguro))}.`)
    }
    if (canon && seguro && per && iva && total && !canon.plus(seguro).plus(iva).plus(per).minus(total).abs().lte(TOLERANCIA)) {
      err('total', `dice ${$(total)} y canon + seguro + IVA + percepción da ${$(canon.plus(seguro).plus(iva).plus(per))}.`)
    }

    // Estado: facturada si sus montos son de comprobante (o no aplican); una pagada tiene factura.
    const fuentes = [fs, fp]
    const deComprobante = fuentes.every((f) => f === 'comprobante' || f === 'no_aplica') && fuentes.some((f) => f === 'comprobante')
    if (pagado && fs && fp && !deComprobante) {
      err(fs !== 'comprobante' && fs !== 'no_aplica' ? 'origen_seguro' : 'origen_percepcion', 'una cuota pagada tiene factura: sus orígenes tienen que decir comprobante.')
    } else if (!pagado && fs && fp && !deComprobante && fuentes.includes('comprobante')) {
      // Lo mismo que rechaza la base (una sin factura no tiene nada de comprobante), dicho antes del Enter.
      err(fp === 'comprobante' ? 'origen_percepcion' : 'origen_seguro', 'mezcla comprobante con CONFIRMAR, SUPUESTO o contrato: una cuota facturada tiene todo de comprobante (o n/a) y una sin factura, nada.')
    }
    const estado: CuotaLeida['estado'] = deComprobante || pagado ? 'facturada' : 'proyectada'
    if (estado === 'facturada' && per && per.isZero() && fp === 'comprobante') {
      advertencias.push(`Cuota ${nro}: la percepción es $ 0 de comprobante; se toma como un cero real (esa factura no la tuvo).`)
    }
    if (!venc || !canon || !seguro || !per || !iva || !total || pagado === null || !fs || !fp) continue
    filas.push({
      fila,
      nro,
      fecha_vencimiento: venc,
      periodo,
      canon_neto: canon.toFixed(),
      seguro: seguro.toFixed(),
      iva_canon: iva.toFixed(),
      otros_conceptos: per.toFixed(),
      total: total.toFixed(),
      estado,
      fuente_canon: estado === 'facturada' ? 'comprobante' : 'contrato',
      fuente_seguro: fs,
      fuente_otros: fp,
      pagada: pagado,
    })
  }

  // Controles del conjunto: sin repetidos, sin huecos, vencimientos crecientes, no más que el contrato.
  const vistos = new Map<number, number>()
  for (const f of filas) {
    if (vistos.has(f.nro)) errores.push({ fila: f.fila, columna: 'nro_cuota', mensaje: `la cuota ${f.nro} ya está en la fila ${vistos.get(f.nro)}.` })
    else vistos.set(f.nro, f.fila)
  }
  const nros = [...vistos.keys()].sort((a, b) => a - b)
  if (nros.length) {
    const huecos: number[] = []
    for (let n = 1; n <= nros[nros.length - 1]; n++) if (!vistos.has(n)) huecos.push(n)
    if (huecos.length) errores.push({ fila: null, columna: 'nro_cuota', mensaje: `faltan las cuotas ${huecos.slice(0, 12).join(', ')}${huecos.length > 12 ? '…' : ''}: el cuadro va de la 1 a la última sin huecos.` })
  }
  const orden = [...filas].sort((a, b) => a.nro - b.nro)
  for (let k = 1; k < orden.length; k++) {
    if (orden[k].fecha_vencimiento <= orden[k - 1].fecha_vencimiento) {
      errores.push({ fila: orden[k].fila, columna: 'fecha_vencimiento', mensaje: `la cuota ${orden[k].nro} vence el ${orden[k].fecha_vencimiento}, no después de la ${orden[k - 1].nro}.` })
    }
  }
  if (opciones.cuotasTotales !== undefined && nros.length && nros[nros.length - 1] > opciones.cuotasTotales) {
    errores.push({ fila: null, columna: 'nro_cuota', mensaje: `el cuadro llega a la cuota ${nros[nros.length - 1]} y el contrato tiene ${opciones.cuotasTotales}.` })
  }
  if (!filas.length && !cargos.length && !errores.length) errores.push({ fila: null, columna: null, mensaje: 'El archivo no trae ninguna cuota.' })
  return { filas: orden, opcion, cargos, errores, advertencias, separador }
}

// ───────────── De la lectura al dominio y a la revisión ─────────────

/** Las cuotas leídas como cuotas del dominio (para la vista previa y el demo). */
export function aCuotas(l: Pick<LecturaCuadro, 'filas'>, pasivo_id: number, carga_id: number): Cuota[] {
  return l.filas.map((f) => ({
    pasivo_id,
    nro: f.nro,
    fecha_vencimiento: f.fecha_vencimiento,
    periodo: f.periodo,
    canon_neto: new Decimal(f.canon_neto),
    iva_canon: new Decimal(f.iva_canon),
    seguro: new Decimal(f.seguro),
    otros_conceptos: new Decimal(f.otros_conceptos),
    estado: f.estado,
    fuente_canon: f.fuente_canon,
    fuente_seguro: f.fuente_seguro,
    fuente_otros: f.fuente_otros,
    pagada: f.pagada,
    fecha_pago: null,
    monto_pagado: null,
    cuenta_pago_id: null,
    ccl_del_dia_pago: null,
    ccl_fuente: null,
    pagador: null,
    base_ganancias: null,
    carga_id,
    notas: null,
  }))
}

/** Los cargos leídos como cargos del dominio. */
export function aCargos(l: Pick<LecturaCuadro, 'cargos'>, pasivo_id: number, carga_id: number): CargoExtra[] {
  return l.cargos.map((k, i) => ({
    id: -(i + 1),
    pasivo_id,
    fecha: k.fecha,
    concepto: k.concepto,
    detalle: k.detalle,
    importe: new Decimal(k.importe),
    cuota_nro: k.cuota_nro,
    fuente: k.fuente,
    anulado: false,
    carga_id,
    notas: null,
  }))
}

/** Lo que muestra la revisión antes del Enter (con la forma de la bandeja de Cargar). */
export interface RevisionCuadro {
  leidas: number
  facturadas: number
  proyectadas: number
  pagadas: number
  /** Contra lo que ya está en la app. */
  nuevas: number
  actualizadas: number
  iguales: number
  /** Qué cambia en cada cuota que ya estaba en la app (la planilla actualizada pisa lo proyectado). */
  cambios: { nro: number; campos: string[] }[]
  a_confirmar: { seguro: number; percepcion: number }
  supuestas: { seguro: number; percepcion: number }
  cargos: number
  opcion: {
    leida: OpcionLeida | null
    contrato: { neto: string | null; fecha: Fecha | null }
    estado: 'igual' | 'distinta' | 'falta_en_contrato' | 'sin_fila'
  }
  /** Los de la lectura más los que salen de comparar con la app y el contrato. Frenan el Enter. */
  errores: ErrorLectura[]
  advertencias: string[]
  /** Control de salida: la suma de la columna total de la planilla y la de canon + IVA + seguro + percepción. */
  total_planilla: string
  total_app: string
}

/** Compara la lectura con el contrato y con las cuotas que ya están en la app. */
/** [3, 5, 6, 7, 9] → "3, 5 a 7 y 9". */
function tramos(nros: number[]): string {
  const partes: string[] = []
  for (let i = 0; i < nros.length; ) {
    let j = i
    while (j + 1 < nros.length && nros[j + 1] === nros[j] + 1) j++
    partes.push(j > i ? `${nros[i]} a ${nros[j]}` : String(nros[i]))
    i = j + 1
  }
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0]
}

export function revisarCuadro(
  l: LecturaCuadro,
  contrato: Pick<ContratoPasivo, 'cuotas_totales' | 'opcion_compra_neto' | 'opcion_compra_fecha'>,
  actuales: readonly Cuota[],
): RevisionCuadro {
  const errores = [...l.errores]
  const porNro = new Map(actuales.map((c) => [c.nro, c]))
  let nuevas = 0
  let actualizadas = 0
  let iguales = 0
  const cambios: RevisionCuadro['cambios'] = []
  for (const f of l.filas) {
    const a = porNro.get(f.nro)
    if (f.nro > contrato.cuotas_totales) {
      errores.push({ fila: f.fila, columna: 'nro_cuota', mensaje: `la cuota ${f.nro} no existe: el contrato tiene ${contrato.cuotas_totales} cuotas.` })
    }
    if (!a) {
      nuevas++
      continue
    }
    if (a.estado === 'facturada' && f.estado === 'proyectada') {
      errores.push({ fila: f.fila, columna: 'origen_seguro', mensaje: `la cuota ${f.nro} ya tiene factura en la app y la planilla la trae sin factura: corregila desde su fila.` })
    }
    if (a.pagada && !f.pagada) {
      errores.push({ fila: f.fila, columna: 'pagado', mensaje: `la cuota ${f.nro} figura pagada en la app y la planilla dice que no: corregila desde su fila.` })
    }
    const campos = [
      a.estado !== f.estado ? (f.estado === 'facturada' ? 'pasa a facturada' : 'pasa a proyectada') : null,
      a.pagada !== f.pagada ? (f.pagada ? 'pagada' : 'impaga') : null,
      a.fecha_vencimiento !== f.fecha_vencimiento ? 'vencimiento' : null,
      a.canon_neto.eq(f.canon_neto) ? null : 'canon',
      a.seguro.eq(f.seguro) ? null : 'seguro',
      a.iva_canon.eq(f.iva_canon) ? null : 'IVA',
      a.otros_conceptos.eq(f.otros_conceptos) ? null : 'percepción',
      a.fuente_seguro !== f.fuente_seguro ? 'origen del seguro' : null,
      a.fuente_otros !== f.fuente_otros ? 'origen de la percepción' : null,
    ].filter((x): x is string => x !== null)
    if (!campos.length) iguales++
    else {
      actualizadas++
      cambios.push({ nro: f.nro, campos })
    }
  }
  // Un cargo que dice una cuota que el contrato no tiene: es un error del archivo (no se adivina a cuál va).
  for (const k of l.cargos) {
    if (k.cuota_nro !== null && k.cuota_nro > contrato.cuotas_totales) {
      errores.push({ fila: k.fila, columna: 'nro_cuota', mensaje: `el cargo dice la cuota ${k.cuota_nro} y el contrato tiene ${contrato.cuotas_totales} cuotas.` })
    }
  }
  const o = l.opcion
  const cn = contrato.opcion_compra_neto
  const estadoOpcion: RevisionCuadro['opcion']['estado'] = !o
    ? 'sin_fila'
    : cn === null || contrato.opcion_compra_fecha === null
      ? 'falta_en_contrato'
      : cn.eq(o.neto) && contrato.opcion_compra_fecha === o.fecha
        ? 'igual'
        : 'distinta'
  const suma = (xs: string[]) => xs.reduce((s, x) => s.plus(x), new Decimal(0))
  // Una planilla corta (o un cuadro que queda con huecos): esos meses quedan "sin dato" en Flujo y en Hoy.
  const quedan = new Set([...actuales.map((c) => c.nro), ...l.filas.map((f) => f.nro)])
  const faltan = Array.from({ length: contrato.cuotas_totales }, (_, i) => i + 1).filter((n) => !quedan.has(n))
  const advertencias = [...l.advertencias]
  if (l.filas.length && faltan.length) {
    advertencias.push(
      `Con esta planilla quedan ${quedan.size} de las ${contrato.cuotas_totales} cuotas del contrato: ${faltan.length === 1 ? 'falta la cuota' : 'faltan las cuotas'} ${tramos(faltan)}. Hasta que importes la planilla completa, la tasa del contrato y la deuda según el cuadro quedan sin dato (se resta tu estimado, si lo hay), y el mes de cada cuota que falta queda sin dato en Flujo, Hoy y Evolución.`,
    )
  }
  return {
    leidas: l.filas.length,
    facturadas: l.filas.filter((f) => f.estado === 'facturada').length,
    proyectadas: l.filas.filter((f) => f.estado === 'proyectada').length,
    pagadas: l.filas.filter((f) => f.pagada).length,
    nuevas,
    actualizadas,
    iguales,
    cambios,
    a_confirmar: { seguro: l.filas.filter((f) => f.fuente_seguro === 'a_confirmar').length, percepcion: l.filas.filter((f) => f.fuente_otros === 'a_confirmar').length },
    supuestas: { seguro: l.filas.filter((f) => f.fuente_seguro === 'supuesto').length, percepcion: l.filas.filter((f) => f.fuente_otros === 'supuesto').length },
    cargos: l.cargos.length,
    opcion: { leida: o, contrato: { neto: cn === null ? null : cn.toFixed(), fecha: contrato.opcion_compra_fecha }, estado: estadoOpcion },
    errores,
    advertencias,
    total_planilla: suma(l.filas.map((f) => f.total)).toFixed(2),
    total_app: suma(l.filas.map((f) => new Decimal(f.canon_neto).plus(f.seguro).plus(f.iva_canon).plus(f.otros_conceptos).toFixed())).toFixed(2),
  }
}
