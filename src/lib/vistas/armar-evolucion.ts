// Arma la vista de Evolución y PnL (plan §4 B.3) a partir de los Hechos y de lo
// que traen Pasivos y Flujo. Función pura: se testea sin base. Todo cálculo
// sale de src/lib/domain/resultados.ts (y del motor); acá solo se elige el
// período, se serializa (Calc → CalcVista) y se arma la traza de lo que llega
// de Flujo ya calculado (la proyección), con su etiqueta "supuesto".

import { calc, deCalc, sinDato, vista, type Calc, type CalcVista, type DobleCalc, type Etiqueta } from '@/lib/domain/calc'
import { Decimal, monto, porcentaje } from '@/lib/domain/dinero'
import { conjuntoFeriados, fechaCorta, sumarDias } from '@/lib/domain/fechas'
import { foto, indexar } from '@/lib/domain/foto'
import type { FlujoReal, ProyeccionVista, RecurrenteBase } from '@/lib/domain/flujo/tipos'
import type { AperturaCuota, Cuota } from '@/lib/domain/pasivos/tipos'
import {
  agruparResultados,
  capitalAportado,
  estadoResultados,
  nombreMes,
  noRealizadoAlDiaCero,
  patrimonio,
  pnlPorMes,
  puente,
  resultadosPorPartida,
  sensibilidadCcl,
  serieEvolucion,
  totalColumna,
  variacionConCuotas,
  type GrupoResultados,
  type LineaPuente,
  type Puente,
  type ResultadoPartida,
} from '@/lib/domain/resultados'
import type { Fecha, Hechos, Moneda } from '@/lib/domain/tipos'
import { fechasDeCarga } from '@/lib/domain/variacion'
import { frase } from './armar'
import type { Par } from './contratos'
import type {
  ContribuyenteVista,
  FilaResultado,
  FuturoVista,
  GrupoVista,
  LineaPuenteVista,
  MesFuturoVista,
  ParametrosEvolucion,
  PuenteVista,
  VistaEvolucion,
} from './contratos-evolucion'

/** Lo que Evolución recibe de Pasivos y de Flujo. Vacío por defecto: lo conecta la integración (plan §10). */
export interface EntradasEvolucion {
  /** Cuotas del cuadro de marcha (para el puente: las pagadas desde tus cuentas, con fecha y cuenta). */
  cuotas: readonly Cuota[]
  /** La apertura de cada cuota que pagás vos (aperturaCuota de Pasivos), para el estado de resultados. */
  leasing: readonly AperturaCuota[]
  /** Lo cargado con "Cargar ingreso" y "Cargar gasto" (flujos_reales). */
  flujos: readonly FlujoReal[]
  /** Ingresos y gastos declarados (ingresos_fijos, gastos_fijos). */
  recurrentes: readonly RecurrenteBase[]
  /** ¿La empresa te reintegra el IVA y la percepción? null = sin declarar. */
  reintegra_iva: boolean | null
  /** Con el cuadro importado y ninguna cuota tuya: las paga la empresa (EntradasResultados). */
  leasing_vacio?: 'empresa' | null
  /** Los meses sin su cuota de un cuadro de marcha incompleto (para el estado de resultados). */
  sin_cuota?: readonly { motivo: string; meses: readonly Fecha[] }[]
  /** La proyección del escenario elegido (proyectar() de Flujo). */
  futuro: ProyeccionVista | null
  /** Los supuestos de ese escenario, codificados para "Ajustar supuestos" (?s= de Flujo). */
  futuro_s?: string | null
  /** Los escenarios guardados, del más nuevo al más viejo, para cambiar el que se muestra. */
  escenarios?: { id: number; nombre: string }[]
  /** ¿Hay algún escenario guardado? Sin ninguno, el bloque Futuro invita a armar el primero. */
  hay_escenarios: boolean
}

export const SIN_ENTRADAS: EntradasEvolucion = { cuotas: [], leasing: [], flujos: [], recurrentes: [], reintegra_iva: null, futuro: null, hay_escenarios: false }

