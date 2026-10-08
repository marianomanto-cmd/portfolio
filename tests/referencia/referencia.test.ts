// Cruce del motor contra la implementación de referencia (docs/calidad.md §1,
// "Implementación de referencia").
//
// tests/referencia/motor_referencia.py se escribió a partir de los documentos
// (spec, D-12, D-14, D-18, D-19, D-32, D-35 y vision.md), sin mirar este motor.
// tests/referencia/generar_casos.py arma ~300 casos al azar con semilla fija
// (números inventados) y guarda en casos.json las entradas y las salidas de la
// referencia. Este test arma los Hechos de cada caso, corre el motor y compara
// cada salida: tenencia y PPC, foto, desglose del intervalo por partida y en
// total, y desglose desde la compra. Tolerancia: 1e-12 relativo (o 1e-18
// absoluto, para los ceros). "Sin dato" tiene que coincidir con "sin dato".
//
// Para regenerar los casos: python3 tests/referencia/generar_casos.py
// Con REFERENCIA_SALIDA=<archivo.json>, además escribe todas las diferencias.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { financieros, foto, sumaCalc } from '@/lib/domain/foto'
import { ppcCalc, tenencias } from '@/lib/domain/posiciones'
import type { Activo, Hechos, Operacion, TipoActivo, TipoCambio } from '@/lib/domain/tipos'
import { parteCalc, variacion, type Contribucion } from '@/lib/domain/variacion'
import { armarCartera } from '@/lib/vistas/armar'

type Txt = string | null

interface OpCaso {
  id: number
  fecha: string
  fecha_origen?: string
  tipo: Operacion['tipo']
  cantidad: string
  precio: Txt
  importe: Txt
  comisiones: string
  ccl: Txt
}

interface PartidaCaso {
  activo: string
  riesgo: 'ARS' | 'USD'
  clase: 'cedear' | 'accion' | 'bono'
  etiquetas: string[]
  operaciones: OpCaso[]
  precios: { fecha: string; precio: string }[]
}

interface FotoRef {
  cantidad: string
  costo_ars: Txt
  costo_usd: Txt
  ppc_ars: Txt
  ppc_usd: Txt
  valor_ars: Txt
  valor_usd: Txt
}

const CAMPOS_VARIACION = [
  'resultado_ars',
  'resultado_usd',
  'activo_ars',
  'tc_ars',
  'sin_atribuir_ars',
  'activo_usd',
  'tc_usd',
  'sin_atribuir_usd',
] as const
type CampoVariacion = (typeof CAMPOS_VARIACION)[number]
type VarRef = Record<CampoVariacion, Txt> & { atribuible?: boolean; ancla?: string }

interface DesdeCompraRef {
  resultado_ars: Txt
  resultado_usd: Txt
  activo_ars: Txt
  tc_ars: Txt
  activo_usd: Txt
  tc_usd: Txt
}

interface Caso {
  id: string
  etiquetas: string[]
  t0: string
  t1: string
  ccl: Record<string, Txt>
  partidas: PartidaCaso[]
  esperado: {
    partidas: Record<
      string,
      {
        foto_t0: FotoRef
        foto_t1: FotoRef
        variacion: VarRef
        variacion_anclada: VarRef | null
        desde_compra_t1: DesdeCompraRef | null
      }
    >
    totales: Record<string, { total: Txt; parcial: Txt; faltan: number }>
  }
}

interface Diferencia {
  caso: string
  partida: string
  riesgo: string
  etiquetas: string[]
  campo: string
  referencia: Txt
  motor: Txt
}

const casos: Caso[] = JSON.parse(readFileSync(path.join(import.meta.dirname, 'casos.json'), 'utf8')).casos

// ───────────── Hechos a partir de un caso ─────────────

const TIPO: Record<PartidaCaso['clase'], TipoActivo> = { cedear: 'cedear', accion: 'accion_local', bono: 'bono' }
const D = (x: string) => new Decimal(x)
const Dn = (x: Txt | undefined) => (x === null || x === undefined ? null : new Decimal(x))

