// Arma la ConfirmacionCarga que va entera, en una sola transacción, a
// confirmar_carga (docs/datos.md, regla 3). Entra la propuesta de conciliación
// y lo que elegiste en la bandeja; sale lo que se graba, cuenta por cuenta, con
// lo grabado y las diferencias de conciliación y su resolución (D-17).
//
// Puro y con tests. El servidor lo corre con una propuesta recién armada contra
// la base, no con la que vio el navegador.

import { Decimal } from '@/lib/domain/dinero'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
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
  eligioApertura,
  estadoFila,
  estadoSaldo,
  precioACompletar,
  problemaRegistroAusente,
  registroAusente,
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
  /** Lo tipeado: es lo único que se graba como tipo de cambio del día. */
  tc: { ccl: string | null; cripto_venta: string | null; referencia?: string | null }
  /**
   * CCL de las operaciones: el tipeado o, si no se tipeó, el que el día ya
   * tiene cargado (conciliar.cclDelDia). Sin este campo, el tipeado.
   */
  ccl_del_dia?: string | null
  /**
   * Precios que el día ya tiene grabados desde un Excel (vigente): una captura
   * no los pisa, como dentro de un mismo lote (vale el del Excel).
   */
  cotizaciones_excel?: readonly { activo_id: number; precio_pesos: string; cuenta: NombreCuenta }[]
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
  /**
   * Fuentes que no grabaron nada (todo quedó pendiente): no crean carga, así no
   * reemplazan a la buena del día ni la cuenta figura al día.
   */
  sin_grabar?: { cuenta: NombreCuenta; pendientes: number }[]
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

/**
 * Los precios del día que ya grabó un Excel (su carga sigue vigente o fue
 * reemplazada, no revertida): una captura posterior no los pisa (D-106).
 */
export function cotizacionesDeExcel(hechos: Pick<Hechos, 'cotizaciones' | 'cargas' | 'cuentas'>, fecha: Fecha): NonNullable<EntradaConfirmacion['cotizaciones_excel']> {
  const out: { activo_id: number; precio_pesos: string; cuenta: NombreCuenta }[] = []
  for (const c of hechos.cotizaciones) {
    if (c.fecha !== fecha) continue
    const carga = hechos.cargas.find((x) => x.id === c.carga_id)
    if (!carga || carga.origen !== 'excel' || carga.estado === 'revertida') continue
    const cuenta = hechos.cuentas.find((x) => x.id === carga.cuenta_id)?.nombre ?? 'IEB'
    out.push({ activo_id: c.activo_id, precio_pesos: c.precio_pesos.toFixed(), cuenta: cuenta as NombreCuenta })
  }
  return out
}

/** JSON con las claves ordenadas: el mismo contenido da el mismo texto, venga en el orden que venga. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/**
 * Lo que identifica un Enter: lo que mandó el dueño (no lo que se arma contra
 * la base, que en un reintento ya tiene lo grabado). Su sha256 es la huella
 * que la base guarda con el lote: un reintento trae la misma; el mismo lote
 * con otra elección, otra fuente u otro tipo de cambio, otra.
 */
export function textoHuella(x: {
  fecha: Fecha
  ccl: string | null
  cripto: string | null
  referencia: string | null
  nota: string | null
  fuentes: readonly { cuenta: NombreCuenta; firma: string }[]
  ediciones: unknown
  elecciones: unknown
}): string {
  return canonico({ v: 1, ...x, fuentes: [...x.fuentes].sort((a, b) => (a.cuenta < b.cuenta ? -1 : a.cuenta > b.cuenta ? 1 : 0)) })
}

/**
 * "Ya estaba guardado": lo que de verdad quedó en la base para las cargas de
 * un lote (no lo que se volvería a armar ahora). Cuenta los hechos que siguen
 * siendo de cada carga.
 */
