// Piezas puras del panel de supuestos (plan §6 D.1; D-08, D-145, D-155): el
// texto exacto de "Igual" de cada variable, el deslizante (de a 0,1, dentro de
// su rango), los atajos del horizonte, los cambios a los supuestos (siempre
// una copia nueva), los valores recordados y lo que cambia entre dos
// escenarios. Sin React y sin Decimal en lo que cruza: lo usan el panel, la
// pantalla y Evolución (que abre el mismo panel), y sus tests.

import { calc, sinDato, vista, type Calc, type CalcVista, type Etiqueta, type Insumo } from '../calc'
import { CERO, Decimal, monto, numero, porcentaje } from '../dinero'
import { nombreMes } from './proyeccion'
import { indiceMes, metaVariable, type ClaveVariable } from './supuestos'
import type { BaseProyeccion, Direccion, MesProyectado, Proyeccion, Supuestos, Tramo, TramoIngreso, Var } from './tipos'

/** Dónde vive una variable en los supuestos: 'devaluacion.0', 'ingreso_usd.1', 'retorno.cedear', 'dual.TXMJ0', 'casa'… */
export type RutaVar = string

/** La clave del catálogo (nombre, rango, textos) de una ruta: saca el número de tramo. */
export function claveDeRuta(ruta: RutaVar): ClaveVariable {
  const [a, b] = ruta.split('.')
  if (a === 'retorno') return `retorno.${b}` as ClaveVariable
  if (a === 'dual') return ruta.slice(0, 5 + (b?.length ?? 0)) as ClaveVariable
  return a as ClaveVariable
}

/** La variable de una ruta (null si no existe: un tramo que ya no está, un dual que no tenés). */
export function leerVar(s: Supuestos, ruta: RutaVar): Var | null {
  const [a, b] = ruta.split('.')
  switch (a) {
    case 'devaluacion':
    case 'inflacion':
    case 'ingreso_usd':
    case 'ingreso_pesos': {
      const ts = s[a] as Var[]
      return ts[Number(b)] ?? null
    }
    case 'retorno':
      return (s.retorno as Record<string, Var>)[b] ?? null
    case 'dual':
      return s.dual[b] ?? null
    case 'brecha_cripto':
    case 'tem_renovacion':
    case 'casa':
    case 'camioneta':
    case 'gastos':
      return s[a]
    default:
      return null
  }
}

/** Una copia de los supuestos con la variable de esa ruta cambiada (conserva lo demás del tramo). */
export function conVar(s: Supuestos, ruta: RutaVar, v: Var): Supuestos {
  const out: Supuestos = structuredClone(s)
  const [a, b] = ruta.split('.')
  const mezclar = <T extends Var>(x: T): T => ({ ...x, dir: v.dir, valor: v.valor })
  switch (a) {
    case 'devaluacion':
    case 'inflacion': {
      const i = Number(b)
      if (out[a][i]) out[a][i] = mezclar(out[a][i])
      return out
    }
    case 'ingreso_usd':
    case 'ingreso_pesos': {
      const i = Number(b)
      if (out[a][i]) out[a][i] = mezclar(out[a][i])
      return out
    }
    case 'retorno':
      if (b === 'cedear' || b === 'accion_local' || b === 'liquidez_pesos') out.retorno[b] = mezclar(out.retorno[b])
      return out
    case 'dual':
      out.dual[b] = mezclar(out.dual[b] ?? { dir: null, valor: null })
      return out
    case 'gastos':
      out.gastos = mezclar(out.gastos)
      return out
    case 'brecha_cripto':
    case 'tem_renovacion':
    case 'casa':
    case 'camioneta':
      out[a] = mezclar(out[a])
      return out
    default:
      return out
  }
}

/** La clave de un valor recordado (valores_recordados.variable: minúsculas, sin el tramo): 'devaluacion.sube'. */
export function claveRecordada(ruta: RutaVar, dir: Exclude<Direccion, 'igual'>): string {
  return `${claveDeRuta(ruta)}.${dir}`.toLowerCase()
}

/**
 * Tocar Baja, Igual o Sube. Igual no lleva número. Baja o Sube arrancan con el
 * último número que elegiste para esa variable (D-08), o sin número: el
 * deslizante lo pone el dueño, nada se elige solo.
 */
