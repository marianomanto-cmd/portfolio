// Arma la ConfirmacionCarga que va entera, en una sola transacción, a
// confirmar_carga (docs/datos.md, regla 3). Entra la propuesta de conciliación
// y lo que elegiste en la bandeja; sale lo que se graba, cuenta por cuenta, con
// lo grabado y las diferencias de conciliación y su resolución (D-17).
//
// Puro y con tests. El servidor lo corre con una propuesta recién armada contra
// la base, no con la que vio el navegador.

import { Decimal } from '@/lib/domain/dinero'
import type { Fecha } from '@/lib/domain/tipos'
import type {
  ConfirmacionCarga,
  CotizacionAGrabar,
  CuentaAGrabar,
  LecturaCuenta,
  NombreCuenta,
  OperacionAGrabar,
  PrecioACompletar,
  PropuestaCarga,
  SaldoAGrabar,
} from '@/lib/carga/contratos'
import {
  claveAusente,
  eleccionFila,
  eleccionSaldo,
  estadoFila,
  estadoSaldo,
  precioACompletar,
  seGraba,
  type Elecciones,
} from './bandeja'
import type { Ediciones } from './ediciones'

export interface ArchivoGuardado {
  path: string
  sha256: string
}

export interface FuenteConfirmada {
  /** La lectura tal como la devolvió el lector (sin ediciones). */
  lectura: LecturaCuenta
  archivo: ArchivoGuardado | null
}

export interface EntradaConfirmacion {
  lote: string
  fecha: Fecha
  tc: { ccl: string | null; cripto_venta: string | null; referencia?: string | null }
  /** Propuesta armada con las lecturas ya editadas. */
  propuesta: PropuestaCarga
  elecciones: Elecciones
  ediciones: Ediciones
  fuentes: readonly FuenteConfirmada[]
  cuentas: readonly { id: number; nombre: string }[]
  tiempo_activo_ms: number | null
  nota: string | null
  /** Sin base (modo demo): no se exige que cada fuente tenga su archivo guardado. */
  sinArchivos?: boolean
}

export interface ResumenCuenta {
  cuenta: NombreCuenta
  cotizaciones: number
  saldos: number
  operaciones: number
  /** Compras pendientes cuyo precio se completa (D-19). */
  precios_completados: number
  /** Filas y saldos que no se graban (y tenencias que la fuente no trajo). */
  pendientes: number
  listado_completo: boolean
}

export interface ResumenGuardado {
  cuentas: ResumenCuenta[]
  tipo_cambio: { ccl: boolean; cripto: boolean }
  /** Lo que guarda el Enter: filas + saldos + tipos de cambio (lo que dice el botón). */
  total: number
  pendientes: number
}

export type ResultadoArmado =
  | { ok: true; confirmacion: ConfirmacionCarga; resumen: ResumenGuardado }
  | { ok: false; errores: string[] }

const esPositivo = (v: string | null) => v !== null && /^-?\d+(\.\d+)?$/.test(v) && new Decimal(v).gt(0)

/** "No cierra." → "No cierra" (el mensaje sigue después). */
const quitarPunto = (m: string) => m.trim().replace(/\.$/, '')