export function resumenDeLote(
  hechos: Pick<Hechos, 'cuentas' | 'cotizaciones' | 'saldos' | 'operaciones' | 'tipos_cambio'>,
  cargas: readonly { id: number; cuenta_id: number | null; listado_completo: boolean }[],
): ResumenGuardado {
  const cuentas: ResumenCuenta[] = []
  const tipo_cambio = { ccl: false, cripto: false }
  let total = 0
  for (const c of cargas) {
    if (c.cuenta_id === null) {
      const tc = hechos.tipos_cambio.find((t) => t.carga_id === c.id)
      tipo_cambio.ccl ||= Boolean(tc?.ccl)
      tipo_cambio.cripto ||= Boolean(tc?.cripto_venta)
      continue
    }
    const nombre = hechos.cuentas.find((x) => x.id === c.cuenta_id)?.nombre
    if (!nombre) continue
    const n = {
      cotizaciones: hechos.cotizaciones.filter((x) => x.carga_id === c.id).length,
      saldos: hechos.saldos.filter((x) => x.carga_id === c.id).length,
      operaciones: hechos.operaciones.filter((x) => x.carga_id === c.id).length,
    }
    cuentas.push({ cuenta: nombre as NombreCuenta, ...n, precios_completados: 0, pendientes: 0, listado_completo: c.listado_completo })
    total += n.cotizaciones + n.saldos + n.operaciones
  }
  total += Number(tipo_cambio.ccl) + Number(tipo_cambio.cripto)
  return { cuentas, tipo_cambio, total, pendientes: 0 }
}

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
  const cotizado = new Map<number, { cuenta: NombreCuenta; precio: string; antes?: boolean }>()
  // Entre lotes vale lo mismo: lo que un Excel ya grabó hoy no lo pisa una captura.
  const excelPrevio = new Map((e.cotizaciones_excel ?? []).map((c) => [c.activo_id, c]))
  const cclOperaciones = e.ccl_del_dia === undefined ? e.tc.ccl : e.ccl_del_dia
  const sinGrabar: { cuenta: NombreCuenta; pendientes: number }[] = []
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
    const previoDeExcel = (activo_id: number) => {
      const x = lectura.origen === 'excel' ? undefined : excelPrevio.get(activo_id)
      return x ? { cuenta: x.cuenta, precio: x.precio_pesos, antes: true } : undefined
    }

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
        const previa = cotizado.get(activo_id) ?? previoDeExcel(activo_id)
        if (previa) {
          const deCuando = previa.antes ? ', grabado antes hoy' : ''
          nota =
            previa.precio === d.cotizacion.precio_pesos
              ? `precio igual al de ${previa.cuenta}${deCuando}`
              : `precio no grabado: vale el de ${previa.cuenta}${deCuando} (${previa.precio}); esta fuente mostraba ${d.cotizacion.precio_pesos}`
        } else {
          cotizacion = d.cotizacion.precio_pesos
          cotizado.set(activo_id, { cuenta: nombre, precio: cotizacion })
          cotizaciones.push({ activo_id, precio_pesos: cotizacion })
        }
      }
      let grabada: OperacionAGrabar | null = null
      // "Ya la tenía": la apertura con el PPP en vez de la compra propuesta.
      const base = eligioApertura(d, el) ? d.apertura_alternativa! : d.operacion
      if (base) {
        const op: OperacionAGrabar = { ...base, activo_id }
        if (el?.operacion) {
          op.cantidad = el.operacion.cantidad
          op.precio = el.operacion.precio
        }
        if (op.tipo !== 'apertura') op.ccl_del_dia = cclOperaciones
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
        ...(eligioApertura(d, el) ? { como_apertura: true } : {}),
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

    // Tenencias que la fuente no trajo: la venta o el vencimiento que registraste,
    // o pendientes. Las pendientes quedan en lo grabado con su activo y su cuenta:
    // hasta que se registren valen "sin dato" (Hechos.ausentes, leído de acá).
    const ausentes: unknown[] = []
    let ausentesPendientes = 0
    for (const a of e.propuesta.ausentes.filter((x) => x.cuenta === nombre)) {
      const registro = { ticker: a.ticker, activo_id: a.activo_id, cuenta_id: cuenta.id, cantidad_app: a.cantidad_app }
      const r = registroAusente(e.elecciones, a)
      if (r) {
        const problema = problemaRegistroAusente({ ...a, ccl_del_dia: cclOperaciones }, r)
        if (problema) {
          errores.push(`${nombre} · ${a.ticker}: ${problema}.`)
          continue
        }
        const op: OperacionAGrabar = {
          activo_id: a.activo_id,
          tipo: r.tipo,
          cantidad: a.cantidad_app,
          moneda: 'ARS',
          precio: r.tipo === 'venta' ? r.precio : null,
          importe: r.importe,
          comisiones: '0',
          ccl_del_dia: cclOperaciones,
          fecha_origen: null,
          notas: `${nombre} ya no lo lista`,
        }
        operaciones.push(op)
        grabadas++
        ausentes.push({ ...registro, resolucion: 'registrada', grabada: op })
        continue
      }
      const el = e.elecciones.ausentes[claveAusente(a)]
      ausentesPendientes++
      ausentes.push({ ...registro, resolucion: el === 'pendiente' ? 'pendiente' : 'sin revisar al guardar' })
    }
    pendientes += ausentesPendientes

    // Una fuente que no graba nada (todo quedó pendiente) no crea su carga: no
    // reemplaza a la buena del día ni hace figurar la cuenta al día. Si declara
    // tenencias ausentes, sí: eso es un dato (valen "sin dato" desde hoy).
    const nada = cotizaciones.length + saldos.length + operaciones.length + completar.length + ausentesPendientes === 0
    if (nada) {
      sinGrabar.push({ cuenta: nombre, pendientes })
      pendientesTotales += pendientes
      continue
    }

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
    errores.push(
      sinGrabar.length
        ? `Nada para guardar: todo lo de ${sinGrabar.map((x) => x.cuenta).join(' y ')} quedó pendiente.`
        : 'Nada para guardar: tipeá el CCL o el cripto, o soltá un archivo.',
    )
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
      ...(sinGrabar.length ? { sin_grabar: sinGrabar } : {}),
      tipo_cambio: { ccl: e.tc.ccl !== null, cripto: e.tc.cripto_venta !== null },
      total,
      pendientes: pendientesTotales,
    },
  }
}
