// Fase 3 de la revisión adversarial, área motor: un test de regresión por
// hallazgo. Cada uno falló antes de su arreglo. Hechos armados a mano, con
// números inventados (D-24).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { financieros, foto } from '@/lib/domain/foto'
import type { Activo, Ausente, Cuenta, Fecha, Hechos, Operacion, Saldo, TipoCambio } from '@/lib/domain/tipos'
import { cuadre, variacion } from '@/lib/domain/variacion'
import { armarCartera, armarExposicion, armarHoy } from '@/lib/vistas/armar'
import { ejemploHoy } from '@/lib/vistas/ejemplo'

// ───────────── Fábrica de hechos ─────────────

const D = (x: Decimal | string | number) => new Decimal(x)
const IEB = 1
const GALICIA = 2
const MP = 3

const CUENTAS: Cuenta[] = [
  { id: IEB, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: GALICIA, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
  { id: MP, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]

const activo = (id: number, ticker: string, tipo: Activo['tipo'], moneda: 'ARS' | 'USD'): Activo => ({
  id,
  ticker,
  nombre: ticker,
  tipo,
  moneda_riesgo: moneda,
  geografia: tipo === 'cedear' ? 'US' : 'AR',
  indexacion: tipo === 'bono' || tipo === 'lecap' ? 'fija' : null,
  ticker_subyacente: tipo === 'cedear' ? ticker : null,
  fecha_vencimiento: null,
  color: null,
  activo_bool: true,
})

const SPY = activo(1, 'SPY', 'cedear', 'USD')
const AL30 = activo(2, 'AL30', 'bono', 'ARS')
const S13N6 = activo(3, 'S13N6', 'lecap', 'ARS')
const S28F7 = activo(4, 'S28F7', 'lecap', 'ARS')
const XOM = activo(5, 'XOM', 'cedear', 'USD')
const TODOS = [SPY, AL30, S13N6, S28F7, XOM]

let idOp = 1
const op = (o: Partial<Operacion> & Pick<Operacion, 'fecha' | 'activo_id' | 'tipo' | 'cantidad'>): Operacion => ({
  id: idOp++,
  fecha_origen: null,
  cuenta_id: IEB,
  moneda: 'ARS',
  precio: null,
  importe: null,
  comisiones: D(0),
  ccl_del_dia: null,
  carga_id: 1,
  notas: null,
  ...o,
})
const tc = (fecha: Fecha, ccl: string | number): TipoCambio => ({ fecha, ccl: D(ccl), mep: null, cripto_venta: null, oficial: null, carga_id: 1 })
const cot = (fecha: Fecha, activo_id: number, precio: string | number) => ({ fecha, activo_id, precio_pesos: D(precio), precio_usd_subyacente: null, carga_id: 1 })
const saldo = (fecha: Fecha, cuenta_id: number, moneda: 'ARS' | 'USD', m: string | number): Saldo => ({ fecha, cuenta_id, moneda, monto: D(m), carga_id: 1 })
const ausente = (fecha: Fecha, activo_id: number, cuenta_id = IEB, carga_id = 77): Ausente => ({ fecha, activo_id, cuenta_id, carga_id })

function hechos(p: Partial<Hechos> = {}): Hechos {
  return {
    cuentas: CUENTAS,
    activos: TODOS,
    operaciones: [],
    cotizaciones: [],
    tipos_cambio: [],
    saldos: [],
    movimientos: [],
    pasivos: [],
    pasivo_saldos: [],
    bienes: [],
    valuaciones: [],
    feriados: [],
    cargas: [],
    ...p,
  }
}

const txt = (v: Decimal | string | null | undefined) => (v === null || v === undefined ? 'sin dato' : D(v).toFixed(2))

// ═════════════════════════════════════════════════════════════════════════
// Crítico: una tenencia que la fuente ya no lista (venta total o vencimiento)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Escenario del revisor (verificar-plata-0-0, ieb-venta-total): el lunes 05/10
 * IEB tiene 100 SPY a $10.000, AL30 por $80.000 y $0 de pesos (CCL 1.000). El
 * martes vendés todo SPY: el Excel ya no la trae y el saldo dice $1.000.000.
 * La bandeja solo permite dejarla pendiente, así que la venta no se graba.
 */
function ventaTotalSpy(conVenta = false): Hechos {
  const ops = [
    op({ fecha: '2026-10-05', activo_id: SPY.id, tipo: 'apertura', cantidad: D(100), precio: D(9000) }),
    op({ fecha: '2026-10-05', activo_id: AL30.id, tipo: 'apertura', cantidad: D(100000), precio: D('0.79') }),
  ]
  if (conVenta) ops.push(op({ fecha: '2026-10-06', activo_id: SPY.id, tipo: 'venta', cantidad: D(100), precio: D(10000), ccl_del_dia: D(1000) }))
  return hechos({
    operaciones: ops,
    tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000), tc('2026-10-07', 1000)],
    cotizaciones: [cot('2026-10-05', SPY.id, 10000), cot('2026-10-05', AL30.id, '0.8'), cot('2026-10-06', AL30.id, '0.8'), cot('2026-10-07', AL30.id, '0.8')],
    saldos: [saldo('2026-10-05', IEB, 'ARS', 0), saldo('2026-10-06', IEB, 'ARS', 1000000), saldo('2026-10-07', IEB, 'ARS', 1000000)],
    ausentes: [ausente('2026-10-06', SPY.id)],
  })
}