const par = (d: DobleCalc): Par => ({ ars: vista(d.ars), usd: vista(d.usd) })
const kDe = (m: Moneda) => (m === 'ARS' ? 'ars' : 'usd')

// ───────────── El período ─────────────

/** El mismo día de hace `meses` meses (si no existe, el último del mes). */
function mesesAtras(f: Fecha, meses: number): Fecha {
  const [a, m, d] = f.split('-').map(Number)
  const total = a * 12 + (m - 1) - meses
  const a2 = Math.floor(total / 12)
  const m2 = (total % 12) + 1
  const ultimo = new Date(Date.UTC(a2, m2, 0)).getUTCDate()
  return `${a2}-${String(m2).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

/**
 * Las fechas de carga que delimitan el período elegido: hasta la última carga
 * y desde la última carga en o antes del corte (la semana, el mes, tres meses),
 * o desde el día cero. "Elegir fechas" acepta dos fechas con carga.
 */
export function resolverPeriodo(fechas: Fecha[], p: ParametrosEvolucion): { desde: Fecha | null; hasta: Fecha | null; aviso: string | null } {
  if (!fechas.length) return { desde: null, hasta: null, aviso: null }
  const primera = fechas[0]
  const ultima = fechas.at(-1)!
  if (fechas.length === 1) return { desde: primera, hasta: primera, aviso: null }
  const desdeCorte = (corte: Fecha) => [...fechas].reverse().find((d) => d <= corte && d < ultima) ?? primera
  switch (p.periodo) {
    case 'semana':
      return { desde: desdeCorte(sumarDias(ultima, -7)), hasta: ultima, aviso: null }
    case 'mes':
      return { desde: desdeCorte(mesesAtras(ultima, 1)), hasta: ultima, aviso: null }
    case '3m':
      return { desde: desdeCorte(mesesAtras(ultima, 3)), hasta: ultima, aviso: null }
    case 'elegir': {
      const ok = p.desde && p.hasta && fechas.includes(p.desde) && fechas.includes(p.hasta) && p.desde < p.hasta
      if (ok) return { desde: p.desde, hasta: p.hasta, aviso: null }
      return { desde: primera, hasta: ultima, aviso: 'Elegí dos fechas con carga, la primera antes que la segunda. Mientras tanto, ves desde el día cero.' }
    }
    default:
      return { desde: primera, hasta: ultima, aviso: null }
  }
}

// ───────────── Serialización ─────────────

function lineasVista(lineas: LineaPuente[]): LineaPuenteVista[] {
  return lineas.map((l) => ({ clave: l.clave, nombre: l.nombre, valor: { ars: vista(l.ars), usd: vista(l.usd) }, informativa: l.informativa }))
}

function puenteVista(p: Puente): PuenteVista {
  return {
    desde: p.desde,
    hasta: p.hasta,
    lineas: lineasVista(p.lineas),
    cuadre: { ok: p.cuadre.ok, diferencia: { ars: vista(p.cuadre.ars), usd: vista(p.cuadre.usd) }, detalle: p.cuadre.detalle },
    cuotas_fuera: p.cuotas_fuera.map((c) => c.motivo),
  }
}

/** Qué parte del resultado del período es una fila (en cada moneda). */
function pesoDelResultado(fila: Calc, total: Calc, m: Moneda): CalcVista {
  const explicacion = 'Qué parte del resultado del período explica esta fila. Con resultados de signo distinto, una fila puede pesar más del 100%.'
  const insumos = [deCalc('Su resultado', fila, m), deCalc('El resultado del período', total, m)]
  if (fila.valor === null || total.valor === null || total.valor.isZero())
    return vista(sinDato(fila.valor === null ? (fila.motivo ?? 'Falta el resultado de la fila.') : 'El resultado del período es "sin dato" o cero: no hay sobre qué repartir.', insumos, { explicacion }))
  const f = fila.valor.div(total.valor)
  return vista(
    calc(f, `${monto(fila.valor, m, { decimales: 2, signo: true })} ÷ ${monto(total.valor, m, { decimales: 2, signo: true })} = ${porcentaje(f, { signo: true })}`, insumos, { explicacion }),
  )
}

function filasVista(rs: ResultadoPartida[], total: DobleCalc): FilaResultado[] {
  return rs.map((r) => ({
    clave: r.clave,
    nombre: r.nombre,
    ticker: r.ticker,
    cuenta: r.cuenta,
    clase: r.clase,
    color: r.color,
    resultado: par(r.resultado),
    activo: par(r.activo),
    tc: par(r.tc),
    sin_atribuir: par(r.sin_atribuir),
    realizado: r.realizado === 'no_aplica' ? null : par(r.realizado),
    no_realizado: r.no_realizado === 'no_aplica' ? null : par(r.no_realizado),
    no_aplica: r.no_aplica,
    peso: { ars: pesoDelResultado(r.resultado.ars, total.ars, 'ARS'), usd: pesoDelResultado(r.resultado.usd, total.usd, 'USD') },
  }))
}

function gruposVista(gs: GrupoResultados[], total: DobleCalc): GrupoVista[] {
  return gs.map((g) => ({
    clave: g.clave,
    nombre: g.nombre,
    claves: g.claves,
    resultado: par(g.resultado),
    activo: par(g.activo),
    tc: par(g.tc),
    sin_atribuir: par(g.sin_atribuir),
    realizado: g.realizado === 'no_aplica' ? null : par(g.realizado),
    no_realizado: g.no_realizado === 'no_aplica' ? null : par(g.no_realizado),
    peso: { ars: pesoDelResultado(g.resultado.ars, total.ars, 'ARS'), usd: pesoDelResultado(g.resultado.usd, total.usd, 'USD') },
  }))
}

// ───────────── Futuro (lo que llega de Flujo) ─────────────

const NOMBRE_CAMPO = { financiero: 'Patrimonio financiero', aportes: 'Aportes del excedente', activo: 'Resultado por el precio supuesto', tc: 'Resultado por el dólar supuesto' } as const

/**
 * Una cifra proyectada ya calculada por Flujo, con su traza: de qué escenario
 * y mes sale, con la etiqueta "supuesto" (y las del mes). La traza completa,
 * mes por mes, está en Flujo y escenarios.
 */
function cifraSupuesta(valor: string | null, campo: keyof typeof NOMBRE_CAMPO, mes: Fecha, escenario: string, m: Moneda, etiquetas: Etiqueta[]): CalcVista {
  const et: Etiqueta[] = [...new Set<Etiqueta>(['supuesto', ...etiquetas])]
  const explicacion = `Proyección determinística del escenario «${escenario}», con tus supuestos: no es un pronóstico ni una recomendación. Cada número de este mes se abre, con su fórmula, en Flujo y escenarios.`
  if (valor === null) return vista(sinDato(`El escenario «${escenario}» no tiene este número para ${nombreMes(mes)}: le falta un supuesto o un dato.`, [], { explicacion, etiquetas: et }))
  const d = new Decimal(valor)
  return vista(
    calc(d, `${NOMBRE_CAMPO[campo]} de ${nombreMes(mes)} en «${escenario}» = ${monto(d, m, { decimales: 2, signo: campo !== 'financiero' })}`, [{ nombre: 'Escenario', valor: escenario, unidad: 'texto' }, { nombre: 'Mes', valor: mes, unidad: 'fecha' }], {
      explicacion,
      etiquetas: et,
    }),
  )
}

export function futuroVista(pv: ProyeccionVista, s: string | null, guardados: { id: number; nombre: string }[] = []): FuturoVista {
  const nombre = pv.escenario.nombre
  const meses: MesFuturoVista[] = pv.proyeccion.meses
    .filter((m) => !m.real)
    .map((m) => {
      const c = (campo: keyof typeof NOMBRE_CAMPO, x: { ars: string | null; usd: string | null }): Par => ({
        ars: cifraSupuesta(x.ars, campo, m.mes, nombre, 'ARS', m.etiquetas),
        usd: cifraSupuesta(x.usd, campo, m.mes, nombre, 'USD', m.etiquetas),
      })
      return { mes: m.mes, nombre: nombreMes(m.mes), financiero: c('financiero', m.financiero), aportes: c('aportes', m.pnl.aportes), activo: c('activo', m.pnl.activo), tc: c('tc', m.pnl.tc), etiquetas: m.etiquetas }
    })
  return {
    escenario: pv.escenario,
    estado: pv.proyeccion.estado,
    faltan: pv.proyeccion.faltan,
    meses: pv.proyeccion.estado === 'lista' ? meses : [],
    // Con el escenario guardado, también su número: Flujo lo abre como tal y "Guardar cambios" lo actualiza.
    ajustar: s ? `/flujo?s=${s}${pv.escenario.id !== null ? `&e=${pv.escenario.id}` : ''}` : '/flujo',
    otros: guardados.filter((g) => g.id !== pv.escenario.id),
  }
}

// ───────────── La vista ─────────────

export function armarEvolucion(h: Hechos, hoy: Fecha, p: ParametrosEvolucion, e: EntradasEvolucion = SIN_ENTRADAS): VistaEvolucion {
  const fechas = fechasDeCarga(h)
  const { desde, hasta, aviso } = resolverPeriodo(fechas, p)
  const base = {
    hoy,
    parametros: p,
    fechas,
    desde,
    hasta,
    primera: fechas[0] ?? null,
    aviso_periodo: aviso,
    contribuyentes: [] as ContribuyenteVista[],
    filas: [] as FilaResultado[],
    totales: null,
    grupos: { cuenta: [] as GrupoVista[], activo: [] as GrupoVista[] },
    meses: [],
    futuro: e.futuro ? futuroVista(e.futuro, e.futuro_s ?? p.s, e.escenarios) : null,
    hay_escenarios: e.hay_escenarios || e.futuro !== null,
  }
  if (!desde || !hasta) {
    const n = vista(sinDato('Todavía no hay cargas.'))
    return { ...base, estado: 'sin_cargas', ccl: n, fecha_ccl: null, inicio: null, actual: null, frase: null, puente: null, serie: [], aportado: [], al_dia_cero: null, sensibilidad: null, resultados: null }
  }
  const ix = indexar(h)
  const fUlt = foto(h, hasta, { hoy, ix })
  const fIni = foto(h, fechas[0], { hoy, ix })
  const unDia = desde === hasta
  const opciones = { cuotas: e.cuotas, ix }
  // Todo lo que el estado de resultados necesita del leasing: también por qué está vacío y los meses sin cuota.
  const entradas = { leasing: e.leasing, flujos: e.flujos, recurrentes: e.recurrentes, reintegra_iva: e.reintegra_iva, cuotas: e.cuotas, leasing_vacio: e.leasing_vacio ?? null, sin_cuota: e.sin_cuota ?? [] }
  const resultadosDe = estadoResultados(h, entradas, desde, hasta, hoy, { un_dia: unDia, ix })
  const resultados = {
    desde: resultadosDe.desde,
    hasta: resultadosDe.hasta,
    etiqueta: resultadosDe.un_dia ? `${nombreMes(resultadosDe.hasta.slice(0, 8) + '01')}, el mes en curso` : textoPeriodo(desde, hasta),
    un_dia: resultadosDe.un_dia,
    lineas: resultadosDe.lineas.map((l) => ({ clave: l.clave, nombre: l.nombre, valor: { ars: vista(l.ars), usd: vista(l.usd) }, signo: l.signo, rotulo: l.rotulo, nota: l.nota })),
  }
  const diaCero = noRealizadoAlDiaCero(h, hoy, { ix })
  const sens = sensibilidadCcl(fUlt, new Decimal('0.01'))
  const comunes = {
    ccl: vista(fUlt.ccl),
    fecha_ccl: fUlt.fecha_ccl,
    inicio: par(patrimonio(h, fIni, p.vista)),
    actual: par(patrimonio(h, fUlt, p.vista)),
    serie: serieEvolucion(h, p.vista, hoy, { ix }),
    aportado: capitalAportado(h, p.vista, hoy, opciones),
    al_dia_cero: diaCero ? { fecha: diaCero.fecha, filas: diaCero.filas.map((f) => ({ ...f, valor: par(f.valor), costo: par(f.costo), resultado: par(f.resultado) })), total: par(diaCero.total) } : null,
    sensibilidad: { pct: sens.pct.toFixed(), ars: vista(sens.ars), usd: vista(sens.usd), base_usd: par(sens.base_usd), base_pesos: par(sens.base_pesos) },
    resultados,
  }
  if (unDia) {
    return { ...base, ...comunes, estado: 'un_dia', frase: null, puente: puenteVista(puente(h, desde, hasta, p.vista, hoy, opciones)) }
  }
  const { v, hechos: H } = variacionConCuotas(h, desde, hasta, hoy, e.cuotas)
  const f = frase(v, H, desde, hasta, conjuntoFeriados(h.feriados, 'AR'), hoy, fUlt)
  const rs = resultadosPorPartida(h, desde, hasta, hoy, { vista: p.vista, cuotas: e.cuotas, ix })
  const posiciones = rs.filter((r) => r.clase === 'posicion')
  const totales = {
    resultado: totalColumna(rs, (r) => r.resultado, 'El resultado del período de todas las partidas de la vista.'),
    activo: totalColumna(rs, (r) => r.activo, 'Lo que pusieron tus activos en sí (D-35).'),
    tc: totalColumna(rs, (r) => r.tc, 'Lo que puso el tipo de cambio (D-35).'),
    sin_atribuir: totalColumna(rs, (r) => r.sin_atribuir, 'Lo que todavía no se puede separar entre activo y tipo de cambio (sin precio o saldo nuevo).'),
    realizado: totalColumna(posiciones, (r) => r.realizado, 'Lo realizado de tus títulos: ventas, vencimientos y rentas menos el costo de lo vendido (D-135).'),
    no_realizado: totalColumna(posiciones, (r) => r.no_realizado, 'Lo no realizado de tus títulos (D-135).'),
  }
  const contribuyentes: ContribuyenteVista[] = rs
    .filter((r) => r.clase === 'posicion' || r.clase === 'saldo')
    .map((r) => ({ clave: r.clave, nombre: r.nombre, ticker: r.ticker, cuenta: r.cuenta, color: r.color, resultado: par(r.resultado), activo: par(r.activo), tc: par(r.tc) }))
  const elegida: Moneda = p.moneda === 'usd' ? 'USD' : 'ARS'
  const abs = (c: ContribuyenteVista) => (c.resultado[kDe(elegida)].valor === null ? new Decimal(-1) : new Decimal(c.resultado[kDe(elegida)].valor as string).abs())
  contribuyentes.sort((a, b) => abs(b).cmp(abs(a)))
  return {
    ...base,
    ...comunes,
    estado: 'periodo',
    frase: f,
    puente: puenteVista(puente(h, desde, hasta, p.vista, hoy, opciones)),
    contribuyentes,
    filas: filasVista(rs, totales.resultado),
    grupos: { cuenta: gruposVista(agruparResultados(rs, 'cuenta'), totales.resultado), activo: gruposVista(agruparResultados(rs, 'activo'), totales.resultado) },
    totales: {
      resultado: par(totales.resultado),
      activo: par(totales.activo),
      tc: par(totales.tc),
      sin_atribuir: par(totales.sin_atribuir),
      realizado: par(totales.realizado),
      no_realizado: par(totales.no_realizado),
    },
    meses: pnlPorMes(h, desde, hasta, p.vista, hoy, opciones).map((m) => ({
      mes: m.mes,
      nombre: nombreMes(m.mes),
      parcial: m.parcial,
      desde: m.desde,
      hasta: m.hasta,
      lineas: lineasVista(m.puente.lineas),
      cuadre_ok: m.puente.cuadre.ok,
    })),
  }
}

/** "Del mié 07/10 al mié 14/10" */
export function textoPeriodo(desde: Fecha, hasta: Fecha): string {
  return desde === hasta ? `el ${fechaCorta(desde)}` : `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`
}