function hechos(c: Caso): Hechos {
  const activos: Activo[] = c.partidas.map((p, i) => ({
    id: i + 1,
    ticker: p.activo,
    nombre: p.activo,
    tipo: TIPO[p.clase],
    moneda_riesgo: p.riesgo,
    geografia: p.riesgo === 'USD' ? 'US' : 'AR',
    indexacion: p.clase === 'bono' ? 'fija' : null,
    ticker_subyacente: p.clase === 'cedear' ? p.activo : null,
    fecha_vencimiento: null,
    color: null,
    activo_bool: true,
  }))
  const operaciones: Operacion[] = c.partidas.flatMap((p, i) =>
    p.operaciones.map((o) => ({
      id: o.id,
      fecha: o.fecha,
      fecha_origen: o.fecha_origen ?? null,
      cuenta_id: 1,
      activo_id: i + 1,
      tipo: o.tipo,
      cantidad: D(o.cantidad),
      moneda: 'ARS' as const,
      precio: Dn(o.precio),
      importe: Dn(o.importe),
      comisiones: D(o.comisiones),
      ccl_del_dia: Dn(o.ccl),
      carga_id: 1,
      notas: null,
    })),
  )
  const cotizaciones = c.partidas.flatMap((p, i) =>
    p.precios.map((x) => ({ fecha: x.fecha, activo_id: i + 1, precio_pesos: D(x.precio), precio_usd_subyacente: null, carga_id: 1 })),
  )
  const tipos_cambio: TipoCambio[] = Object.entries(c.ccl).map(([fecha, ccl]) => ({
    fecha,
    ccl: Dn(ccl),
    mep: null,
    cripto_venta: null,
    oficial: null,
    carga_id: 1,
  }))
  return {
    cuentas: [{ id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true }],
    activos,
    operaciones,
    cotizaciones,
    tipos_cambio,
    saldos: [],
    movimientos: [],
    pasivos: [],
    pasivo_saldos: [],
    bienes: [],
    valuaciones: [],
    feriados: [],
    cargas: [],
  }
}

// ───────────── Comparación ─────────────

const REL = new Decimal('1e-12')
const ABS = new Decimal('1e-18')

function texto(x: Decimal | string | null | undefined): Txt {
  if (x === null || x === undefined) return null
  return typeof x === 'string' ? x : x.toFixed()
}

function igual(ref: Txt, motor: Txt): boolean {
  if (ref === null || motor === null) return ref === null && motor === null
  const r = new Decimal(ref)
  const m = new Decimal(motor)
  const dif = r.minus(m).abs()
  return dif.lte(ABS) || dif.lte(Decimal.max(r.abs(), m.abs()).times(REL))
}

const valorContrib = (x: Contribucion, campo: CampoVariacion): Decimal => {
  const [parte, moneda] = [campo.slice(0, campo.lastIndexOf('_')), campo.slice(campo.lastIndexOf('_') + 1)] as [
    'resultado' | 'activo' | 'tc' | 'sin_atribuir',
    'ars' | 'usd',
  ]
  return x[parte][moneda]
}