export function elegirDireccion(v: Var, dir: Direccion, recordado: string | null): Var {
  if (dir === 'igual') return { dir, valor: null }
  if (v.dir === dir) return v
  return { dir, valor: recordado }
}

/** El deslizante: de a 0,1, entre 0 y el máximo de la dirección. */
export function pasoDeslizante(valor: string | null, delta: number, max: number): string {
  const x = new Decimal(valor ?? '0').plus(delta)
  const acotado = Decimal.min(new Decimal(max), Decimal.max(CERO, x))
  return acotado.toDecimalPlaces(1).toFixed(1)
}

/** El número del deslizante, tal como llega del control (texto "2.5"), acotado y redondeado a 0,1. */
export function valorDeslizante(texto: string, max: number): string | null {
  if (!/^\d+(\.\d+)?$/.test(texto.trim())) return null
  return pasoDeslizante(texto.trim(), 0, max)
}

const fmtTc = (x: Decimal) => `$ ${numero(x, 2)}`

/** "Igual =": el texto exacto de lo que significa Igual en esa variable, con los datos de hoy. */
export function textoIgual(ruta: RutaVar, base: BaseProyeccion): string {
  const clave = claveDeRuta(ruta)
  const ccl = base.ccl ? new Decimal(base.ccl) : null
  const cripto = base.cripto ? new Decimal(base.cripto) : null
  switch (true) {
    case clave === 'devaluacion':
      return ccl ? `el CCL queda en el de tu última carga (${fmtTc(ccl)})` : 'el CCL queda en el de tu última carga (sin dato: falta el CCL)'
    case clave === 'inflacion':
      return '0%/mes: solo mueve lo que ataste a la inflación'
    case clave === 'brecha_cripto': {
      if (!ccl || !cripto) return 'la de hoy: sin dato, falta el dólar cripto de tu última carga'
      const b = cripto.div(ccl).minus(1).times(100)
      return `la de hoy: cripto ${fmtTc(cripto)} contra CCL ${fmtTc(ccl)} (${numero(b, 2, { signo: true })} pts)`
    }
    case clave === 'ingreso_usd':
    case clave === 'ingreso_pesos': {
      const moneda = clave === 'ingreso_usd' ? 'USD' : 'ARS'
      const vig = base.recurrentes.filter((r) => r.sentido === 'ingreso' && r.moneda === moneda && r.vigente_hasta === null)
      if (!vig.length) return 'lo que declaraste en ese tramo (todavía no declaraste ninguno)'
      const total = vig.reduce((a, r) => a.plus(r.monto), CERO)
      return `lo declarado en ese tramo (hoy ${monto(total, moneda, { decimales: 2 })} por mes)${moneda === 'ARS' ? ', nominal' : ''}`
    }
    case clave === 'gastos': {
      const vig = base.recurrentes.filter((r) => r.sentido === 'gasto' && r.vigente_hasta === null && r.frecuencia === 'mensual')
      if (!vig.length) return 'los declarados, nominales'
      const ars = vig.filter((r) => r.moneda === 'ARS').reduce((a, r) => a.plus(r.monto), CERO)
      return `los declarados, nominales (hoy ${monto(ars, 'ARS', { decimales: 2 })} por mes${vig.some((r) => r.moneda === 'USD') ? ' más lo que tenés en dólares' : ''})`
    }
    case clave === 'retorno.cedear':
    case clave === 'retorno.accion_local':
    case clave === 'retorno.liquidez_pesos':
      return 'precio quieto: 0%/año'
    case clave === 'tem_renovacion': {
      const cs = base.partidas.filter((p) => p.ley === 'cronograma' && p.tem != null && p.valor.ars !== null && Number(p.valor.ars) > 0)
      if (!cs.length) return 'la TEM implícita de hoy de tus letras (sin dato: falta su pago al vencimiento)'
      const tot = cs.reduce((a, p) => a.plus(p.valor.ars as string), CERO)
      const tem = cs.reduce((a, p) => a.plus(new Decimal(p.tem as string).times(p.valor.ars as string)), CERO).div(tot)
      return `la TEM implícita de hoy de tus letras, ponderada por valor (${porcentaje(tem, { decimales: 2 })} por mes)`
    }
    case clave === 'casa': {
      const b = base.bienes.find((x) => x.pasivo_id === null)
      return b?.valor ? `mismo valor (${monto(b.valor, b.moneda, { decimales: 0 })})` : 'mismo valor'
    }
    case clave === 'camioneta': {
      const b = base.bienes.find((x) => x.pasivo_id !== null)
      return b?.valor ? `mismo valor (${monto(b.valor, b.moneda, { decimales: 0 })})` : 'mismo valor'
    }
    case clave.startsWith('dual.'):
      return 'el precio de hoy por VN, quieto hasta su vencimiento'
    default:
      return 'lo de hoy'
  }
}