export function armarConfirmacion(e: EntradaConfirmacion): ResultadoArmado {
  const errores: string[] = []
  const referencia = e.tc.referencia?.trim() ? e.tc.referencia.trim().slice(0, 200) : null
  const tipo_cambio =
    e.tc.ccl !== null || e.tc.cripto_venta !== null
      ? { ccl: e.tc.ccl, cripto_venta: e.tc.cripto_venta, mep: null, oficial: null, ...(referencia ? { referencia } : {}) }
      : null

  // Un precio por activo y por día (la clave de cotizaciones es fecha + activo):
  // si dos cuentas traen el mismo activo, vale el del Excel, que es determinístico.
  const fuentes = [...e.fuentes].sort((a, b) => Number(a.lectura.origen !== 'excel') - Number(b.lectura.origen !== 'excel'))
  const cotizado = new Map<number, { cuenta: NombreCuenta; precio: string }>()
  const vistas = new Set<NombreCuenta>()
  const cuentas: CuentaAGrabar[] = []
  const resumen: ResumenCuenta[] = []
  let total = (e.tc.ccl !== null ? 1 : 0) + (e.tc.cripto_venta !== null ? 1 : 0)
  let pendientesTotales = 0

  for (const { lectura, archivo } of fuentes) {
    const nombre = lectura.cuenta
    if (vistas.has(nombre)) {
      errores.push(`Hay dos fuentes de ${nombre}: elegí una.`)
      continue
    }
    vistas.add(nombre)
    const cuenta = e.cuentas.find((c) => c.nombre === nombre)
    if (!cuenta) {
      errores.push(`La cuenta ${nombre} no está en el catálogo de cuentas.`)
      continue
    }
    if (!archivo && !e.sinArchivos) {
      errores.push(`Falta el archivo de ${nombre} guardado: volvé a soltarlo.`)
      continue
    }

    const cotizaciones: CotizacionAGrabar[] = []
    const saldos: SaldoAGrabar[] = []
    const operaciones: OperacionAGrabar[] = []
    const completar: PrecioACompletar[] = []
    const filasGrabado: unknown[] = []
    const saldosGrabado: unknown[] = []
    let pendientes = 0
    let grabadas = 0

    for (const d of e.propuesta.filas.filter((x) => x.cuenta === nombre)) {
      const el = eleccionFila(e.elecciones, d)
      const estado = estadoFila(d, el)
      const registro = {
        clave: d.clave,
        ticker: d.ticker,
        activo_id: d.activo_id,
        lectura: { estado: d.fila.estado, motivos: d.motivos, chequeo: d.fila.chequeo, lugar: d.fila.lugar },
        editada: e.ediciones[d.clave] ?? null,
        cantidad_leida: d.cantidad_leida,
        cantidad_app: d.cantidad_app,
        accion: d.accion,
        propuesta: d.operacion,
      }
      if (estado === 'error') {
        // motivos[0] es el principal (conciliar pone primero lo que frena).
        errores.push(`${nombre} · ${d.ticker}: ${quitarPunto(d.motivos[0] ?? 'tiene un error')}. Editala o dejala pendiente.`)
        continue
      }
      if (!seGraba(estado) || d.activo_id === null) {
        pendientes++
        filasGrabado.push({
          ...registro,
          resolucion: 'pendiente',
          motivo:
            el?.motivo ??
            (estado === 'pendiente' ? 'la dejaste pendiente' : estado === 'sin_alta' ? 'ticker sin dar de alta' : 'sin revisar al guardar'),
          grabada: null,
          cotizacion: null,
        })
        continue
      }
      const activo_id = d.activo_id
      let cotizacion: string | null = null
      let nota: string | null = null
      if (d.cotizacion) {
        const previa = cotizado.get(activo_id)
        if (previa) {
          nota =
            previa.precio === d.cotizacion.precio_pesos
              ? `precio igual al de ${previa.cuenta}`
              : `precio no grabado: vale el de ${previa.cuenta} (${previa.precio}); esta fuente mostraba ${d.cotizacion.precio_pesos}`
        } else {
          cotizacion = d.cotizacion.precio_pesos
          cotizado.set(activo_id, { cuenta: nombre, precio: cotizacion })
          cotizaciones.push({ activo_id, precio_pesos: cotizacion })
        }
      }
      let grabada: OperacionAGrabar | null = null
      if (d.operacion) {
        const op: OperacionAGrabar = { ...d.operacion, activo_id }
        if (el?.operacion) {
          op.cantidad = el.operacion.cantidad
          op.precio = el.operacion.precio
        }
        if (op.tipo !== 'apertura') op.ccl_del_dia = e.tc.ccl
        const problema =
          !esPositivo(op.cantidad)
            ? 'la cantidad tiene que ser mayor que cero'
            : op.precio !== null && !esPositivo(op.precio)
              ? 'el precio tiene que ser mayor que cero'
              : op.tipo !== 'apertura' && op.ccl_del_dia === null
                ? `la ${op.tipo} necesita el CCL del día: tipealo arriba`
                : op.tipo === 'venta' && op.precio === null && op.importe === null
                  ? 'la venta necesita el precio'
                  : op.tipo === 'ajuste_ratio' && (op.precio !== null || op.importe !== null)
                    ? 'un ajuste de ratio no lleva precio'
                    : null
        if (problema) {
          errores.push(`${nombre} · ${d.ticker}: ${problema}.`)
          continue
        }
        grabada = op
        operaciones.push(op)
      }
      // D-19: completar el precio de una compra pendiente, solo si lo aceptaste.
      let completada: (PrecioACompletar & { propuesto: string; formula: string }) | null = null
      if (d.accion === 'completar_precio' && d.completar) {
        if (el?.precio_completar !== undefined && el.precio_completar !== null && precioACompletar(d, el) === null) {
          errores.push(`${nombre} · ${d.ticker}: el precio para completar la compra tiene que ser mayor que cero.`)
          continue
        }
        const precio = precioACompletar(d, el)
        if (precio !== null) {
          completada = { operacion_id: d.completar.operacion_id, precio, propuesto: d.completar.precio, formula: d.completar.formula }
          completar.push({ operacion_id: d.completar.operacion_id, precio })
        }
      }
      grabadas++
      filasGrabado.push({
        ...registro,
        resolucion: estado === 'aceptada' ? 'aceptada' : 'verificada',
        motivo: el?.motivo ?? null,
        grabada,
        cotizacion,
        nota,
        ...(d.accion === 'completar_precio' ? { completada } : {}),
      })
    }

    const monedas = new Set<string>()
    for (const d of e.propuesta.saldos.filter((x) => x.cuenta === nombre)) {
      const el = eleccionSaldo(e.elecciones, d)
      const estado = estadoSaldo(d, el)
      const registro = { clave: d.clave, moneda: d.moneda, leido: d.monto, partes: d.saldo.partes, anterior: d.anterior, motivos: d.motivos }
      if (estado === 'error') {
        errores.push(`${nombre} · saldo en ${d.moneda}: ${quitarPunto(d.motivos[0] ?? 'no se pudo leer')}. Tipealo o dejalo pendiente.`)
        continue
      }
      if (!seGraba(estado)) {
        pendientes++
        saldosGrabado.push({ ...registro, resolucion: 'pendiente', motivo: el?.motivo ?? (estado === 'pendiente' ? 'lo dejaste pendiente' : 'sin revisar al guardar'), grabado: null })
        continue
      }
      if (monedas.has(d.moneda)) {
        errores.push(`${nombre}: dos saldos en ${d.moneda}.`)
        continue
      }
      monedas.add(d.moneda)
      const montoFinal = el?.monto ?? d.monto
      saldos.push({ moneda: d.moneda, monto: montoFinal })
      grabadas++
      saldosGrabado.push({ ...registro, resolucion: estado === 'aceptada' ? 'aceptada' : 'verificada', motivo: el?.motivo ?? null, grabado: montoFinal })
    }

    const ausentes = e.propuesta.ausentes
      .filter((a) => a.cuenta === nombre)
      .map((a) => ({ ticker: a.ticker, cantidad_app: a.cantidad_app, resolucion: e.elecciones.ausentes[claveAusente(a)] ?? 'sin revisar al guardar' }))
    pendientes += ausentes.length

    const listado_completo = pendientes === 0
    cuentas.push({
      cuenta_id: cuenta.id,
      origen: lectura.origen,
      archivo_path: archivo?.path ?? null,
      archivo_sha256: archivo?.sha256 ?? null,
      lector: lectura.lector,
      lectura_cruda: lectura.cruda ?? null,
      grabado: {
        version: 1,
        fecha_fuente: lectura.fecha_reporte,
        filas: filasGrabado,
        saldos: saldosGrabado,
        controles: e.propuesta.controles.filter((c) => c.cuenta === nombre).map((c) => c.control),
        ausentes,
        advertencias: lectura.advertencias,
      },
      listado_completo,
      cotizaciones,
      saldos,
      operaciones,
      ...(completar.length ? { completar_precios: completar } : {}),
    })
    resumen.push({
      cuenta: nombre,
      cotizaciones: cotizaciones.length,
      saldos: saldos.length,
      operaciones: operaciones.length,
      precios_completados: completar.length,
      pendientes,
      listado_completo,
    })
    total += grabadas
    pendientesTotales += pendientes
  }

  if (!tipo_cambio && cuentas.length === 0 && errores.length === 0) {
    errores.push('Nada para guardar: tipeá el CCL o el cripto, o soltá un archivo.')
  }
  if (errores.length) return { ok: false, errores }

  const nota = e.nota?.trim() ? e.nota.trim() : null
  return {
    ok: true,
    confirmacion: {
      lote: e.lote,
      fecha: e.fecha,
      tipo_cambio,
      cuentas,
      tiempo_activo_ms: e.tiempo_activo_ms === null ? null : Math.max(0, Math.round(e.tiempo_activo_ms)),
      nota,
    },
    resumen: {
      cuentas: resumen,
      tipo_cambio: { ccl: e.tc.ccl !== null, cripto: e.tc.cripto_venta !== null },
      total,
      pendientes: pendientesTotales,
    },
  }
}
