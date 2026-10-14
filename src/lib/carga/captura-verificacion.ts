// Lectura de capturas (Galicia y Mercado Pago): todo lo determinístico (D-11,
// D-12, D-36, D-37). El modelo solo transcribe texto; acá se parsea en formato
// es-AR, se comparan las dos lecturas celda por celda, se verifica la
// aritmética con una tolerancia que sale de los decimales mostrados y se arma
// la LecturaCuenta que consume la conciliación (conciliar.ts).
//
// Funciones puras: sin red, sin SDK, sin 'server-only'. La llamada al modelo
// está en captura.ts.

import { z } from 'zod'
import { calc, sinDato, vista, type Calc, type CalcVista } from '@/lib/domain/calc'
import { Decimal, leerNumeroAR, numero } from '@/lib/domain/dinero'
import type { Fecha, Moneda, TipoActivo } from '@/lib/domain/tipos'
import type {
  Alternativa,
  Chequeo,
  ControlLeido,
  EstadoFila,
  FilaLeida,
  LecturaCuenta,
  NombreCuenta,
  SaldoLeido,
} from './contratos'

export const VERSION_LECTOR = 'captura-claude@1'

// ───────────── Errores visibles ─────────────

export type CodigoErrorCaptura =
  | 'sin_clave' // falta ANTHROPIC_API_KEY
  | 'clave_invalida'
  | 'imagen_vacia'
  | 'tipo_imagen' // formato no admitido
  | 'imagen_grande' // la API la rechaza por tamaño: nunca se achica sin avisar
  | 'no_reconocida' // no es Galicia ni Mercado Pago
  | 'fuente_dudosa' // las lecturas no coinciden en el banco
  | 'ilegible' // el dato principal no se pudo leer
  | 'rechazo' // stop_reason refusal
  | 'cortada' // stop_reason max_tokens
  | 'tiempo' // más de 60 s
  | 'sobrecarga' // 529 overloaded
  | 'limite' // 429
  | 'json_invalido' // la salida no respeta el esquema
  | 'modelo' // modelo inexistente o sin permiso
  | 'conexion'
  | 'api'

/**
 * Error que la pantalla de carga puede mostrar tal cual: "No pude leer la
 * captura de Galicia: la segunda lectura (claude-sonnet-5-5) tardó más de 60 s".
 */
export class ErrorCaptura extends Error {
  readonly codigo: CodigoErrorCaptura
  /** Lo que pasó, sin el "No pude leer la captura…" de adelante. */
  readonly detalle: string
  readonly cuenta: NombreCuenta | null
  /** Reintentar puede andar (tiempo, sobrecarga, límite, conexión). */
  readonly reintentable: boolean

  constructor(
    codigo: CodigoErrorCaptura,
    detalle: string,
    opciones: { cuenta?: NombreCuenta | null; reintentable?: boolean; mensaje?: string } = {},
  ) {
    const cuenta = opciones.cuenta ?? null
    super(opciones.mensaje ?? `No pude leer la captura${cuenta ? ` de ${cuenta}` : ''}: ${detalle}`)
    this.name = 'ErrorCaptura'
    this.codigo = codigo
    this.detalle = detalle
    this.cuenta = cuenta
    this.reintentable = opciones.reintentable ?? false
  }

  /** El mismo error, nombrando la cuenta (cuando se supo después). */
  conCuenta(cuenta: NombreCuenta | null): ErrorCaptura {
    if (this.codigo === 'sin_clave' || cuenta === this.cuenta) return this
    return new ErrorCaptura(this.codigo, this.detalle, { cuenta, reintentable: this.reintentable })
  }
}

// ───────────── Imagen ─────────────

export type TipoImagen = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

const ADMITIDOS: Record<string, TipoImagen> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
}

function empiezaCon(b: Uint8Array, firma: number[], desde = 0): boolean {
  if (b.length < desde + firma.length) return false
  return firma.every((x, i) => b[desde + i] === x)
}