/** Los atajos del horizonte: los elige el dueño (ninguno arranca elegido). */
export function atajosHorizonte(base: BaseProyeccion): { meses: number; texto: string }[] {
  const out = [
    { meses: 6, texto: '6 meses' },
    { meses: 12, texto: '12 meses' },
    { meses: 24, texto: '24 meses' },
  ]
  const fin = mesesHastaFinLeasing(base)
  if (fin !== null && fin >= 1 && fin <= 120 && !out.some((x) => x.meses === fin)) out.push({ meses: fin, texto: `fin del leasing (${fin})` })
  return out
}

/** Meses desde la carga hasta la última cuota del leasing (o la opción de compra). null sin cuotas. */
export function mesesHastaFinLeasing(base: BaseProyeccion): number | null {
  const ult = base.cuotas.reduce<string | null>((a, c) => (a === null || c.fecha_vencimiento > a ? c.fecha_vencimiento : a), null)
  return ult ? Math.max(1, indiceMes(base.fecha, ult)) : null
}

/** El nombre del mes N contado desde la carga ("desde el mes 4 · feb-27"). */
export function nombreMesN(base: Pick<BaseProyeccion, 'fecha'>, n: number): string {
  const [a, m] = base.fecha.split('-').map(Number)
  const t = a * 12 + (m - 1) + n
  return nombreMes(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`)
}

/** Las rutas de las variables que muestra el panel para esta base (las que no se usan no se muestran). */
export function rutasDelPanel(base: BaseProyeccion, s: Supuestos): { grupo: string; rutas: RutaVar[] }[] {
  const nec = {
    usd: base.recurrentes.some((r) => r.sentido === 'ingreso' && r.moneda === 'USD'),
    pesos: base.recurrentes.some((r) => r.sentido === 'ingreso' && r.moneda === 'ARS'),
    gastos: base.recurrentes.some((r) => r.sentido === 'gasto'),
    cedear: base.partidas.some((p) => p.clase === 'cedear') || s.politica.clase === 'cedear',
    accion: base.partidas.some((p) => p.clase === 'accion_local'),
    liquidez: base.partidas.some((p) => (p.clase === 'liquidez' || p.clase === 'fci') && p.moneda_riesgo === 'ARS'),
    letras: base.partidas.some((p) => p.ley === 'cronograma' || p.ley === 'sin_cronograma'),
    casa: base.bienes.some((b) => b.pasivo_id === null),
    camioneta: base.bienes.some((b) => b.pasivo_id !== null),
  }
  const grupos: { grupo: string; rutas: RutaVar[] }[] = []
  const mercado: RutaVar[] = s.devaluacion.map((_, i) => `devaluacion.${i}`)
  if (nec.usd) mercado.push('brecha_cripto')
  if (s.gastos.atado_inflacion) mercado.push(...s.inflacion.map((_, i) => `inflacion.${i}`))
  grupos.push({ grupo: 'Mercado', rutas: mercado })
  const ingresos: RutaVar[] = []
  if (nec.usd) ingresos.push(...s.ingreso_usd.map((_, i) => `ingreso_usd.${i}`))
  if (nec.pesos) ingresos.push(...s.ingreso_pesos.map((_, i) => `ingreso_pesos.${i}`))
  if (nec.gastos) ingresos.push('gastos')
  if (ingresos.length) grupos.push({ grupo: 'Tus ingresos y gastos', rutas: ingresos })
  const cartera: RutaVar[] = []
  if (nec.cedear) cartera.push('retorno.cedear')
  if (nec.accion) cartera.push('retorno.accion_local')
  if (nec.liquidez) cartera.push('retorno.liquidez_pesos')
  if (nec.letras) cartera.push('tem_renovacion')
  for (const t of Object.keys(s.dual)) cartera.push(`dual.${t}`)
  if (cartera.length) grupos.push({ grupo: 'Tu cartera', rutas: cartera })
  const bienes: RutaVar[] = []
  if (nec.casa) bienes.push('casa')
  if (nec.camioneta) bienes.push('camioneta')
  if (bienes.length) grupos.push({ grupo: 'Tus bienes', rutas: bienes })
  return grupos
}

/** El nombre de una variable en el panel, con su tramo ("Ingreso en dólares · desde feb-27"). */
export function nombreVariable(ruta: RutaVar, s: Supuestos, base: Pick<BaseProyeccion, 'fecha'>): string {
  const meta = metaVariable(claveDeRuta(ruta))
  const [a, b] = ruta.split('.')
  if (a === 'ingreso_usd' || a === 'ingreso_pesos') {
    const ts = s[a]
    const t = ts[Number(b)] as TramoIngreso | undefined
    if (!t || ts.length === 1) return meta.nombre
    // El primero rige desde ahora; los demás, desde su mes (también uno "desde el mes 1").
    return `${meta.nombre} · desde ${Number(b) === 0 ? 'ahora' : nombreMesN(base, t.desde_mes)}`
  }
  if (a === 'devaluacion' || a === 'inflacion') {
    const ts = s[a] as Tramo[]
    if (ts.length === 1) return meta.nombre
    const i = Number(b)
    const desde = i === 0 ? 0 : (ts[i - 1].hasta_mes ?? 0) + 1
    const hasta = ts[i]?.hasta_mes ?? null
    if (hasta === 0) return `${meta.nombre} · este mes`
    return `${meta.nombre} · ${i === 0 ? 'desde ahora' : `desde ${nombreMesN(base, desde)}`}${hasta !== null ? ` hasta ${nombreMesN(base, hasta)}` : ''}`
  }
  return meta.nombre
}

/** Agrega un tramo "desde el mes N" a una variable por tramos (ingreso) o "hasta el mes N" (devaluación, inflación). */
export function agregarTramo(s: Supuestos, variable: 'ingreso_usd' | 'ingreso_pesos' | 'devaluacion' | 'inflacion', mes: number): Supuestos {
  const out: Supuestos = structuredClone(s)
  const n = Math.max(2, Math.min(120, Math.round(mes)))
  if (variable === 'ingreso_usd' || variable === 'ingreso_pesos') {
    if (out[variable].length >= 6 || out[variable].some((t) => t.desde_mes === n)) return out
    out[variable].push({ dir: null, valor: null, desde_mes: n, crecimiento_anual: null, ajuste_mensual: null })
    out[variable].sort((x, y) => x.desde_mes - y.desde_mes)
    return out
  }
  const ts = out[variable]
  if (ts.length >= 6) return out
  const ult = ts[ts.length - 1]
  const desde = ts.length > 1 ? (ts[ts.length - 2].hasta_mes ?? 0) + 1 : 1
  if (n - 1 < desde) return out
  ult.hasta_mes = n - 1
  ts.push({ dir: null, valor: null, hasta_mes: null })
  return out
}

/** El ajuste mensual del ingreso en pesos de un tramo (%/mes, 0 a 15); null = nominal. */
export const AJUSTE_MAXIMO = 15

export function conAjuste(s: Supuestos, i: number, valor: string | null): Supuestos {
  const out: Supuestos = structuredClone(s)
  const t = out.ingreso_pesos[i]
  if (!t) return out
  t.ajuste_mensual = valor === null ? null : pasoDeslizante(valor, 0, AJUSTE_MAXIMO)
  return out
}

/** Saca un tramo (el primero no se saca). */
export function sacarTramo(s: Supuestos, variable: 'ingreso_usd' | 'ingreso_pesos' | 'devaluacion' | 'inflacion', i: number): Supuestos {
  const out: Supuestos = structuredClone(s)
  if (i <= 0 || i >= out[variable].length) return out
  if (variable === 'ingreso_usd' || variable === 'ingreso_pesos') {
    out[variable].splice(i, 1)
    return out
  }
  const ts = out[variable]
  // El tramo anterior se estira hasta donde llegaba el que se sacó.
  const [quitado] = ts.splice(i, 1)
  ts[i - 1].hasta_mes = quitado.hasta_mes
  return out
}

/** Los valores para "Guardar" (valores_recordados): el número de cada deslizante movido, por variable y dirección. */
export function recordadosDe(s: Supuestos): Record<string, string> {
  const out: Record<string, string> = {}
  const ver = (ruta: RutaVar, v: Var | null) => {
    if (!v || v.valor === null || (v.dir !== 'baja' && v.dir !== 'sube')) return
    out[claveRecordada(ruta, v.dir)] = new Decimal(v.valor).abs().toFixed()
  }
  s.devaluacion.forEach((v, i) => ver(`devaluacion.${i}`, v))
  s.inflacion.forEach((v, i) => ver(`inflacion.${i}`, v))
  s.ingreso_usd.forEach((v, i) => ver(`ingreso_usd.${i}`, v))
  s.ingreso_pesos.forEach((v, i) => ver(`ingreso_pesos.${i}`, v))
  for (const r of ['brecha_cripto', 'gastos', 'retorno.cedear', 'retorno.accion_local', 'retorno.liquidez_pesos', 'tem_renovacion', 'casa', 'camioneta']) ver(r, leerVar(s, r))
  for (const t of Object.keys(s.dual)) ver(`dual.${t}`, s.dual[t])
  return out
}

/** Lo que cambia entre dos escenarios, en palabras (Comparar muestra solo esto). Sin valorar: no dice cuál es "mejor". */
export function diferencias(a: Supuestos, b: Supuestos, base: Pick<BaseProyeccion, 'fecha'>): string[] {
  const out: string[] = []
  const desc = (v: Var | null, ruta: RutaVar) => {
    if (!v || v.dir === null) return 'sin elegir'
    if (v.dir === 'igual') return 'Igual'
    const meta = metaVariable(claveDeRuta(ruta))
    if (v.valor === null) return v.dir === 'baja' ? 'Baja (sin número)' : 'Sube (sin número)'
    return `${v.dir === 'baja' ? 'Baja −' : 'Sube +'}${numero(new Decimal(v.valor).abs(), 1)}${meta.unidad === 'puntos' ? ' pts' : meta.unidad}`
  }
  const rutas = new Set<RutaVar>()
  const agregar = (s: Supuestos) => {
    s.devaluacion.forEach((_, i) => rutas.add(`devaluacion.${i}`))
    s.inflacion.forEach((_, i) => rutas.add(`inflacion.${i}`))
    s.ingreso_usd.forEach((_, i) => rutas.add(`ingreso_usd.${i}`))
    s.ingreso_pesos.forEach((_, i) => rutas.add(`ingreso_pesos.${i}`))
    for (const r of ['brecha_cripto', 'gastos', 'retorno.cedear', 'retorno.accion_local', 'retorno.liquidez_pesos', 'tem_renovacion', 'casa', 'camioneta']) rutas.add(r)
    for (const t of Object.keys(s.dual)) rutas.add(`dual.${t}`)
  }
  agregar(a)
  agregar(b)
  for (const r of rutas) {
    const x = desc(leerVar(a, r), r)
    const y = desc(leerVar(b, r), r)
    if (x !== y) out.push(`${nombreVariable(r, a.ingreso_usd.length >= b.ingreso_usd.length ? a : b, base)}: ${x} · ${y}`)
  }
  const ajustes = (x: Supuestos) => x.ingreso_pesos.map((t) => (t.ajuste_mensual ? `${numero(t.ajuste_mensual, 1)}%/mes` : 'nominal')).join(' y ')
  if (ajustes(a) !== ajustes(b)) out.push(`Ajuste del ingreso en pesos: ${ajustes(a)} · ${ajustes(b)}`)
  if (a.horizonte_meses !== b.horizonte_meses) out.push(`Horizonte: ${a.horizonte_meses ?? 'sin elegir'} · ${b.horizonte_meses ?? 'sin elegir'} meses`)
  if (a.politica.pct !== b.politica.pct || a.politica.regla !== b.politica.regla) {
    out.push(`Lo que invertís del excedente: ${numero(a.politica.pct, 0)}% · ${numero(b.politica.pct, 0)}%${a.politica.regla !== b.politica.regla ? ' (con otro reparto)' : ''}`)
  }
  if ((a.pagador_cuota?.quien ?? null) !== (b.pagador_cuota?.quien ?? null)) {
    const q = (x: Supuestos) => (x.pagador_cuota === null ? 'sin elegir' : x.pagador_cuota.quien === 'titular' ? 'vos' : 'la empresa')
    out.push(`Quién paga la cuota: ${q(a)} · ${q(b)}`)
  }
  if (a.reintegro_iva !== b.reintegro_iva) {
    const r = (x: Supuestos) => (x.reintegro_iva === null ? 'sin elegir' : x.reintegro_iva ? 'sí' : 'no')
    out.push(`La empresa te reintegra el IVA: ${r(a)} · ${r(b)}`)
  }
  return out
}

// ───────────── Al horizonte (con traza) ─────────────

const D = (x: string | null) => (x === null ? null : new Decimal(x))

/** La suma de una línea de todos los meses proyectados (sin el mes de la carga), con su traza. */
function sumaMeses(meses: readonly MesProyectado[], leer: (m: MesProyectado) => string | null, moneda: 'ARS' | 'USD', nombre: string, etiquetas: Etiqueta[]): CalcVista {
  const insumos: Insumo[] = meses.map((m) => ({ nombre: `${nombre} de ${nombreMes(m.mes)}`, valor: leer(m), unidad: moneda }))
  const falta = meses.find((m) => leer(m) === null)
  if (!meses.length) return vista(sinDato(`No hay meses proyectados: elegí un horizonte.`, [], { etiquetas }))
  if (falta) return vista(sinDato(`${nombre} de ${nombreMes(falta.mes)} es sin dato: ${falta.motivos?.excedente ?? 'falta un supuesto o un dato de ese mes'}.`, insumos, { etiquetas }))
  const total = meses.reduce((a, m) => a.plus(D(leer(m)) as Decimal), CERO)
  const c: Calc = calc(total, `Σ ${nombre.toLowerCase()} de ${nombreMes(meses[0].mes)} a ${nombreMes(meses[meses.length - 1].mes)} (${meses.length} meses) = ${monto(total, moneda, { decimales: 2 })}`, insumos, {
    etiquetas,
    explicacion: 'Sale del escenario: es una proyección con tus supuestos, no un pronóstico ni una recomendación.',
  })
  return vista(c)
}

export interface ResumenHorizonte {
  mes: string | null
  excedente: { ars: CalcVista; usd: CalcVista }
  invertido: { ars: CalcVista; usd: CalcVista }
}

/** El excedente y lo invertido acumulados hasta el horizonte (las cajas de arriba de la proyección). */
export function resumenHorizonte(p: Proyeccion): ResumenHorizonte | null {
  if (p.estado !== 'lista' || !p.meses.length) return null
  // Desde la carga: el resto del mes en curso y los proyectados (los cerrados ya pasaron).
  const meses = p.meses.filter((m) => m.estado !== 'cerrado' && !m.real)
  const etiquetas: Etiqueta[] = ['supuesto']
  return {
    mes: meses.length ? meses[meses.length - 1].mes : null,
    excedente: {
      ars: sumaMeses(meses, (m) => m.excedente.ars, 'ARS', 'Excedente', etiquetas),
      usd: sumaMeses(meses, (m) => m.excedente.usd, 'USD', 'Excedente', etiquetas),
    },
    invertido: {
      ars: sumaMeses(meses, (m) => m.invertido.ars, 'ARS', 'Invertido', etiquetas),
      usd: sumaMeses(meses, (m) => m.invertido.usd, 'USD', 'Invertido', etiquetas),
    },
  }
}