describe('ausentes: la fuente ya no lista una tenencia y la venta no está registrada', () => {
  it('la foto la vale "sin dato" desde la fecha de la carga que la declaró ausente, con el motivo y su carga', () => {
    const h = ventaTotalSpy()
    const lunes = foto(h, '2026-10-05').items.find((i) => i.clave === `p:${IEB}:${SPY.id}`)!
    expect(txt(lunes.valor_ars.valor)).toBe('1000000.00') // antes de la ausencia, vale normal
    const martes = foto(h, '2026-10-06').items.find((i) => i.clave === `p:${IEB}:${SPY.id}`)!
    expect(martes.valor_ars.valor).toBeNull()
    expect(martes.valor_usd.valor).toBeNull()
    expect(martes.valor_ars.motivo).toBe('IEB ya no la lista desde el mar 06/10: registrá la venta o el vencimiento en Cargar.')
    expect(martes.valor_usd.motivo).toBe(martes.valor_ars.motivo)
    expect(martes.ausente?.fecha).toBe('2026-10-06')
    // La traza conserva la cantidad, el último precio y la carga que la declaró ausente.
    const nombres = martes.valor_ars.insumos.map((i) => i.nombre)
    expect(nombres).toContain('Cantidad de SPY')
    expect(martes.valor_ars.insumos.some((i) => i.origen?.carga_id === 77)).toBe(true)
  })

  it('Hoy: el patrimonio financiero queda "sin dato · parcial" con la suma parcial, y la venta no se lee como ganancia', () => {
    const h = ventaTotalSpy()
    const v = armarHoy(h, '2026-10-06')
    expect(v.financiero.valor.ars.valor).toBeNull()
    expect(v.financiero.valor.ars.etiquetas).toContain('parcial')
    expect(v.financiero.valor.ars.motivo).toContain('$ 1.080.000,00') // AL30 $80.000 + pesos $1.000.000, sin SPY
    expect(v.financiero.valor.usd.valor).toBeNull()
    // Antes: variación +$1.000.000 "por tus activos" y cuadre ✓.
    expect(v.financiero.variacion?.ars.valor).toBeNull()
    expect(v.financiero.variacion?.ars.etiquetas).toContain('parcial')
    expect(v.frase?.variacion.ars.valor).toBeNull()
    expect(v.cuadre.ars_ok).toBeNull()
    expect(v.cuadre.detalle).toContain('SPY')
  })

  it('Hoy › frase: dice qué falta y por qué, sin repartir cifras que no existen (antes: "el CCL le sin dato a tus pesos")', () => {
    const f = armarHoy(ventaTotalSpy(), '2026-10-06').frase!
    const texto = f.partes.map((p) => p.texto).join('')
    expect(texto).toBe(
      'Desde la carga del lun 05/10: sin dato en pesos y sin dato en dólares. Falta SPY: IEB ya no la lista desde el mar 06/10: registrá la venta o el vencimiento en Cargar.',
    )
    // Cada "sin dato" se toca y lleva la suma parcial.
    const tocables = f.partes.filter((p) => p.calc)
    expect(tocables).toHaveLength(2)
    expect(tocables[0].calc!.etiquetas).toContain('parcial')
    expect(tocables[0].calc!.motivo).toContain('Suma parcial')
    expect(f.sin_atribuir).toBeNull()
  })

  it('Hoy › Atención: la lista con gravedad alta y un botón a Cargar, sin "dato viejo" ni "declarar CCL" de la misma fila', () => {
    const h = ventaTotalSpy()
    // El viernes 09/10 el precio del lunes ya es viejo: antes salía "SPY: dato viejo" (Cargar no lo arregla).
    const h5 = { ...h, tipos_cambio: [...h.tipos_cambio, tc('2026-10-09', 1000)], cotizaciones: [...h.cotizaciones, cot('2026-10-09', AL30.id, '0.8')] }
    for (const [hh, hoy] of [
      [h, '2026-10-06'],
      [h5, '2026-10-09'],
    ] as const) {
      const at = armarHoy(hh, hoy).atencion
      const spy = at.filter((p) => p.titulo.startsWith('SPY'))
      expect(spy).toHaveLength(1)
      expect(spy[0]).toMatchObject({ gravedad: 'alta', titulo: 'SPY: IEB ya no la lista', accion: { etiqueta: 'Cargar', href: '/carga' } })
      expect(spy[0].detalle).toContain('registrá la venta o el vencimiento en Cargar')
      expect(spy[0].id).toBe(`ausente:p:${IEB}:${SPY.id}:2026-10-06`)
      expect(at[0].gravedad).toBe('alta')
    }
  })

  it('Cartera: la fila dice el motivo y los totales quedan "sin dato" con la suma parcial', () => {
    const c = armarCartera(ventaTotalSpy(), '2026-10-06')
    const fila = c.filas.find((f) => f.ticker === 'SPY')!
    const motivo = 'IEB ya no la lista desde el mar 06/10: registrá la venta o el vencimiento en Cargar.'
    expect(fila.valor.ars.valor).toBeNull()
    expect(fila.valor.ars.motivo).toBe(motivo)
    expect(fila.resultado.ars.valor).toBeNull()
    expect(fila.resultado.ars.motivo).toBe(motivo)
    expect(fila.resultado.usd.motivo).toBe(motivo) // no "falta el CCL de compra": lo urgente es la ausencia
    expect(fila.pendiente).toBe(motivo)
    expect(c.totales.valor.ars.valor).toBeNull()
    expect(c.totales.valor.ars.etiquetas).toContain('parcial')
    expect(c.totales.valor.ars.motivo).toContain('$ 1.080.000,00')
  })

  it('Exposición: lo que arriesga dólares queda "sin dato" (no suma una SPY que ya no tenés)', () => {
    const e = armarExposicion(ventaTotalSpy(), '2026-10-06', 'financiero')
    expect(e.activos_en_dolares.ars.valor).toBeNull()
    expect(e.activos_en_dolares.ars.etiquetas).toContain('parcial')
    // La concentración dice por qué no se puede calcular.
    expect(e.concentracion.top1.valor).toBeNull()
    expect(e.concentracion.top1.motivo).toContain('SPY')
  })

  it('con la venta registrada, la ausencia no cambia nada: el día suma $0 y el cuadre cierra', () => {
    const h = ventaTotalSpy(true)
    const v = armarHoy(h, '2026-10-06')
    expect(txt(v.financiero.valor.ars.valor)).toBe('1080000.00')
    expect(txt(v.financiero.variacion?.ars.valor)).toBe('0.00')
    expect(v.cuadre).toMatchObject({ ars_ok: true, usd_ok: true })
    expect(v.atencion.some((p) => p.id.startsWith('ausente:'))).toBe(false)
    expect(armarCartera(h, '2026-10-06').filas.some((f) => f.ticker === 'SPY')).toBe(false)
  })

  it('solo afecta a esa cuenta: la misma especie en otra cuenta se valúa normal', () => {
    const h = ventaTotalSpy()
    h.operaciones.push(op({ fecha: '2026-10-05', cuenta_id: GALICIA, activo_id: AL30.id, tipo: 'apertura', cantidad: D(1000), precio: D('0.79') }))
    h.ausentes = [ausente('2026-10-06', AL30.id, GALICIA, 78)]
    const f = foto(h, '2026-10-06')
    expect(f.items.find((i) => i.clave === `p:${GALICIA}:${AL30.id}`)!.valor_ars.motivo).toBe(
      'Galicia ya no la lista desde el mar 06/10: registrá la venta o el vencimiento en Cargar.',
    )
    expect(txt(f.items.find((i) => i.clave === `p:${IEB}:${AL30.id}`)!.valor_ars.valor)).toBe('80000.00')
    // SPY no está en las ausentes de esta versión: vale normal.
    expect(txt(f.items.find((i) => i.clave === `p:${IEB}:${SPY.id}`)!.valor_ars.valor)).toBe('1000000.00')
  })

  it('sin el campo ausentes (opcional), todo como antes', () => {
    const h = ventaTotalSpy()
    delete h.ausentes
    expect(txt(foto(h, '2026-10-06').items.find((i) => i.clave === `p:${IEB}:${SPY.id}`)!.valor_ars.valor)).toBe('1000000.00')
  })

  it('escenario del revisor (lecap-vencida): S13N6 vence el 13/11, IEB deja de listarla y el cobro entra al saldo', () => {
    const h = hechos({
      operaciones: [op({ fecha: '2026-11-12', activo_id: S13N6.id, tipo: 'apertura', cantidad: D(1000000), precio: D('1.012') })],
      tipos_cambio: [tc('2026-11-12', 1500), tc('2026-11-13', 1500)],
      cotizaciones: [cot('2026-11-12', S13N6.id, '1.049')],
      saldos: [saldo('2026-11-12', IEB, 'ARS', 0), saldo('2026-11-13', IEB, 'ARS', 1050000)],
      ausentes: [ausente('2026-11-13', S13N6.id)],
    })
    const v = armarHoy(h, '2026-11-13')
    // Antes: $2.099.000 (la LECAP y el cobro), variación +$1.050.000 y cuadre ✓.
    expect(v.financiero.valor.ars.valor).toBeNull()
    expect(v.financiero.valor.ars.motivo).toContain('$ 1.050.000,00')
    expect(v.financiero.variacion?.ars.valor).toBeNull()
    expect(v.cuadre.ars_ok).toBeNull()
    expect(v.atencion.find((p) => p.titulo === 'S13N6: IEB ya no la lista')?.gravedad).toBe('alta')
    const fila = armarCartera(h, '2026-11-13').filas.find((f) => f.ticker === 'S13N6')!
    expect(fila.valor.ars.motivo).toBe('IEB ya no la lista desde el vie 13/11: registrá la venta o el vencimiento en Cargar.')
    // Registrado el vencimiento, vuelve a cerrar: $1.050.000, resultado del día $1.000.
    // (Hechos nuevos: el motor memoriza por objeto.)
    const h2 = { ...h, operaciones: [...h.operaciones, op({ fecha: '2026-11-13', activo_id: S13N6.id, tipo: 'vencimiento', cantidad: D(1000000), importe: D(1050000), ccl_del_dia: D(1500) })] }
    const v2 = armarHoy(h2, '2026-11-13')
    expect(txt(v2.financiero.valor.ars.valor)).toBe('1050000.00')
    expect(txt(v2.financiero.variacion?.ars.valor)).toBe('1000.00')
    expect(v2.cuadre).toMatchObject({ ars_ok: true, usd_ok: true })
  })

  it('una ausencia de varios días toma la primera fecha (la fuente no la lista desde entonces)', () => {
    const h = ventaTotalSpy()
    h.ausentes = [ausente('2026-10-07', SPY.id, IEB, 79), ausente('2026-10-06', SPY.id, IEB, 77)]
    const it7 = foto(h, '2026-10-07').items.find((i) => i.clave === `p:${IEB}:${SPY.id}`)!
    expect(it7.valor_ars.motivo).toContain('desde el mar 06/10')
    expect(financieros(foto(h, '2026-10-05')).every((i) => i.valor_ars.valor !== null)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Cuadre: cuando no cierra, por cuánto y por qué (manual §4.1, D-66)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Galicia no tiene saldo cargado (su captura solo trae filas). El martes la
 * captura trae 6.000.000 S28F7 en vez de 5.000.000 y aceptás la compra de
 * 1.000.000 a $1,05: la pata de caja va a un saldo que no está en ninguna foto.
 */
function compraEnGalicia(): Hechos {
  return hechos({
    operaciones: [
      op({ fecha: '2026-10-05', cuenta_id: GALICIA, activo_id: S28F7.id, tipo: 'apertura', cantidad: D(5000000), precio: D('1.03') }),
      op({ fecha: '2026-10-06', cuenta_id: GALICIA, activo_id: S28F7.id, tipo: 'compra', cantidad: D(1000000), precio: D('1.05'), ccl_del_dia: D(1000) }),
    ],
    tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1000)],
    cotizaciones: [cot('2026-10-05', S28F7.id, '1.04'), cot('2026-10-06', S28F7.id, '1.05')],
    saldos: [saldo('2026-10-05', MP, 'ARS', 1000), saldo('2026-10-06', MP, 'ARS', 1000)],
  })
}

describe('cuadre: la diferencia en pesos y en dólares, con traza', () => {
  it('≠: devuelve la diferencia en las dos monedas y el detalle dice por cuánto y qué operación la explica', () => {
    const h = compraEnGalicia()
    const c = cuadre(variacion(h, '2026-10-05', '2026-10-06'), h)
    expect(c.ars_ok).toBe(false)
    expect(c.usd_ok).toBe(false)
    expect(txt(c.diferencia?.ars.valor?.toFixed())).toBe('1050000.00')
    expect(txt(c.diferencia?.usd.valor?.toFixed())).toBe('1050.00')
    expect(c.diferencia?.ars.formula).toContain('= +$ 1.050.000,00')
    expect(c.diferencia?.ars.insumos.map((i) => i.nombre)).toEqual([
      'Patrimonio financiero del mar 06/10',
      'Patrimonio financiero del lun 05/10',
      'Aportes, retiros y otros flujos externos',
      'Activos + TC + sin atribuir',
    ])
    expect(c.detalle).toContain('El desglose no cierra por +$ 1.050.000,00 · +US$ 1.050,00')
    expect(c.detalle).toContain('compra de S28F7 del mar 06/10 en Galicia')
    expect(c.detalle).toContain('Galicia no tiene saldo en pesos cargado')
    expect(c.detalle).toContain('explica toda la diferencia')
    // Hoy la pasa a la pantalla.
    const v = armarHoy(h, '2026-10-06')
    expect(v.cuadre.diferencia?.ars.valor).toBe('1050000')
    expect(v.cuadre.diferencia?.usd.valor).toBe('1050')
  })

  it('✓: la diferencia es 0,00 en las dos monedas (visión §4.1: "Cuadre ✓ 0,00 en $ y en US$")', () => {
    const h = ventaTotalSpy(true)
    const v = armarHoy(h, '2026-10-06')
    expect(v.cuadre.ars_ok).toBe(true)
    expect(v.cuadre.diferencia?.ars.valor).toBe('0')
    expect(v.cuadre.diferencia?.usd.valor).toBe('0')
  })

  it('no verificable: sin diferencia (falta un dato)', () => {
    const v = armarHoy(ventaTotalSpy(), '2026-10-06')
    expect(v.cuadre.ars_ok).toBeNull()
    expect(v.cuadre.diferencia ?? null).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// La frase: la oración en dólares con verbo (visión §2 y §4.1, manual §4.1)
// ═════════════════════════════════════════════════════════════════════════

describe('frase del día: oraciones con verbo, como la cita el manual', () => {
  it('Apéndice B: "tus activos sumaron US$ 37 y la suba del CCL le restó US$ 377 a tus pesos"', () => {
    const texto = ejemploHoy().frase!.partes.map((p) => p.texto).join('')
    expect(texto).toContain('En pesos, el CCL sumó $ 532.812 y tus activos sumaron $ 57.313.')
    expect(texto).toContain('En dólares, tus activos sumaron US$ 36,76 y la suba del CCL le restó US$ 377,00 a tus pesos.')
    expect(texto).not.toContain('sobre tus pesos')
    // Cada cifra sigue tocable y sin signo (el verbo lo dice): la UI la muestra en valor absoluto.
    const f = ejemploHoy().frase!
    const cifra = (c: typeof f.activos.usd) => f.partes.find((p) => p.calc && p.calc.formula === c.formula && p.calc.valor === c.valor)!
    expect(cifra(f.activos.usd).texto).toBe('US$ 36,76')
    expect(cifra(f.tc.usd).texto).toBe('US$ 377,00')
  })

  it('con el CCL en baja y activos que pierden: "restaron" y "la baja del CCL le sumó"', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-05', activo_id: SPY.id, tipo: 'apertura', cantidad: D(10), precio: D(9000) }),
        op({ fecha: '2026-10-05', activo_id: AL30.id, tipo: 'apertura', cantidad: D(100000), precio: D('0.79') }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 950)],
      cotizaciones: [cot('2026-10-05', SPY.id, 10000), cot('2026-10-06', SPY.id, 9000), cot('2026-10-05', AL30.id, '0.8'), cot('2026-10-06', AL30.id, '0.8')],
    })
    const texto = armarHoy(h, '2026-10-06').frase!.partes.map((p) => p.texto).join('')
    expect(texto).toMatch(/En dólares, tus activos restaron US\$ [\d.,]+ y la baja del CCL le sumó US\$ [\d.,]+ a tus pesos\./)
    expect(texto).toMatch(/En pesos, el CCL restó \$ [\d.]+ y tus activos restaron \$ [\d.]+\./)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Cartera: el desglose de la fila es el de la tenencia vigente
// ═════════════════════════════════════════════════════════════════════════

const suma3 = (d: { activo: { valor: string | null }; tc: { valor: string | null }; sin_atribuir: { valor: string | null } }) =>
  D(d.activo.valor!).plus(d.tc.valor!).plus(d.sin_atribuir.valor!)

describe('Cartera: activo + TC + sin atribuir = resultado de la fila, también con ventas y rentas', () => {
  // Escenario del revisor (verificar-plata-5-0): lunes compra 100 SPY a $10.000
  // con CCL 1.000; martes vende 50 a $11.000 con CCL 1.100.
  const spy = (precioVenta: string | number) =>
    hechos({
      operaciones: [
        op({ fecha: '2026-10-05', activo_id: SPY.id, tipo: 'compra', cantidad: D(100), precio: D(10000), ccl_del_dia: D(1000) }),
        op({ fecha: '2026-10-06', activo_id: SPY.id, tipo: 'venta', cantidad: D(50), precio: D(precioVenta), ccl_del_dia: D(1100) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
      cotizaciones: [cot('2026-10-05', SPY.id, 10000), cot('2026-10-06', SPY.id, 11000)],
      saldos: [saldo('2026-10-05', IEB, 'ARS', 1000000), saldo('2026-10-06', IEB, 'ARS', 1550000)],
    })

  it('venta parcial de un CEDEAR: activo $0 y TC +$50.000 para las 50 que quedan (antes: $0 / +$100.000)', () => {
    const f = armarCartera(spy(11000), '2026-10-06').filas.find((x) => x.ticker === 'SPY')!
    expect(f.resultado.ars.valor).toBe('50000')
    expect(f.desglose!.moneda).toBe('ARS')
    expect(txt(f.desglose!.activo.valor)).toBe('0.00')
    expect(txt(f.desglose!.tc.valor)).toBe('50000.00')
    expect(txt(f.desglose!.sin_atribuir.valor)).toBe('0.00')
    expect(f.desglose!.tc.formula).toContain('solo la tenencia vigente')
    expect(f.desglose!.tc.formula).not.toContain('incluye')
  })

  it('vendida a otro precio que el del día: lo que difiere es de lo vendido y no entra en la fila', () => {
    const f = armarCartera(spy(11200), '2026-10-06').filas.find((x) => x.ticker === 'SPY')!
    expect(f.resultado.ars.valor).toBe('50000')
    expect(txt(f.desglose!.activo.valor)).toBe('0.00')
    expect(txt(f.desglose!.tc.valor)).toBe('50000.00')
  })

  it('bono en pesos vendido a la mitad: activo +US$ 25 y TC −US$ 47,73 = −US$ 22,73 (antes: +US$ 50 / −US$ 95,45)', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-05', activo_id: AL30.id, tipo: 'compra', cantidad: D(1000000), precio: D('1.00'), ccl_del_dia: D(1000) }),
        op({ fecha: '2026-10-06', activo_id: AL30.id, tipo: 'venta', cantidad: D(500000), precio: D('1.05'), ccl_del_dia: D(1100) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
      cotizaciones: [cot('2026-10-05', AL30.id, '1.00'), cot('2026-10-06', AL30.id, '1.05')],
      saldos: [saldo('2026-10-05', IEB, 'ARS', 0), saldo('2026-10-06', IEB, 'ARS', 525000)],
    })
    const f = armarCartera(h, '2026-10-06').filas.find((x) => x.ticker === 'AL30')!
    expect(f.desglose!.moneda).toBe('USD')
    expect(D(f.desglose!.activo.valor!).toFixed(4)).toBe('25.0000')
    expect(D(f.desglose!.tc.valor!).toFixed(4)).toBe('-47.7273')
    expect(suma3(f.desglose!).minus(f.resultado.usd.valor!).abs().lte('1e-12')).toBe(true)
  })

  it('dividendo de un CEDEAR (D-114): el desglose no lo incluye, como el resultado de la fila', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-05', activo_id: XOM.id, tipo: 'compra', cantidad: D(100), precio: D(20000), ccl_del_dia: D(1000) }),
        op({ fecha: '2026-10-06', activo_id: XOM.id, tipo: 'renta', cantidad: D(0), moneda: 'USD', importe: D(10), ccl_del_dia: D(1100) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
      cotizaciones: [cot('2026-10-05', XOM.id, 20000), cot('2026-10-06', XOM.id, 22000)],
      saldos: [saldo('2026-10-05', IEB, 'USD', 0), saldo('2026-10-06', IEB, 'USD', 10)],
    })
    const f = armarCartera(h, '2026-10-06').filas.find((x) => x.ticker === 'XOM')!
    expect(f.resultado.ars.valor).toBe('200000')
    expect(txt(f.desglose!.activo.valor)).toBe('0.00') // antes: +$11.000 (el dividendo)
    expect(txt(f.desglose!.tc.valor)).toBe('200000.00')
    expect(suma3(f.desglose!).toFixed()).toBe('200000')
  })

  it('compra con precio pendiente (D-110): con el resultado "sin dato", el desglose también (antes: −$50.000 / +$100.000 sin etiqueta)', () => {
    const h = hechos({
      operaciones: [
        op({ fecha: '2026-10-05', activo_id: SPY.id, tipo: 'compra', cantidad: D(100), precio: D(10000), ccl_del_dia: D(1000) }),
        op({ fecha: '2026-10-06', activo_id: SPY.id, tipo: 'compra', cantidad: D(10), precio: null, ccl_del_dia: D(1100) }),
      ],
      tipos_cambio: [tc('2026-10-05', 1000), tc('2026-10-06', 1100)],
      cotizaciones: [cot('2026-10-05', SPY.id, 10000), cot('2026-10-06', SPY.id, 10500)],
    })
    const f = armarCartera(h, '2026-10-06').filas.find((x) => x.ticker === 'SPY')!
    expect(f.resultado.ars.valor).toBeNull()
    expect(f.resultado.ars.etiquetas).toContain('pendiente')
    // Las partes son "sin dato" con el mismo motivo y la etiqueta del resultado.
    expect(f.desglose!.moneda).toBe('ARS')
    for (const parte of [f.desglose!.activo, f.desglose!.tc, f.desglose!.sin_atribuir]) {
      expect(parte.valor).toBeNull()
      expect(parte.motivo).toBe(f.resultado.ars.motivo)
      expect(parte.etiquetas).toContain('pendiente')
    }
  })

  it('tenencia que la fuente ya no lista: las partes del desglose dicen el mismo motivo que la fila', () => {
    const f = armarCartera(ventaTotalSpy(), '2026-10-06').filas.find((x) => x.ticker === 'SPY')!
    expect(f.desglose!.activo.valor).toBeNull()
    expect(f.desglose!.tc.motivo).toBe('IEB ya no la lista desde el mar 06/10: registrá la venta o el vencimiento en Cargar.')
  })

  it('propiedad sobre los 310 casos de la referencia: en cada fila con desglose, activo + TC + sin atribuir = resultado', () => {
    const casos = JSON.parse(readFileSync(path.join(import.meta.dirname, '../referencia/casos.json'), 'utf8')).casos as CasoRef[]
    let filas = 0
    for (const c of casos) {
      const cartera = armarCartera(hechosDeCaso(c), c.t1)
      for (const f of cartera.filas) {
        if (!f.desglose || f.desglose.activo.valor === null) continue
        const res = f.desglose.moneda === 'ARS' ? f.resultado.ars.valor : f.resultado.usd.valor
        expect(res, `${c.id} ${f.ticker}`).not.toBeNull()
        const dif = suma3(f.desglose).minus(res!).abs()
        expect(dif.lte(D(res!).abs().times('1e-12').plus('1e-9')), `${c.id} ${f.ticker}: ${suma3(f.desglose).toFixed()} vs ${res}`).toBe(true)
        filas++
      }
    }
    expect(filas).toBeGreaterThan(300)
  })
})

interface CasoRef {
  id: string
  t1: string
  ccl: Record<string, string | null>
  partidas: {
    activo: string
    riesgo: 'ARS' | 'USD'
    clase: 'cedear' | 'accion' | 'bono'
    operaciones: { id: number; fecha: string; fecha_origen?: string; tipo: Operacion['tipo']; cantidad: string; precio: string | null; importe: string | null; comisiones: string; ccl: string | null }[]
    precios: { fecha: string; precio: string }[]
  }[]
}

function hechosDeCaso(c: CasoRef): Hechos {
  const Dn = (x: string | null | undefined) => (x === null || x === undefined ? null : D(x))
  const tipo = { cedear: 'cedear', accion: 'accion_local', bono: 'bono' } as const
  return hechos({
    cuentas: [CUENTAS[0]],
    activos: c.partidas.map((p, i) => ({ ...activo(i + 1, p.activo, tipo[p.clase], p.riesgo) })),
    operaciones: c.partidas.flatMap((p, i) =>
      p.operaciones.map((o) => ({
        id: o.id,
        fecha: o.fecha,
        fecha_origen: o.fecha_origen ?? null,
        cuenta_id: IEB,
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
    ),
    cotizaciones: c.partidas.flatMap((p, i) => p.precios.map((x) => cot(x.fecha, i + 1, x.precio))),
    tipos_cambio: Object.entries(c.ccl).map(([fecha, v]) => ({ fecha, ccl: Dn(v), mep: null, cripto_venta: null, oficial: null, carga_id: 1 })),
  })
}