/** Compara todas las salidas de un caso. Devuelve las diferencias. */
function cruzar(c: Caso): { diferencias: Diferencia[]; anclada: Diferencia[] } {
  const h = hechos(c)
  const diferencias: Diferencia[] = []
  const anclada: Diferencia[] = []
  const id = new Map(c.partidas.map((p, i) => [p.activo, i + 1]))
  const ver = (p: PartidaCaso | null, campo: string, referencia: Txt, motor: Decimal | string | null | undefined, lista = diferencias) => {
    const m = texto(motor)
    if (!igual(referencia, m))
      lista.push({ caso: c.id, partida: p?.activo ?? 'total', riesgo: p?.riesgo ?? '', etiquetas: p?.etiquetas ?? c.etiquetas, campo, referencia, motor: m })
  }

  // Tenencia, PPC y foto en t0 y en t1.
  for (const [fecha, cual] of [
    [c.t0, 't0'],
    [c.t1, 't1'],
  ] as const) {
    const ten = tenencias(h.operaciones, fecha)
    const f = foto(h, fecha)
    const items = new Map(f.items.map((i) => [i.clave, i]))
    for (const p of c.partidas) {
      const r = c.esperado.partidas[p.activo][`foto_${cual}`]
      const t = ten.get(`1:${id.get(p.activo)}`)
      const it = items.get(`p:1:${id.get(p.activo)}`)
      if (D(r.cantidad).isZero()) {
        if (t || it) ver(p, `${cual}.cantidad`, '0', t?.cantidad ?? 'presente')
        continue
      }
      if (!t || !it) {
        ver(p, `${cual}.tenencia`, r.cantidad, null)
        continue
      }
      ver(p, `${cual}.cantidad`, r.cantidad, t.cantidad)
      ver(p, `${cual}.costo_ars`, r.costo_ars, t.costo_ars)
      ver(p, `${cual}.costo_usd`, r.costo_usd, t.costo_usd)
      ver(p, `${cual}.ppc_ars`, r.ppc_ars, ppcCalc(t, 'ARS').valor)
      ver(p, `${cual}.ppc_usd`, r.ppc_usd, ppcCalc(t, 'USD').valor)
      ver(p, `${cual}.valor_ars`, r.valor_ars, it.valor_ars.valor)
      ver(p, `${cual}.valor_usd`, r.valor_usd, it.valor_usd.valor)
    }
    const fin = financieros(f)
    for (const m of ['ars', 'usd'] as const) {
      const total = sumaCalc(
        fin.map((i) => ({ nombre: i.nombre, calc: m === 'ars' ? i.valor_ars : i.valor_usd })),
        m === 'ars' ? 'ARS' : 'USD',
        '',
      )
      ver(null, `${cual}.total_valor_${m}`, c.esperado.totales[`valor_${m}_${cual}`].total, total.valor)
    }
  }

  // Desglose del intervalo t0 → t1 (D-35), por partida y en total.
  const v = variacion(h, c.t0, c.t1)
  const contrib = new Map(v.contribuciones.map((x) => [x.clave, x]))
  for (const p of c.partidas) {
    const r = c.esperado.partidas[p.activo].variacion
    const x = contrib.get(`p:1:${id.get(p.activo)}`)
    for (const campo of CAMPOS_VARIACION) ver(p, `variacion.${campo}`, r[campo], x ? valorContrib(x, campo) : null)
    const ra = c.esperado.partidas[p.activo].variacion_anclada
    if (ra) for (const campo of CAMPOS_VARIACION) ver(p, `variacion_anclada.${campo}`, ra[campo], x ? valorContrib(x, campo) : null, anclada)
  }
  for (const campo of CAMPOS_VARIACION) {
    const parte = campo.slice(0, campo.lastIndexOf('_')) as 'resultado' | 'activo' | 'tc' | 'sin_atribuir'
    const moneda = campo.endsWith('_ars') ? 'ARS' : 'USD'
    ver(null, `variacion.total_${campo}`, c.esperado.totales[`variacion_${campo}`].total, parteCalc(v, h, 'financiero', parte, moneda).valor)
  }

  // Desde la compra, en la cartera al cierre de t1.
  const cartera = armarCartera(h, c.t1)
  const filas = new Map(cartera.filas.map((f) => [f.clave, f]))
  for (const p of c.partidas) {
    const r = c.esperado.partidas[p.activo].desde_compra_t1
    const fila = filas.get(`p:1:${id.get(p.activo)}`)
    if (r === null) {
      if (fila) ver(p, 'desde_compra.fila', null, 'presente')
      continue
    }
    if (!fila) {
      ver(p, 'desde_compra.fila', 'presente', null)
      continue
    }
    ver(p, 'desde_compra.resultado_ars', r.resultado_ars, fila.resultado.ars.valor)
    ver(p, 'desde_compra.resultado_usd', r.resultado_usd, fila.resultado.usd.valor)
    const [ma, mt] = p.riesgo === 'USD' ? [r.activo_ars, r.tc_ars] : [r.activo_usd, r.tc_usd]
    const d = fila.desglose
    if (d && d.moneda !== (p.riesgo === 'USD' ? 'ARS' : 'USD')) ver(p, 'desde_compra.moneda_desglose', p.riesgo === 'USD' ? 'ARS' : 'USD', d.moneda)
    ver(p, `desde_compra.activo_${p.riesgo === 'USD' ? 'ars' : 'usd'}`, ma, d?.activo.valor ?? null)
    ver(p, `desde_compra.tc_${p.riesgo === 'USD' ? 'ars' : 'usd'}`, mt, d?.tc.valor ?? null)
  }
  return { diferencias, anclada }
}

// ───────────── Tests ─────────────

describe('motor contra la implementación de referencia (calidad.md §1)', () => {
  const todas: Diferencia[] = []
  const anclada: Diferencia[] = []

  it('hay casos', () => {
    expect(casos.length).toBeGreaterThanOrEqual(300)
  })

  for (const c of casos) {
    it(`${c.id}: ${c.partidas.map((p) => `${p.activo}/${p.riesgo}[${p.etiquetas.join(',')}]`).join(' ')}`, () => {
      let r: ReturnType<typeof cruzar>
      try {
        r = cruzar(c)
      } catch (e) {
        r = {
          diferencias: [{ caso: c.id, partida: '-', riesgo: '', etiquetas: c.etiquetas, campo: 'excepcion', referencia: null, motor: String(e) }],
          anclada: [],
        }
      }
      todas.push(...r.diferencias)
      anclada.push(...r.anclada)
      expect(r.diferencias).toEqual([])
    })
  }

  it('resumen', () => {
    const destino = process.env.REFERENCIA_SALIDA
    if (destino) writeFileSync(destino, JSON.stringify({ diferencias: todas, anclada }, null, 1))
    expect(true).toBe(true)
  })
})