/** Tipo real de la imagen según sus primeros bytes (null si no es PNG/JPEG/WebP/GIF). */
export function tipoPorFirma(b: Uint8Array): TipoImagen | 'heic' | null {
  if (empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (empiezaCon(b, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (empiezaCon(b, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (empiezaCon(b, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  // ISO-BMFF "ftyp" + marca HEIF/HEIC (capturas del iPhone sin convertir).
  if (empiezaCon(b, [0x66, 0x74, 0x79, 0x70], 4)) {
    const marca = String.fromCharCode(...b.slice(8, 12))
    if (/^(heic|heix|hevc|hevx|mif1|msf1|avif)$/.test(marca)) return 'heic'
  }
  return null
}

/**
 * Valida la imagen tal como llegó (D-36: se manda sin recomprimir). Devuelve el
 * tipo a declarar: el que dicen los bytes, si el que vino del portapapeles no
 * coincide (la imagen no se toca, solo se corrige la etiqueta).
 */
export function validarImagen(imagen: { bytes: Uint8Array; tipo: string }): { tipo: TipoImagen; corregido: boolean } {
  if (!imagen.bytes || imagen.bytes.length === 0) {
    throw new ErrorCaptura('imagen_vacia', 'la imagen llegó vacía. Volvé a copiarla y pegala de nuevo.')
  }
  const declarado = (imagen.tipo ?? '').split(';')[0].trim().toLowerCase()
  const porFirma = tipoPorFirma(imagen.bytes)
  if (porFirma === 'heic' || /hei[cf]|avif/.test(declarado)) {
    throw new ErrorCaptura(
      'tipo_imagen',
      'el formato HEIC/HEIF no se puede leer. Compartila como PNG o JPEG (en el iPhone: Ajustes › Cámara › Formatos › Más compatible).',
    )
  }
  const admitido = ADMITIDOS[declarado]
  if (!admitido) {
    throw new ErrorCaptura(
      'tipo_imagen',
      `el formato ${declarado || 'desconocido'} no está admitido. Pegá una imagen PNG, JPEG, WebP o GIF.`,
    )
  }
  if (porFirma === null) {
    throw new ErrorCaptura('tipo_imagen', `el archivo dice ser ${declarado} pero no es una imagen válida.`)
  }
  return { tipo: porFirma, corregido: porFirma !== admitido }
}

// ───────────── Lo que devuelve el modelo ─────────────
// Todo número viaja como texto, tal cual está impreso (es-AR). El modelo no
// hace cuentas. null = no se ve o no se lee con seguridad ("ilegible").
// zod descarta cualquier campo de más: lo que no está en el esquema no existe.

const textoONull = (descripcion: string) => z.string().nullable().describe(descripcion)
const direccion = z
  .enum(['sube', 'baja'])
  .nullable()
  .describe('"sube" si hay flecha hacia arriba (↑ ▲) o signo +; "baja" si hay flecha hacia abajo (↓ ▼) o signo −; null si no hay indicación.')

export const esquemaFilaModelo = z.object({
  ticker: textoONull('Código de la especie, el renglón de arriba de la columna Especie (ej. "S28F7"). null si no tiene código.'),
  nombre: textoONull('Nombre de la especie, el renglón de abajo, tal cual (ej. "LETRA TESORO NAC CAP 28/02/27$").'),
  cantidad: textoONull('Cantidad tal cual (ej. "5.000.000"). En fondos, las cuotapartes.'),
  precio: textoONull('Precio tal cual, con su símbolo (ej. "$1,04375"). En fondos, el valor de la cuotaparte.'),
  variacion: textoONull('Variación tal cual (ej. "0,06%").'),
  variacion_direccion: direccion,
  ppc: textoONull('PPC tal cual (ej. "$1,06").'),
  rendimiento_monto: textoONull('Monto del rendimiento tal cual (ej. "$12.345,67").'),
  rendimiento_porcentaje: textoONull('Porcentaje del rendimiento tal cual (ej. "1,23%").'),
  rendimiento_direccion: direccion,
  valorizado: textoONull('Saldo valorizado tal cual (ej. "$5.218.750,00").'),
})

export const esquemaSeccionModelo = z.object({
  titulo: textoONull('Título de la sección (ej. "Bonos", "Fondos").'),
  totales: z
    .array(
      z.object({
        etiqueta: z.string().describe('Etiqueta del total tal cual (ej. "Bonos en pesos").'),
        valor: textoONull('Monto tal cual (ej. "$1.234.567,89" o "U$D0,00").'),
      }),
    )
    .describe('Totales que muestra la sección, cada uno con su etiqueta.'),
  rendimiento_acumulado: z
    .object({
      monto: textoONull('Monto tal cual.'),
      porcentaje: textoONull('Porcentaje tal cual.'),
      direccion,
    })
    .nullable()
    .describe('"Rendimiento acumulado" de la sección, si aparece.'),
  filas: z.array(esquemaFilaModelo).describe('Una por especie, en el orden de la pantalla.'),
})

export const esquemaMercadoPagoModelo = z.object({
  pestana: textoONull('Pestaña activa (ej. "Pesos").'),
  simbolo_moneda: textoONull('Símbolo que acompaña al saldo (ej. "$", "US$").'),
  saldo_entero: textoONull('Parte entera del saldo grande, tal cual (ej. "1.234.567").'),
  saldo_decimales: textoONull('Centavos del saldo, los dígitos chicos en superíndice (ej. "89"). null si no se ven.'),
  rendimiento: textoONull('Monto de "Rindió $ … " tal cual.'),
  rendimiento_periodo: textoONull('Período del rendimiento tal cual (ej. "en los últimos 12 meses").'),
  tna: textoONull('TNA si aparece, tal cual (ej. "27,5%").'),
  tope: textoONull('Tope del saldo remunerado si aparece, tal cual.'),
})

export const esquemaSalidaModelo = z.object({
  fuente: z
    .enum(['galicia', 'mercado_pago', 'otra'])
    .describe('galicia: inversiones de Banco Galicia. mercado_pago: saldo de la cuenta de Mercado Pago. otra: cualquier otra cosa.'),
  fecha: textoONull('Fecha que muestra el contenido de la app, tal cual. No la hora del reloj del teléfono. null si no hay.'),
  galicia: z
    .object({ secciones: z.array(esquemaSeccionModelo) })
    .nullable()
    .describe('Solo si fuente es galicia; si no, null.'),
  mercado_pago: esquemaMercadoPagoModelo.nullable().describe('Solo si fuente es mercado_pago; si no, null.'),
})

export type SalidaModelo = z.infer<typeof esquemaSalidaModelo>
export type FilaModelo = z.infer<typeof esquemaFilaModelo>
export type SeccionModelo = z.infer<typeof esquemaSeccionModelo>
export type MercadoPagoModelo = z.infer<typeof esquemaMercadoPagoModelo>

function reescribirNulos(n: unknown): unknown {
  if (Array.isArray(n)) return n.map(reescribirNulos)
  if (n === null || typeof n !== 'object') return n
  const o: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(n)) o[k] = reescribirNulos(v)
  if (Array.isArray(o.type)) {
    const { type, description, ...resto } = o
    return {
      anyOf: (type as string[]).map((t) => (t === 'null' ? { type: 'null' } : { type: t, ...resto })),
      ...(description === undefined ? {} : { description }),
    }
  }
  return o
}

/**
 * Esquema JSON de la salida para `output_config.format` (salida estructurada).
 * Sale del mismo esquema zod que valida la respuesta, así no se desincronizan.
 * Los `type: [x, "null"]` pasan a `anyOf` y los `enum` quedan exigidos.
 */
export function esquemaJSONSalida(): Record<string, unknown> {
  const s = z.toJSONSchema(esquemaSalidaModelo) as Record<string, unknown>
  delete s.$schema
  return reescribirNulos(s) as Record<string, unknown>
}

/** Texto del modelo → salida validada. Campos de más se ignoran; tipos equivocados son error. */
export function interpretarSalidaModelo(texto: string, quien: string): SalidaModelo {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    throw new ErrorCaptura('json_invalido', `${quien} devolvió algo que no es JSON válido.`, { reintentable: true })
  }
  const r = esquemaSalidaModelo.safeParse(json)
  if (!r.success) {
    const problemas = r.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('; ')
    throw new ErrorCaptura('json_invalido', `${quien} no respetó el formato pedido (${problemas}).`, { reintentable: true })
  }
  return r.data
}

/** Una lectura completa del modelo, con lo que hace falta para la traza. */
export interface LecturaModelo {
  id: 'A' | 'B'
  /** Modelo que respondió (puede diferir del pedido si hubo un fallback). */
  modelo: string
  modelo_pedido: string
  variante: 'completa' | 'tabla'
  /** Texto crudo devuelto por el modelo (JSON). */
  texto: string
  datos: SalidaModelo
  /** Metadatos de la llamada (stop_reason, uso, duración…), van a la lectura cruda. */
  meta?: Record<string, unknown>
}

// ───────────── Números en formato es-AR ─────────────

export interface NumeroLeido {
  /** Texto tal como lo devolvió el modelo. */
  texto: string
  /** Texto decimal normalizado con signo ("-1234.56"), o null si no es un número. */
  valor: string | null
  /** Decimales impresos: definen la tolerancia (D-37). */
  decimales: number
  /** Moneda por el símbolo: "$" → ARS; "U$D", "US$", "U$S" → USD. */
  moneda: Moneda | null
}

const SUPERINDICES: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
}
const RE_SUPERINDICE = /[⁰¹²³⁴⁵⁶⁷⁸⁹]/

/**
 * Lee un número tal como aparece en una captura: "$5.218.750,00", "U$D0,00",
 * "↑ 0,06%", "−$1.234,56", "1.234.567⁸⁹" (centavos en superíndice). La regla
 * de puntos y comas es la de leerNumeroAR. `direccion` aplica el signo que
 * indica una flecha (rendimientos y variaciones).
 */
export function leerNumeroCaptura(texto: string | null | undefined, direccion: 'sube' | 'baja' | null = null): NumeroLeido | null {
  if (texto === null || texto === undefined) return null
  const original = texto
  // Unidades que a veces acompañan a la cantidad ("5.000.000 VN", "120.000 cuotapartes").
  let t = texto.replace(/(^|\s)(v\.?\s?n\.?|cuotapartes?|nominales|unidades)(?=\s|$)/gi, ' ').trim()
  // Centavos en superíndice: "1.234.567⁸⁹" → "1.234.567,89".
  const iSup = t.search(RE_SUPERINDICE)
  if (iSup >= 0) {
    const base = t.slice(0, iSup)
    const sup = t.slice(iSup).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => SUPERINDICES[c])
    t = base.includes(',') ? base + sup : base.replace(/[.\s]+$/, '') + ',' + sup
  }
  t = t.replace(/\s/g, '').replace(/[−–—‐‑]/g, '-')
  const moneda: Moneda | null = /U\$D|U\$S|US\$|USD|U\$/i.test(t) ? 'USD' : /\$|ARS/i.test(t) ? 'ARS' : null
  let negativo = false
  if (/^\(.*\)$/.test(t)) {
    negativo = true
    t = t.slice(1, -1)
  }
  t = t.replace(/U\$D|U\$S|US\$|USD|U\$|AR\$|ARS|\$/gi, '')
  if (/[↓▼⬇↘]/.test(t)) negativo = true
  t = t.replace(/[↑▲⬆↗↓▼⬇↘%+]/g, '')
  if (t.includes('-')) {
    negativo = true
    t = t.replace(/-/g, '')
  }
  if (direccion === 'baja') negativo = true
  const vacio = { texto: original, valor: null, decimales: 0, moneda }
  if (!/^[0-9.,]+$/.test(t) || !/[0-9]/.test(t)) return vacio
  if ((t.match(/,/g) ?? []).length > 1) return vacio
  const decimales = t.includes(',')
    ? t.length - t.indexOf(',') - 1
    : (t.match(/\./g) ?? []).length === 1 && /\.\d{1,2}$/.test(t)
      ? t.length - t.indexOf('.') - 1
      : 0
  const v = leerNumeroAR(t)
  if (v === null) return vacio
  const valor = negativo && !new Decimal(v).isZero() ? `-${v}` : v
  return { texto: original, valor, decimales, moneda }
}

/**
 * Saldo de Mercado Pago: la parte entera y los centavos en superíndice vienen
 * separados ("1.234.567" + "89"). Devuelve el texto unido en es-AR, o null si
 * las partes no cierran entre sí.
 */
export function unirEnteroYDecimales(entero: string | null, decimales: string | null): string | null {
  if (entero === null || entero.trim() === '') return null
  const e = entero.trim()
  const d = decimales === null ? '' : decimales.replace(/[\s,.]/g, '')
  if (e.includes(',') || RE_SUPERINDICE.test(e)) {
    // El modelo ya los unió: solo vale si los centavos coinciden.
    if (d === '') return e
    const leido = leerNumeroCaptura(e)
    const conCentavos = leerNumeroCaptura(`${e.replace(/,\d*$/, '').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/, '')},${d}`)
    return leido?.valor && leido.valor === conCentavos?.valor ? e : null
  }
  if (d === '') return e
  if (!/^\d{1,2}$/.test(d)) return null
  return `${e.replace(/[.\s]+$/, '')},${d}`
}

/** Un porcentaje rotulado ("TNA 27,5%", "27,5 % anual") → su número (27.5). */
export function leerPorcentaje(texto: string | null): NumeroLeido | null {
  if (texto === null) return null
  return leerNumeroCaptura(texto.replace(/\b(TNA|TEA|TEM|nominal|anual|efectiva|mensual)\b/gi, ''))
}

/**
 * Texto del modelo citado en un mensaje, recortado: lo que se lee de la imagen
 * es dato y no tiene por qué ocupar la pantalla (ni dar órdenes).
 */
export function corto(texto: string | null, max = 40): string {
  const t = (texto ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Medio último dígito impreso: 2 decimales → 0,005 (D-37). */
export function medioUltimoDigito(decimales: number): Decimal {
  return new Decimal(5).times(new Decimal(10).pow(-(decimales + 1)))
}

function D(n: NumeroLeido): Decimal {
  return new Decimal(n.valor as string)
}

function fmt(d: Decimal, maxDecimales = 8): string {
  const dp = Math.min(d.decimalPlaces(), maxDecimales)
  return numero(d, dp, { min: dp })
}

/** Plata en una fórmula: siempre con centavos, y con los decimales de más que tenga (precios). */
function fmtPlata(d: Decimal, moneda: Moneda | null, maxDecimales = 8): string {
  const s = moneda === 'USD' ? 'US$' : '$'
  const dp = Math.max(2, Math.min(d.decimalPlaces(), maxDecimales))
  const cuerpo = numero(d.abs(), dp, { min: 2 })
  return d.isNegative() ? `−${s} ${cuerpo}` : `${s} ${cuerpo}`
}

// ───────────── Chequeos (cada uno con su traza) ─────────────

export type Escala = '1' | '0.01' | '0.001'
export const ESCALAS: readonly Escala[] = ['1', '0.01', '0.001']

export interface ResultadoAritmetica {
  /** Escala que cierra (null si ninguna). */
  escala: Escala | null
  chequeo: Chequeo
  calc: Calc
}

/**
 * cantidad × precio × escala ≈ valorizado (D-11, D-12). La tolerancia es medio
 * último dígito de cada factor, propagado, más medio último dígito del
 * valorizado (D-37). Prueba ×1, ÷100 y ÷1000 (CA-11) y se queda con la
 * primera que cierra.
 */
export function chequeoAritmetico(cantidad: NumeroLeido, precio: NumeroLeido, valorizado: NumeroLeido): ResultadoAritmetica {
  const q = D(cantidad)
  const p = D(precio)
  const v = D(valorizado)
  const intentos = ESCALAS.map((e) => {
    const esc = new Decimal(e)
    const calculado = q.times(p).times(esc)
    const tol = medioUltimoDigito(precio.decimales)
      .times(q.abs())
      .times(esc)
      .plus(medioUltimoDigito(cantidad.decimales).times(p.abs()).times(esc))
      .plus(medioUltimoDigito(valorizado.decimales))
    const dif = calculado.minus(v).abs()
    return { e, esc, calculado, tol, dif, ok: dif.lte(tol) }
  })
  const elegido = intentos.find((i) => i.ok) ?? [...intentos].sort((a, b) => a.dif.div(a.tol).comparedTo(b.dif.div(b.tol)))[0]
  const moneda = valorizado.moneda ?? precio.moneda
  const regla = 'cantidad × precio × escala ≈ valorizado'
  const chequeo: Chequeo = {
    regla,
    esperado: v.toFixed(),
    calculado: elegido.calculado.toFixed(),
    tolerancia: elegido.tol.toFixed(),
    ok: elegido.ok,
  }
  const escalaTxt = elegido.e === '1' ? '1' : elegido.e === '0.01' ? '1/100' : '1/1000'
  const formula =
    `${fmt(q)} × ${fmtPlata(p, moneda)} × ${escalaTxt} = ${fmtPlata(elegido.calculado, moneda, 4)}` +
    ` ${elegido.ok ? '≈' : '≠'} ${fmtPlata(v, moneda)} de la captura (tolerancia ±${fmtPlata(elegido.tol, moneda, 4)})`
  const c = calc(elegido.calculado, formula, [
    { nombre: 'Cantidad', valor: q.toFixed(), unidad: 'cantidad' },
    { nombre: 'Precio mostrado', valor: p.toFixed(), unidad: moneda ?? 'ARS' },
    { nombre: 'Escala', valor: elegido.e, unidad: 'ratio' },
    { nombre: 'Valorizado de la captura', valor: v.toFixed(), unidad: moneda ?? 'ARS' },
    { nombre: 'Tolerancia', valor: elegido.tol.toFixed(), unidad: moneda ?? 'ARS' },
  ], {
    explicacion: elegido.ok
      ? `El precio está ${elegido.e === '1' ? 'por 1 unidad' : elegido.e === '0.01' ? 'cada 100 VN' : 'cada 1000 cuotapartes'}: la cuenta cierra.`
      : 'Ninguna escala (×1, ÷100, ÷1000) cierra: algún número está mal leído.',
  })
  return { escala: elegido.ok ? elegido.e : null, chequeo, calc: c }
}

export interface ResultadoPPC {
  costo: Calc
  ppc: Calc
  /** El PPC reconstruido redondea al mostrado (null si no se puede comparar). */
  coincide: boolean | null
}

/**
 * PPC preciso de Galicia (carga-diaria.md): la captura muestra el PPC
 * redondeado a 2 decimales; el preciso es (valorizado − rendimiento $) ÷
 * cantidad. Se compara contra el mostrado con intervalos: el mostrado vale
 * ±½ último dígito y el reconstruido arrastra el redondeo de sus insumos.
 */
export function reconstruirPPC(
  cantidad: NumeroLeido,
  valorizado: NumeroLeido,
  rendimiento: NumeroLeido | null,
  ppcMostrado: NumeroLeido | null,
  escala: Escala | null,
): ResultadoPPC {
  const q = D(cantidad)
  const v = D(valorizado)
  const moneda = valorizado.moneda
  if (rendimiento === null || rendimiento.valor === null) {
    const motivo = 'Rendimiento ilegible: sin él no se puede reconstruir el PPC preciso.'
    return { costo: sinDato(motivo), ppc: sinDato(motivo), coincide: null }
  }
  if (q.isZero()) {
    const motivo = 'Cantidad cero: no hay PPC.'
    return { costo: sinDato(motivo), ppc: sinDato(motivo), coincide: null }
  }
  const r = D(rendimiento)
  const costoD = v.minus(r)
  const costo = calc(costoD, `${fmtPlata(v, moneda)} − ${fmtPlata(r, moneda)} = ${fmtPlata(costoD, moneda)}`, [
    { nombre: 'Valorizado', valor: v.toFixed(), unidad: moneda ?? 'ARS' },
    { nombre: 'Rendimiento $', valor: r.toFixed(), unidad: moneda ?? 'ARS' },
  ], { explicacion: 'Costo de la tenencia: lo que vale hoy menos lo que rindió.' })
  const ppcD = costoD.div(q).toDecimalPlaces(12, Decimal.ROUND_HALF_EVEN)
  let coincide: boolean | null = null
  let comparacion = ''
  if (ppcMostrado !== null && ppcMostrado.valor !== null && escala !== null) {
    const e = new Decimal(escala)
    const m = D(ppcMostrado).times(e)
    const tolM = medioUltimoDigito(ppcMostrado.decimales).times(e)
    const tolR = medioUltimoDigito(valorizado.decimales)
      .plus(medioUltimoDigito(rendimiento.decimales))
      .div(q.abs())
      .plus(ppcD.abs().times(medioUltimoDigito(cantidad.decimales)).div(q.abs()))
    coincide = ppcD.minus(m).abs().lte(tolM.plus(tolR))
    comparacion = ` ${coincide ? '≈' : '≠'} ${fmtPlata(D(ppcMostrado), moneda)} mostrado${escala === '1' ? '' : ` × ${escala}`}`
  }
  const ppc = calc(ppcD, `(${fmtPlata(v, moneda)} − ${fmtPlata(r, moneda)}) ÷ ${fmt(q)} = ${fmtPlata(ppcD, moneda, 8)}${comparacion}`, [
    { nombre: 'Costo', valor: costoD.toFixed(), unidad: moneda ?? 'ARS', calc: costo },
    { nombre: 'Cantidad', valor: q.toFixed(), unidad: 'cantidad' },
    { nombre: 'PPC mostrado (redondeado)', valor: ppcMostrado?.valor ?? null, unidad: moneda ?? 'ARS' },
  ], { explicacion: 'PPC preciso: el que muestra Galicia está redondeado a 2 decimales.' })
  return { costo, ppc, coincide }
}

/**
 * Rendimiento % = rendimiento $ ÷ costo. Galicia lo calcula sobre el costo
 * (valorizado − rendimiento); con 2 decimales de porcentaje, controla el
 * rendimiento $ que decide el PPC.
 */
export function chequeoRendimientoPct(
  valorizado: NumeroLeido,
  rendimiento: NumeroLeido,
  porcentaje: NumeroLeido,
): { ok: boolean | null; calc: Calc } {
  if (valorizado.valor === null || rendimiento.valor === null || porcentaje.valor === null) {
    return { ok: null, calc: sinDato('Falta el valorizado, el rendimiento o su porcentaje.') }
  }
  const v = D(valorizado)
  const r = D(rendimiento)
  const costo = v.minus(r)
  if (costo.isZero()) return { ok: null, calc: sinDato('Costo cero: el porcentaje no se puede calcular.') }
  const pct = r.div(costo).times(100)
  const c2 = costo.times(costo)
  const tol = medioUltimoDigito(porcentaje.decimales).plus(
    v.abs().div(c2).times(medioUltimoDigito(rendimiento.decimales)).plus(r.abs().div(c2).times(medioUltimoDigito(valorizado.decimales))).times(100),
  )
  const mostrado = D(porcentaje)
  const ok = pct.minus(mostrado).abs().lte(tol)
  return {
    ok,
    calc: calc(pct, `${fmtPlata(r, valorizado.moneda)} ÷ ${fmtPlata(costo, valorizado.moneda)} = ${fmt(pct, 4)}% ${ok ? '≈' : '≠'} ${fmt(mostrado)}% mostrado`, [
      { nombre: 'Rendimiento $', valor: r.toFixed(), unidad: valorizado.moneda ?? 'ARS' },
      { nombre: 'Costo', valor: costo.toFixed(), unidad: valorizado.moneda ?? 'ARS' },
      { nombre: 'Porcentaje mostrado', valor: mostrado.toFixed(), unidad: 'texto' },
    ]),
  }
}

/** Σ de valores contra un total impreso, con tolerancia de medio dígito por sumando y por el total. */
export function chequeoSuma(valores: readonly NumeroLeido[], total: NumeroLeido): { calculado: Decimal; tolerancia: Decimal; ok: boolean } {
  let s = new Decimal(0)
  let tol = medioUltimoDigito(total.decimales)
  for (const x of valores) {
    s = s.plus(D(x))
    tol = tol.plus(medioUltimoDigito(x.decimales))
  }
  return { calculado: s, tolerancia: tol, ok: s.minus(D(total)).abs().lte(tol) }
}

// ───────────── Fecha que muestra la captura ─────────────

const MESES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6,
  jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
}

function fechaValida(a: number, m: number, d: number): Fecha | null {
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const f = new Date(Date.UTC(a, m - 1, d))
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Fecha impresa en la captura → 'YYYY-MM-DD'. Sin año visible no se completa:
 * la fecha la decide la carga (D-61).
 */
export function leerFechaCaptura(texto: string | null): { fecha: Fecha | null; motivo: string | null } {
  if (texto === null || texto.trim() === '') return { fecha: null, motivo: null }
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const anio = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s))
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const f = fechaValida(Number(m[1]), Number(m[2]), Number(m[3]))
    if (f) return { fecha: f, motivo: null }
  }
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/)
  if (m) {
    const f = fechaValida(anio(m[3]), Number(m[2]), Number(m[1]))
    if (f) return { fecha: f, motivo: null }
    return { fecha: null, motivo: `La fecha "${corto(texto)}" no es válida.` }
  }
  m = t.match(/\b(\d{1,2})\s*(?:de\s+)?([a-z]{3,10})\.?\s*(?:de\s+|del?\s+)?(\d{4}|'?\d{2})\b/)
  if (m && MESES[m[2]] !== undefined) {
    const f = fechaValida(anio(m[3].replace("'", '')), MESES[m[2]], Number(m[1]))
    if (f) return { fecha: f, motivo: null }
  }
  return { fecha: null, motivo: `La captura dice "${corto(texto)}", sin una fecha completa con año: la fecha la decide la carga.` }
}

// ───────────── Galicia ─────────────

type CampoNumerico = 'cantidad' | 'precio' | 'valorizado' | 'ppc' | 'rendimiento_monto' | 'rendimiento_porcentaje'
const CAMPOS_NUMERICOS: readonly CampoNumerico[] = ['cantidad', 'precio', 'valorizado', 'ppc', 'rendimiento_monto', 'rendimiento_porcentaje']
const ETIQUETA: Record<CampoNumerico | 'ticker', string> = {
  ticker: 'Especie',
  cantidad: 'Cantidad',
  precio: 'Precio',
  valorizado: 'Saldo valorizado',
  ppc: 'PPC',
  rendimiento_monto: 'Rendimiento $',
  rendimiento_porcentaje: 'Rendimiento %',
}

interface FilaUbicada {
  fila: FilaModelo
  seccion: string | null
  /** Posición dentro de su sección (1…n). */
  n: number
  orden: number
}

function normalizarTicker(t: string | null): string {
  return (t ?? '').toUpperCase().replace(/\s+/g, '')
}

function normalizarNombre(t: string | null): string {
  return (t ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

/** Largo máximo de un ticker en el catálogo (esquemaActivo y escritura.tickerValido). */
export const MAX_TICKER = 30

/** "Fima Premium Clase A" → "FIMA-PREMIUM-CLASE-A": un ticker válido y estable para un fondo sin código. */
export function tickerDeNombre(nombre: string): string {
  return normalizarNombre(nombre)
    .replace(/[^A-Z0-9.]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
}

function claveFila(f: FilaModelo): string {
  const t = normalizarTicker(f.ticker)
  return t !== '' ? `T:${t}` : f.nombre ? `N:${normalizarNombre(f.nombre)}` : ''
}

function numerosDeFila(f: FilaModelo): Record<CampoNumerico, NumeroLeido | null> {
  return {
    cantidad: leerNumeroCaptura(f.cantidad),
    precio: leerNumeroCaptura(f.precio),
    valorizado: leerNumeroCaptura(f.valorizado),
    ppc: leerNumeroCaptura(f.ppc),
    rendimiento_monto: leerNumeroCaptura(f.rendimiento_monto, f.rendimiento_direccion),
    rendimiento_porcentaje: leerNumeroCaptura(f.rendimiento_porcentaje, f.rendimiento_direccion),
  }
}

function valorDe(n: NumeroLeido | null): string | null {
  return n?.valor ?? null
}

function textoDe(n: NumeroLeido | null, crudo: string | null | undefined): string {
  if (crudo === null || crudo === undefined) return 'ilegible'
  if (n === null || n.valor === null) return `"${corto(crudo)}" (ilegible)`
  return crudo.trim()
}

/** Empareja las filas de las dos lecturas: por ticker (o nombre), después por orden. */
export function emparejarFilas<T extends { fila: FilaModelo }>(a: readonly T[], b: readonly T[]): { a: T | null; b: T | null }[] {
  const pares: { a: T | null; b: T | null }[] = []
  const usadasB = new Set<number>()
  const sueltasA: T[] = []
  for (const fa of a) {
    const k = claveFila(fa.fila)
    const j = k === '' ? -1 : b.findIndex((fb, i) => !usadasB.has(i) && claveFila(fb.fila) === k)
    if (j >= 0) {
      usadasB.add(j)
      pares.push({ a: fa, b: b[j] })
    } else {
      sueltasA.push(fa)
    }
  }
  const sueltasB = b.filter((_, i) => !usadasB.has(i))
  const n = Math.max(sueltasA.length, sueltasB.length)
  for (let i = 0; i < n; i++) pares.push({ a: sueltasA[i] ?? null, b: sueltasB[i] ?? null })
  return pares
}

interface Diferencia {
  campo: string
  a: string
  b: string
  elegida: 'A' | 'B'
}

interface EvaluacionCombo {
  valores: Record<CampoNumerico, NumeroLeido | null>
  origen: Record<CampoNumerico, 'A' | 'B'>
  arit: ResultadoAritmetica | null
  ppc: ResultadoPPC | null
  pct: { ok: boolean | null; calc: Calc } | null
  puntaje: number
}

function evaluarCombo(valores: Record<CampoNumerico, NumeroLeido | null>, origen: Record<CampoNumerico, 'A' | 'B'>): EvaluacionCombo {
  const ok = (n: NumeroLeido | null): n is NumeroLeido => n !== null && n.valor !== null
  const { cantidad: q, precio: p, valorizado: v, ppc, rendimiento_monto: r, rendimiento_porcentaje: pc } = valores
  const arit = ok(q) && ok(p) && ok(v) ? chequeoAritmetico(q, p, v) : null
  const ppcR = ok(q) && ok(v) ? reconstruirPPC(q, v, ok(r) ? r : null, ok(ppc) ? ppc : null, arit?.escala ?? null) : null
  const pct = ok(v) && ok(r) && ok(pc) ? chequeoRendimientoPct(v, r, pc) : null
  const legibles = CAMPOS_NUMERICOS.filter((c) => ok(valores[c])).length
  const puntaje = (arit?.escala ? 100 : 0) + (ppcR?.coincide ? 10 : 0) + (pct?.ok ? 10 : 0) + legibles
  return { valores, origen, arit, ppc: ppcR, pct, puntaje }
}

function seccionDe(titulo: string | null, f: FilaModelo): FilaLeida['seccion'] {
  const t = normalizarNombre(titulo)
  if (/FONDO|FIMA|FCI/.test(t)) return 'fci'
  if (/CEDEAR/.test(t)) return 'cedears'
  if (/ACCION/.test(t)) return 'acciones'
  if (/BONO|LETRA|TITULO|RENTA FIJA/.test(t)) return 'bonos'
  const n = normalizarNombre(`${f.ticker ?? ''} ${f.nombre ?? ''}`)
  if (/FIMA|FONDO|FCI/.test(n)) return 'fci'
  if (/LETRA|BONO|LECAP/.test(n)) return 'bonos'
  return t === '' ? null : 'otros'
}

function tipoSugerido(seccion: FilaLeida['seccion'], f: FilaModelo): TipoActivo {
  const n = normalizarNombre(`${f.ticker ?? ''} ${f.nombre ?? ''}`)
  if (/\bLETRA|\bLECAP/.test(n)) return 'lecap'
  if (seccion === 'fci' || /FIMA|FONDO|\bFCI\b/.test(n)) return 'fci'
  if (seccion === 'acciones') return 'accion_local'
  if (seccion === 'cedears') return 'cedear'
  return 'bono'
}

function peor(a: EstadoFila, b: EstadoFila): EstadoFila {
  const orden: EstadoFila[] = ['verificada', 'advertencia', 'error']
  return orden[Math.max(orden.indexOf(a), orden.indexOf(b))]
}

interface FilaArmada {
  fila: FilaLeida
  seccion: string | null
  /** Valorizado y rendimiento elegidos, para los totales de la sección. */
  valorizado: NumeroLeido | null
  rendimiento: NumeroLeido | null
  traza: {
    diferencias: Diferencia[]
    solo: 'A' | 'B' | null
    aritmetica: CalcVista | null
    costo: CalcVista | null
    ppc: CalcVista | null
    rendimiento_pct: CalcVista | null
  }
}

function armarFilaGalicia(
  par: { a: FilaUbicada | null; b: FilaUbicada | null },
  claves: Set<string>,
): FilaArmada {
  const base = (par.a ?? par.b) as FilaUbicada
  const fa = par.a?.fila ?? null
  const fb = par.b?.fila ?? null
  const na = fa ? numerosDeFila(fa) : null
  const nb = fb ? numerosDeFila(fb) : null
  const motivos: string[] = []
  const diferencias: Diferencia[] = []
  let estado: EstadoFila = 'verificada'
  const solo: 'A' | 'B' | null = fa && fb ? null : fa ? 'A' : 'B'

  // Campos numéricos en conflicto: la aritmética decide (CA-3).
  const conflicto = CAMPOS_NUMERICOS.filter((c) => na && nb && valorDe(na[c]) !== valorDe(nb[c]))
  let mejor: EvaluacionCombo | null = null
  for (let mask = 0; mask < 1 << conflicto.length; mask++) {
    const valores = {} as Record<CampoNumerico, NumeroLeido | null>
    const origen = {} as Record<CampoNumerico, 'A' | 'B'>
    for (const c of CAMPOS_NUMERICOS) {
      const i = conflicto.indexOf(c)
      const deB = i >= 0 ? Boolean(mask & (1 << i)) : na === null
      valores[c] = deB ? (nb as Record<CampoNumerico, NumeroLeido | null>)[c] : (na as Record<CampoNumerico, NumeroLeido | null>)[c]
      origen[c] = deB ? 'B' : 'A'
    }
    const ev = evaluarCombo(valores, origen)
    if (mejor === null || ev.puntaje > mejor.puntaje) mejor = ev
  }
  const ev = mejor as EvaluacionCombo
  const crudoDe = (f: FilaModelo | null, c: CampoNumerico) => (f ? f[c] : null)
  // Las dos lecturas, para que el dueño elija con un toque: el decimal
  // normalizado si se entendió; si no, el texto tal cual.
  const alternativas: Alternativa[] = []
  for (const c of conflicto) {
    const ta = textoDe(na?.[c] ?? null, crudoDe(fa, c))
    const tb = textoDe(nb?.[c] ?? null, crudoDe(fb, c))
    diferencias.push({ campo: c, a: ta, b: tb, elegida: ev.origen[c] })
    alternativas.push({ campo: c, a: valorDe(na?.[c] ?? null) ?? ta, b: valorDe(nb?.[c] ?? null) ?? tb, propuesta: ev.origen[c] })
  }

  // Especie: ticker y nombre (texto).
  const tickerA = normalizarTicker(fa?.ticker ?? null)
  const tickerB = normalizarTicker(fb?.ticker ?? null)
  const seccion = seccionDe(base.seccion, fa ?? (fb as FilaModelo))
  const nombre = fa?.nombre?.trim() || fb?.nombre?.trim() || null
  let ticker = tickerA || tickerB
  if (fa && fb && tickerA !== tickerB) {
    diferencias.unshift({ campo: 'ticker', a: fa.ticker ?? 'ilegible', b: fb.ticker ?? 'ilegible', elegida: tickerA ? 'A' : 'B' })
    alternativas.unshift({ campo: 'ticker', a: fa.ticker ?? 'ilegible', b: fb.ticker ?? 'ilegible', propuesta: tickerA ? 'A' : 'B' })
  }
  // Un fondo sin código (FIMA) usa su nombre como ticker (D-108), en una forma
  // que el catálogo acepta y que da igual todos los días: mayúsculas, sin tildes
  // y con un guion en lugar de espacios y signos ("FIMA-PREMIUM-CLASE-A").
  if (ticker === '' && seccion === 'fci' && nombre) ticker = tickerDeNombre(nombre)

  if (solo) {
    motivos.push(`Solo la lectura ${solo} vio esta fila: confirmala contra la captura.`)
    estado = peor(estado, 'advertencia')
  }
  if (ticker === '') {
    motivos.push('Especie ilegible: no se sabe de qué activo es esta fila.')
    estado = 'error'
  } else if (ticker.length > MAX_TICKER) {
    motivos.unshift(
      `El nombre del fondo da un código de más de ${MAX_TICKER} caracteres ("${corto(ticker)}"): no se puede dar de alta así. Dejalo pendiente.`,
    )
    estado = 'error'
  }
  for (const d of diferencias) {
    const etiqueta = ETIQUETA[d.campo as CampoNumerico | 'ticker'] ?? d.campo
    const razon =
      (d.campo === 'cantidad' || d.campo === 'precio' || d.campo === 'valorizado') && ev.arit?.escala
        ? ', que cierra cantidad × precio ≈ valorizado'
        : (d.campo === 'rendimiento_monto' || d.campo === 'ppc' || d.campo === 'rendimiento_porcentaje') &&
            (ev.ppc?.coincide || ev.pct?.ok)
          ? ', que cierra con el PPC y el % mostrados'
          : ''
    motivos.push(`${etiqueta} — Lectura A: ${d.a} · Lectura B: ${d.b} (se propone la ${d.elegida}${razon}).`)
    estado = peor(estado, 'advertencia')
  }

  const v = ev.valores
  const crudoElegido = (c: CampoNumerico) => crudoDe(ev.origen[c] === 'A' ? fa : fb, c)
  for (const c of ['cantidad', 'precio', 'valorizado', 'ppc', 'rendimiento_monto'] as const) {
    // Sin PPC, el rendimiento $ igual queda controlado si cierra con el %.
    if (c === 'ppc' && ev.pct?.ok) continue
    if (v[c] === null || v[c]?.valor === null) {
      const crudo = crudoElegido(c)
      motivos.push(
        crudo === null || crudo === undefined
          ? `${ETIQUETA[c]} ilegible: queda sin dato.`
          : `${ETIQUETA[c]} ilegible ("${corto(crudo)}" no es un número): queda sin dato.`,
      )
      estado = peor(estado, c === 'cantidad' ? 'error' : 'advertencia')
    }
  }
  if (ev.arit && !ev.arit.escala) {
    motivos.unshift(`La cuenta no cierra: ${ev.arit.calc.formula}. Algún número está mal leído.`)
    estado = 'error'
  } else if (!ev.arit) {
    estado = peor(estado, 'advertencia')
    if (v.cantidad?.valor && !motivos.some((m) => m.includes('ilegible'))) {
      motivos.push('No se pudo verificar cantidad × precio ≈ valorizado.')
    }
  }
  if (ev.ppc && ev.ppc.coincide === false) {
    motivos.push(`El PPC reconstruido no redondea al mostrado: ${ev.ppc.ppc.formula}. Revisá el rendimiento $.`)
    estado = peor(estado, 'advertencia')
  }
  if (ev.pct && ev.pct.ok === false) {
    motivos.push(`El rendimiento $ no da el % mostrado: ${ev.pct.calc.formula}.`)
    estado = peor(estado, 'advertencia')
  }

  const escala = ev.arit?.escala ?? null
  // Si la cuenta no cierra, ningún número de la fila es confiable para grabar un costo.
  const aritFallo = ev.arit !== null && ev.arit.escala === null
  const precioUnit = escala && v.precio?.valor ? new Decimal(v.precio.valor).times(new Decimal(escala)) : null
  const moneda = v.valorizado?.moneda ?? v.precio?.moneda ?? null
  let clave = `Galicia:${ticker || `fila${base.orden}`}`
  for (let k = 2; claves.has(clave); k++) clave = `Galicia:${ticker || `fila${base.orden}`}#${k}`
  claves.add(clave)

  const fila: FilaLeida = {
    clave,
    ticker,
    nombre,
    seccion,
    tipo_sugerido: tipoSugerido(seccion, fa ?? (fb as FilaModelo)),
    moneda_emision: moneda,
    // Lo que se ve en U$D (sección "Bonos en dólares") no es un precio en pesos.
    ...(moneda === 'USD' ? { moneda_precio: 'USD' as const } : {}),
    cantidad: valorDe(v.cantidad),
    precio_mostrado: valorDe(v.precio),
    escala,
    precio_unitario: precioUnit ? precioUnit.toFixed() : null,
    valorizado: valorDe(v.valorizado),
    ppc_mostrado: valorDe(v.ppc),
    rendimiento: valorDe(v.rendimiento_monto),
    ppc_unitario: !aritFallo && ev.ppc?.ppc.valor ? ev.ppc.ppc.valor.toFixed() : null,
    costo_total: !aritFallo && ev.ppc?.costo.valor ? ev.ppc.costo.valor.toFixed() : null,
    liquidacion: null,
    estado,
    motivos: estado === 'verificada' ? [] : motivos,
    chequeo: ev.arit?.chequeo ?? null,
    lugar: `captura de Galicia, ${base.seccion ?? 'tabla'}, fila ${base.n}${ticker ? ` (${ticker})` : ''}`,
    ...(alternativas.length ? { alternativas } : {}),
  }
  return {
    fila,
    seccion: base.seccion,
    valorizado: v.valorizado?.valor ? v.valorizado : null,
    rendimiento: v.rendimiento_monto?.valor ? v.rendimiento_monto : null,
    traza: {
      diferencias,
      solo,
      aritmetica: ev.arit ? vista(ev.arit.calc) : null,
      costo: ev.ppc ? vista(ev.ppc.costo) : null,
      ppc: ev.ppc ? vista(ev.ppc.ppc) : null,
      rendimiento_pct: ev.pct ? vista(ev.pct.calc) : null,
    },
  }
}

function ubicarFilas(s: SalidaModelo | null): FilaUbicada[] {
  const out: FilaUbicada[] = []
  let orden = 0
  for (const sec of s?.galicia?.secciones ?? []) {
    sec.filas.forEach((fila, i) => out.push({ fila, seccion: sec.titulo?.trim() || null, n: i + 1, orden: ++orden }))
  }
  return out
}

function monedaDeEtiqueta(etiqueta: string, valor: NumeroLeido | null): Moneda | null {
  const t = normalizarNombre(etiqueta)
  if (/DOLAR|U\$D|USD|U\$S|US\$/.test(t)) return 'USD'
  if (/PESO|ARS/.test(t)) return 'ARS'
  return valor?.moneda ?? null
}

function mismaSeccion(a: string | null, b: string | null): boolean {
  return normalizarNombre(a) === normalizarNombre(b)
}

interface ResultadoGalicia {
  filas: FilaLeida[]
  controles: ControlLeido[]
  advertencias: string[]
  traza: Record<string, unknown>
}

function armarGalicia(a: SalidaModelo | null, b: SalidaModelo | null): ResultadoGalicia {
  const claves = new Set<string>()
  const armadas = emparejarFilas(ubicarFilas(a), ubicarFilas(b)).map((p) => armarFilaGalicia(p, claves))
  const controles: ControlLeido[] = []
  const advertencias: string[] = []
  const trazaTotales: unknown[] = []

  // Secciones: las de A, más las que solo vio B.
  const secA = a?.galicia?.secciones ?? []
  const secB = b?.galicia?.secciones ?? []
  const secciones: { titulo: string | null; a: SeccionModelo | null; b: SeccionModelo | null }[] = secA.map((s, i) => ({
    titulo: s.titulo?.trim() || null,
    a: s,
    b: secB.find((x) => mismaSeccion(x.titulo, s.titulo)) ?? secB[i] ?? null,
  }))
  for (const s of secB) if (!secciones.some((x) => x.b === s)) secciones.push({ titulo: s.titulo?.trim() || null, a: null, b: s })

  const degradar = (titulo: string | null, motivo: string, moneda: Moneda | null = null) => {
    for (const f of armadas) {
      if (!mismaSeccion(f.seccion, titulo) || f.fila.estado === 'error') continue
      if (moneda !== null && (f.fila.moneda_emision ?? 'ARS') !== moneda) continue
      f.fila.estado = 'advertencia'
      f.fila.motivos.push(motivo)
    }
  }

  for (const sec of secciones) {
    const filasSec = armadas.filter((f) => mismaSeccion(f.seccion, sec.titulo))
    // Totales: se emparejan por etiqueta.
    const etiquetas = new Map<string, { etiqueta: string; a: string | null; b: string | null }>()
    for (const [quien, s] of [['a', sec.a], ['b', sec.b]] as const) {
      for (const t of s?.totales ?? []) {
        const k = normalizarNombre(t.etiqueta)
        const e = etiquetas.get(k) ?? { etiqueta: t.etiqueta.trim(), a: null, b: null }
        e[quien] = t.valor
        etiquetas.set(k, e)
      }
    }
    for (const t of etiquetas.values()) {
      const la = leerNumeroCaptura(t.a)
      const lb = leerNumeroCaptura(t.b)
      const moneda = monedaDeEtiqueta(t.etiqueta, la ?? lb)
      const filasMoneda = filasSec.filter((f) => (f.fila.moneda_emision ?? 'ARS') === (moneda ?? 'ARS'))
      const faltan = filasMoneda.filter((f) => f.valorizado === null)
      const candidatos = [la, lb].filter((x): x is NumeroLeido => x !== null && x.valor !== null)
      if (candidatos.length === 0) {
        advertencias.push(`No se pudo leer el total "${t.etiqueta}": la suma no quedó controlada.`)
        continue
      }
      let control: ControlLeido
      // Qué tenencias cubre este total: las de la sección y la moneda. Si cierra,
      // una tenencia de la app de esa sección y moneda que no está, falta (ausente).
      const tipoSeccion = seccionDe(sec.titulo, { ticker: null, nombre: null } as unknown as FilaModelo)
      const cobertura = tipoSeccion && tipoSeccion !== 'otros' ? { seccion: tipoSeccion, moneda: moneda ?? 'ARS' } : null
      if (filasMoneda.length === 0 && filasSec.length === 0) {
        const informado = candidatos[0]
        control = {
          tipo: 'galicia_total',
          seccion: t.etiqueta,
          moneda: moneda ?? 'ARS',
          cobertura,
          informado: informado.valor as string,
          calculado: null,
          ok: new Decimal(informado.valor as string).isZero() ? true : null,
          detalle: new Decimal(informado.valor as string).isZero()
            ? 'Total en cero y sin filas.'
            : 'La captura muestra el total pero ninguna fila: no se puede controlar.',
          tolerancia: null,
        }
        if (!new Decimal(informado.valor as string).isZero()) {
          advertencias.push(`La captura muestra "${t.etiqueta}" pero ninguna posición: ¿pegaste la pantalla de resumen? Abrí la sección y capturá la tabla.`)
        }
      } else if (faltan.length > 0) {
        control = {
          tipo: 'galicia_total',
          seccion: t.etiqueta,
          moneda: moneda ?? 'ARS',
          cobertura,
          informado: candidatos[0].valor as string,
          calculado: null,
          ok: null,
          detalle: `No verificable: falta el valorizado de ${faltan.map((f) => f.fila.ticker || f.fila.clave).join(', ')}.`,
          tolerancia: null,
        }
      } else {
        const sumandos = filasMoneda.map((f) => f.valorizado as NumeroLeido)
        const pruebas = candidatos.map((c) => ({ c, r: chequeoSuma(sumandos, c) }))
        const elegido = pruebas.find((p) => p.r.ok) ?? pruebas[0]
        const difieren = la?.valor && lb?.valor && la.valor !== lb.valor
        control = {
          tipo: 'galicia_total',
          seccion: t.etiqueta,
          moneda: moneda ?? 'ARS',
          cobertura,
          informado: elegido.c.valor as string,
          calculado: elegido.r.calculado.toFixed(),
          ok: elegido.r.ok,
          detalle:
            `Suma de ${sumandos.length} valorizado${sumandos.length === 1 ? '' : 's'}: ${fmtPlata(elegido.r.calculado, moneda)}` +
            ` ${elegido.r.ok ? '≈' : '≠'} ${fmtPlata(new Decimal(elegido.c.valor as string), moneda)} de la captura (tolerancia ±${fmtPlata(elegido.r.tolerancia, moneda, 4)}).` +
            (difieren ? ` Lectura A: ${corto(t.a)} · Lectura B: ${corto(t.b)}.` : ''),
          tolerancia: elegido.r.tolerancia.toFixed(),
        }
        if (!elegido.r.ok) {
          degradar(sec.titulo, `La suma de los valorizados no da "${t.etiqueta}" de la captura: ¿falta una fila o hay un número mal leído?`, moneda ?? 'ARS')
          advertencias.push(`"${t.etiqueta}": ${control.detalle}`)
        }
      }
      controles.push(control)
      trazaTotales.push({ seccion: sec.titulo, etiqueta: t.etiqueta, a: t.a, b: t.b, control })
    }

    // Rendimiento acumulado: controla los rendimientos $ que deciden el PPC.
    const ra = sec.a?.rendimiento_acumulado ?? null
    const rb = sec.b?.rendimiento_acumulado ?? null
    const candidatosR = [
      leerNumeroCaptura(ra?.monto ?? null, ra?.direccion ?? null),
      leerNumeroCaptura(rb?.monto ?? null, rb?.direccion ?? null),
    ].filter((x): x is NumeroLeido => x !== null && x.valor !== null)
    if (candidatosR.length > 0 && filasSec.length > 0) {
      if (filasSec.every((f) => f.rendimiento !== null)) {
        const pruebas = candidatosR.map((c) => ({ c, r: chequeoSuma(filasSec.map((f) => f.rendimiento as NumeroLeido), c) }))
        const elegido = pruebas.find((p) => p.r.ok) ?? pruebas[0]
        trazaTotales.push({
          seccion: sec.titulo,
          etiqueta: 'Rendimiento acumulado',
          a: ra,
          b: rb,
          calculado: elegido.r.calculado.toFixed(),
          informado: elegido.c.valor,
          ok: elegido.r.ok,
        })
        if (!elegido.r.ok) {
          const m = candidatosR[0].moneda
          const detalle = `la suma de los rendimientos (${fmtPlata(elegido.r.calculado, m)}) no da el rendimiento acumulado de la captura (${fmtPlata(new Decimal(elegido.c.valor as string), m)})`
          degradar(sec.titulo, `${detalle[0].toUpperCase()}${detalle.slice(1)}: el PPC puede estar mal.`)
          advertencias.push(`${sec.titulo ?? 'Galicia'}: ${detalle}.`)
        }
      }
    }
  }

  if (armadas.length > 0 && controles.length === 0) {
    advertencias.push('La captura no muestra el total de la sección: la suma no quedó controlada.')
  }

  return {
    filas: armadas.map((f) => f.fila),
    controles,
    advertencias,
    traza: {
      filas: Object.fromEntries(armadas.map((f) => [f.fila.clave, f.traza])),
      totales: trazaTotales,
    },
  }
}

// ───────────── Mercado Pago ─────────────

function monedaMP(mp: MercadoPagoModelo | null): Moneda | null {
  if (!mp) return null
  const s = `${mp.simbolo_moneda ?? ''} ${mp.pestana ?? ''}`.toUpperCase()
  if (/U\$D|US\$|U\$S|USD|D[OÓ]LAR/.test(s)) return 'USD'
  if (/\$|PESO|ARS/.test(s)) return 'ARS'
  return null
}

function armarMercadoPago(a: SalidaModelo | null, b: SalidaModelo | null): { saldos: SaldoLeido[]; advertencias: string[]; traza: Record<string, unknown> } {
  const ma = a?.mercado_pago ?? null
  const mb = b?.mercado_pago ?? null
  const ta = ma ? unirEnteroYDecimales(ma.saldo_entero, ma.saldo_decimales) : null
  const tb = mb ? unirEnteroYDecimales(mb.saldo_entero, mb.saldo_decimales) : null
  const sa = leerNumeroCaptura(ta)
  const sb = leerNumeroCaptura(tb)
  const va = valorDe(sa)
  const vb = valorDe(sb)
  const advertencias: string[] = []
  if (va === null && vb === null) {
    throw new ErrorCaptura('ilegible', 'el saldo es ilegible en las dos lecturas. Probá con otra captura, sin nada que tape el número.', {
      cuenta: 'Mercado Pago',
    })
  }
  const motivos: string[] = []
  const alternativas: Alternativa[] = []
  let estado: EstadoFila = 'verificada'
  const mostrar = (m: MercadoPagoModelo | null, t: string | null) =>
    t === null ? (m?.saldo_entero ? `"${corto(`${m.saldo_entero}${m.saldo_decimales ? ` + ${m.saldo_decimales}` : ''}`)}" (ilegible)` : 'ilegible') : `$ ${corto(t)}`
  if (va !== vb) {
    motivos.push(`Saldo — Lectura A: ${mostrar(ma, ta)} · Lectura B: ${mostrar(mb, tb)} (se propone la ${va !== null ? 'A' : 'B'}).`)
    alternativas.push({ campo: 'monto', a: va ?? mostrar(ma, ta), b: vb ?? mostrar(mb, tb), propuesta: va !== null ? 'A' : 'B' })
    estado = 'advertencia'
  }
  const ca = monedaMP(ma)
  const cb = monedaMP(mb)
  let moneda: Moneda = ca ?? cb ?? 'ARS'
  if (ca && cb && ca !== cb) {
    motivos.push(`Moneda — Lectura A: ${ca} · Lectura B: ${cb} (se propone la A).`)
    alternativas.push({ campo: 'moneda', a: ca, b: cb, propuesta: 'A' })
    estado = 'advertencia'
    moneda = ca
  } else if (!ca && !cb) {
    motivos.push('No se ve la moneda del saldo: se toma en pesos.')
    estado = 'advertencia'
  }
  // TNA: solo si las dos lecturas la ven igual. Se guarda en porcentaje, como la
  // anuncia la captura (27,5% → "27.5"), que es como la muestra la bandeja.
  const tnaA = leerPorcentaje(ma?.tna ?? null)
  const tnaB = leerPorcentaje(mb?.tna ?? null)
  let tna: string | null = null
  if (tnaA?.valor && tnaA.valor === tnaB?.valor) {
    tna = tnaA.valor
  } else if (tnaA?.valor || tnaB?.valor) {
    advertencias.push(`TNA — Lectura A: ${corto(ma?.tna ?? 'no la vio')} · Lectura B: ${corto(mb?.tna ?? 'no la vio')}: queda sin dato.`)
  }
  const monto = (va ?? vb) as string
  const saldo: SaldoLeido = {
    moneda,
    monto,
    partes: [],
    tna,
    estado,
    motivos,
    lugar: `captura de Mercado Pago, saldo${ma?.pestana || mb?.pestana ? ` de la pestaña ${ma?.pestana ?? mb?.pestana}` : ''}`,
    ...(alternativas.length ? { alternativas } : {}),
  }
  return {
    saldos: [saldo],
    advertencias,
    traza: {
      saldo: { a: ta, b: tb, elegido: va !== null ? 'A' : 'B' },
      tna: { a: ma?.tna ?? null, b: mb?.tna ?? null },
      rendimiento: { a: ma?.rendimiento ?? null, b: mb?.rendimiento ?? null, periodo: ma?.rendimiento_periodo ?? mb?.rendimiento_periodo ?? null },
      tope: { a: ma?.tope ?? null, b: mb?.tope ?? null },
    },
  }
}

// ───────────── La lectura completa ─────────────

const CUENTA_DE: Record<'galicia' | 'mercado_pago', NombreCuenta> = { galicia: 'Galicia', mercado_pago: 'Mercado Pago' }
const FUENTE_DE: Partial<Record<NombreCuenta, 'galicia' | 'mercado_pago'>> = { Galicia: 'galicia', 'Mercado Pago': 'mercado_pago' }
const NOMBRE_FUENTE: Record<SalidaModelo['fuente'], string> = { galicia: 'Galicia', mercado_pago: 'Mercado Pago', otra: 'otra cosa' }

/**
 * Decide de qué banco es la captura con las dos lecturas (la pantalla manda;
 * la pista solo desempata). Lanza ErrorCaptura si no es ninguno o si las
 * lecturas se contradicen.
 */
export function decidirFuente(
  a: SalidaModelo['fuente'],
  b: SalidaModelo['fuente'],
  pista?: NombreCuenta,
): { fuente: 'galicia' | 'mercado_pago'; advertencia: string | null } {
  const pistaF = pista ? FUENTE_DE[pista] : undefined
  if (a === 'otra' && b === 'otra') {
    throw new ErrorCaptura('no_reconocida', 'no parece una pantalla de inversiones de Galicia ni el saldo de Mercado Pago.', { cuenta: pista ?? null })
  }
  if (a === b) {
    const f = a as 'galicia' | 'mercado_pago'
    return {
      fuente: f,
      advertencia: pistaF && pistaF !== f ? `La pegaste como ${pista}, pero es una captura de ${CUENTA_DE[f]}.` : null,
    }
  }
  if (a === 'otra' || b === 'otra') {
    const f = (a === 'otra' ? b : a) as 'galicia' | 'mercado_pago'
    return { fuente: f, advertencia: `Una de las lecturas no reconoció la pantalla; la otra dice ${CUENTA_DE[f]}.` }
  }
  if (pistaF && (a === pistaF || b === pistaF)) {
    return { fuente: pistaF, advertencia: `Las lecturas no coinciden en el banco (A: ${NOMBRE_FUENTE[a]} · B: ${NOMBRE_FUENTE[b]}); se toma ${pista}, como la pegaste.` }
  }
  throw new ErrorCaptura(
    'fuente_dudosa',
    `las dos lecturas no se ponen de acuerdo en de qué banco es (A: ${NOMBRE_FUENTE[a]} · B: ${NOMBRE_FUENTE[b]}). Decime de cuál es y la vuelvo a leer.`,
  )
}

/**
 * Arma la LecturaCuenta a partir de las dos lecturas del modelo: compara
 * celda por celda, verifica la aritmética y deja todo en la lectura cruda.
 * Una fila es `verificada` solo si las dos lecturas coinciden y la cuenta
 * cierra (más el total de la captura, si aparece).
 */
export function armarLecturaCaptura(entrada: {
  a: LecturaModelo
  b: LecturaModelo
  pista?: NombreCuenta
  /** Metadatos de la imagen y del pedido para la lectura cruda (hash, tipo, tamaño…). */
  extra?: Record<string, unknown>
  advertencias?: string[]
}): LecturaCuenta {
  const { a, b, pista } = entrada
  const { fuente, advertencia } = decidirFuente(a.datos.fuente, b.datos.fuente, pista)
  const cuenta = CUENTA_DE[fuente]
  const advertencias: string[] = [...(entrada.advertencias ?? [])]
  if (advertencia) advertencias.push(advertencia)
  // Una lectura que dijo "otra" no aporta datos: se compara contra nada.
  const da = a.datos.fuente === fuente ? a.datos : null
  const db = b.datos.fuente === fuente ? b.datos : null

  // Fecha: solo si las dos lecturas ven la misma.
  const fa = leerFechaCaptura(da?.fecha ?? null)
  const fb = leerFechaCaptura(db?.fecha ?? null)
  let fecha_reporte: Fecha | null = null
  if (fa.fecha && fa.fecha === fb.fecha) {
    fecha_reporte = fa.fecha
  } else if (fa.fecha || fb.fecha) {
    advertencias.push(`Fecha de la captura — Lectura A: ${corto(da?.fecha ?? 'no la vio')} · Lectura B: ${corto(db?.fecha ?? 'no la vio')}: la fecha la decide la carga.`)
  } else if (fa.motivo ?? fb.motivo) {
    advertencias.push((fa.motivo ?? fb.motivo) as string)
  }

  let filas: FilaLeida[] = []
  let saldos: SaldoLeido[] = []
  let controles: ControlLeido[] = []
  let traza: Record<string, unknown> = {}
  try {
    if (fuente === 'galicia') {
      const g = armarGalicia(da, db)
      filas = g.filas
      controles = g.controles
      advertencias.push(...g.advertencias)
      traza = g.traza
      if (filas.length === 0 && controles.length === 0) {
        throw new ErrorCaptura('ilegible', 'no encontré ninguna posición ni total en la pantalla. Capturá la tabla de Bonos (o de Fondos).')
      }
    } else {
      const m = armarMercadoPago(da, db)
      saldos = m.saldos
      advertencias.push(...m.advertencias)
      traza = m.traza
    }
  } catch (e) {
    throw e instanceof ErrorCaptura ? e.conCuenta(cuenta) : e
  }

  const lector = `${VERSION_LECTOR} (${a.modelo} + ${b.modelo})`
  return {
    cuenta,
    origen: 'captura',
    fecha_reporte,
    filas,
    saldos,
    controles,
    advertencias,
    lector,
    cruda: {
      lector,
      fuente,
      pista: pista ?? null,
      ...(entrada.extra ?? {}),
      lecturas: [a, b].map((l) => ({
        id: l.id,
        modelo: l.modelo,
        modelo_pedido: l.modelo_pedido,
        variante: l.variante,
        ...(l.meta ?? {}),
        texto: l.texto,
        datos: l.datos,
      })),
      verificacion: traza,
    },
  }
}
