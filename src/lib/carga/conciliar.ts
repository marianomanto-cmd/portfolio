// Conciliación de la carga (D-14, D-15, D-19): compara lo que leyó cada fuente
// contra lo que la app ya sabe (tenencias derivadas de sus operaciones) y
// propone qué grabar. Nada se aplica solo: la bandeja lo muestra y el dueño
// confirma. Una diferencia de cantidad nunca se convierte en silencio en una
// operación: se propone, con su motivo, como advertencia a aceptar.
//
// Se compara contra lo que la app tenía al cierre del día de la carga, no
// contra operaciones posteriores (una carga atrasada no inventa ventas, B21).
//
// Motivos: primero los que frenan (error), después la propuesta, después lo
// que dijo el lector. La bandeja y la confirmación muestran motivos[0] como el
// principal.

import { CERO, Decimal, monto, numero, UNO } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import { tenencias, type Tenencia } from '@/lib/domain/posiciones'
import type { Activo, Fecha, Hechos, Moneda, Operacion } from '@/lib/domain/tipos'
import type {
  ActivoNuevo,
  DecisionFila,
  DecisionSaldo,
  EstadoFila,
  FilaLeida,
  LecturaCuenta,
  OperacionAGrabar,
  PrecioInferido,
  PropuestaCarga,
} from './contratos'

function peor(a: EstadoFila, b: EstadoFila): EstadoFila {
  const orden: EstadoFila[] = ['verificada', 'advertencia', 'error']
  return orden[Math.max(orden.indexOf(a), orden.indexOf(b))]
}

function sugerirActivo(f: FilaLeida): ActivoNuevo {
  const nombre = f.nombre ?? f.ticker
  const tipo = f.tipo_sugerido ?? 'accion_local'
  const n = nombre.toUpperCase()
  const indexacion: ActivoNuevo['indexacion'] =
    tipo === 'bono' || tipo === 'lecap'
      ? n.includes('DUAL') && n.includes('CER') && n.includes('TAMAR')
        ? 'dual_cer_tamar'
        : n.includes('CER') || n.includes('BONCER')
          ? 'cer'
          : n.includes('TAMAR')
            ? 'tamar'
            : n.includes('LINKED') || n.includes('D.L')
              ? 'dolar_linked'
              : 'fija'
      : null
  // La moneda de riesgo es una sugerencia que el dueño confirma (D-73): un
  // CEDEAR arriesga dólares; un bono en pesos, pesos; una acción local, lo
  // elige él (YPFD sigue al ADR por el CCL).
  const moneda_riesgo: Moneda = tipo === 'cedear' || f.moneda_emision === 'USD' ? 'USD' : 'ARS'
  return {
    ticker: f.ticker,
    nombre,
    tipo,
    moneda_riesgo,
    geografia: tipo === 'cedear' ? 'US' : 'AR',
    indexacion,
    ticker_subyacente: tipo === 'cedear' ? f.ticker : null,
  }
}

const cant = (d: Decimal) => numero(d, 4, { min: 0 })
const plata = (d: Decimal) => monto(d, 'ARS', { decimales: 2 })
/** Un precio con sus propios decimales (entre 2 y 6): "$ 1,0986", "$ 12.200,00". */
const precioTexto = (v: Decimal | string) => {
  const d = typeof v === 'string' ? new Decimal(v) : v
  return monto(d, 'ARS', { decimales: Math.min(6, Math.max(2, d.decimalPlaces())) })
}

/**
 * D-19: la cantidad coincide y la tenencia tiene una compra con precio e
 * importe vacíos (PPP "-" el día que se cargó). Con el PPP de hoy se infiere
 * su precio:
 *
 *   p = (PPP₁ × q₁ − costo de la tenencia con esa compra a precio 0) ÷ b
 *
 * donde b es lo que pesa la compra en el costo de hoy (su cantidad, salvo que
 * después hubo ventas, que sacan costo en proporción). En el caso simple es
 * (PPP₁ × q₁ − PPP₀ × q₀) ÷ Δq. El costo se calcula con las mismas reglas que
 * el motor (tenencias): el costo es lineal en p, así que dos corridas (p = 0 y
 * p = 1) dan los dos coeficientes. Devuelve null si no hay nada pendiente o el
 * PPP sigue sin informarse.
 */
export function precioPendiente(
  t: Tenencia | undefined,
  operaciones: readonly Operacion[],
  fecha: Fecha,
  ppp: string | null,
): { ok: true; completar: PrecioInferido } | { ok: false; motivo: string } | null {
  if (!t || ppp === null) return null
  const pendientes = t.operaciones.filter((o) => o.tipo === 'compra' && o.precio === null && o.importe === null)
  if (pendientes.length === 0) return null
  if (pendientes.length > 1) {
    return {
      ok: false,
      motivo: `Hay ${pendientes.length} compras con precio pendiente (${pendientes.map((o) => fechaCorta(o.fecha)).join(', ')}): un solo PPP no alcanza para separar sus precios. Quedan pendientes.`,
    }
  }
  const pend = pendientes[0]
  if (pend.moneda !== 'ARS') {
    return { ok: false, motivo: `La compra del ${fechaCorta(pend.fecha)} es en dólares y el PPP del bróker es en pesos: su precio queda pendiente.` }
  }
  const clave = `${t.cuenta_id}:${t.activo_id}`
  const con = (precio: Decimal) => tenencias(operaciones.map((o) => (o.id === pend.id ? { ...o, precio } : o)), fecha).get(clave)
  const t0 = con(CERO)
  const t1 = con(UNO)
  if (!t0 || !t1 || t0.costo_ars === null || t1.costo_ars === null) {
    return {
      ok: false,
      motivo: `Otra parte de la tenencia no tiene costo (${t0?.motivo_ars ?? 'sin dato'}): no se puede inferir el precio de la compra del ${fechaCorta(pend.fecha)}.`,
    }
  }
  const b = t1.costo_ars.minus(t0.costo_ars)
  const pppD = new Decimal(ppp)
  const p = b.gt(0) ? pppD.times(t.cantidad).minus(t0.costo_ars).div(b) : null
  const formula = `(${numero(pppD, 6, { min: 0 })} × ${cant(t.cantidad)} − ${plata(t0.costo_ars)}) ÷ ${cant(b)} = ${p ? precioTexto(p) : 'sin dato'}`
  if (p === null || !p.gt(0)) {
    return {
      ok: false,
      motivo: `El PPP de hoy no explica la compra del ${fechaCorta(pend.fecha)}: ${formula}, y un precio tiene que ser mayor que cero. ¿Cambio de ratio o una operación sin registrar? Revisalo con el bróker.`,
    }
  }
  // Verificación: con ese precio, el costo del motor tiene que dar PPP₁ × q₁. Si
  // no da (una amortización que llevó el costo a cero lo vuelve no lineal), no se propone.
  const objetivo = pppD.times(t.cantidad)
  const tp = con(p)
  if (!tp || tp.costo_ars === null || tp.costo_ars.minus(objetivo).abs().gt(objetivo.abs().times('1e-12').plus('1e-12'))) {
    return { ok: false, motivo: `No se puede inferir el precio de la compra del ${fechaCorta(pend.fecha)} desde el PPP: completalo a mano.` }
  }
  return {
    ok: true,
    completar: { operacion_id: pend.id, precio: p.toFixed(), fecha: pend.fecha, cantidad: pend.cantidad.toFixed(), formula },
  }
}

/** Tolerancia para "el costo no cambió" en un cambio de ratio: lo que redondea el PPP mostrado, o el 1% del costo. */
function toleranciaCosto(f: FilaLeida, q1: Decimal, q0: Decimal, costo0: Decimal): Decimal {
  const mostrado = f.ppc_mostrado ?? f.ppc_unitario ?? '0'
  const i = mostrado.indexOf('.')
  const decimales = i === -1 ? 0 : mostrado.length - i - 1
  const medio = new Decimal(5).times(new Decimal(10).pow(-(decimales + 1)))
  const precision = medio.times(f.escala ?? '1').times(q1.plus(q0))
  return Decimal.max(precision, costo0.abs().times('0.01'))
}

export function proponerCarga(
  lecturas: LecturaCuenta[],
  hechos: Hechos,
  fecha: Fecha,
  tc: { ccl: Decimal | null },
): PropuestaCarga {
  const porTicker = new Map<string, Activo>(hechos.activos.map((a) => [a.ticker.toUpperCase(), a]))
  // Lo que la app tenía al cierre del día de la carga (B21).
  const tens = tenencias(hechos.operaciones, fecha)
  const propuesta: PropuestaCarga = { fecha, filas: [], saldos: [], controles: [], advertencias: [], ausentes: [] }
  const ccl = tc.ccl ? tc.ccl.toFixed() : null

  for (const l of lecturas) {
    const cuenta = hechos.cuentas.find((c) => c.nombre === l.cuenta)
    if (!cuenta) {
      propuesta.advertencias.push(`La cuenta ${l.cuenta} no está en el catálogo de cuentas.`)
      continue
    }
    if (l.fecha_reporte && l.fecha_reporte !== fecha) {
      propuesta.advertencias.push(`${l.cuenta}: la fuente es del ${fechaCorta(l.fecha_reporte)} y la carga es del ${fechaCorta(fecha)}.`)
    }
    for (const a of l.advertencias) propuesta.advertencias.push(`${l.cuenta}: ${a}`)
    for (const c of l.controles) propuesta.controles.push({ cuenta: l.cuenta, control: c })

    const opsCuenta = hechos.operaciones.filter((o) => o.cuenta_id === cuenta.id)
    const cargasCuenta = hechos.cargas.filter((c) => c.cuenta_id === cuenta.id && c.estado !== 'revertida')
    const yaCargada = opsCuenta.some((o) => o.fecha <= fecha) || cargasCuenta.some((c) => c.fecha <= fecha)
    // Carga atrasada: ya hay cargas posteriores de esta cuenta.
    const posterior = cargasCuenta.map((c) => c.fecha).filter((f) => f > fecha).sort().at(-1) ?? null
    if (posterior) {
      propuesta.advertencias.push(
        `${l.cuenta}: ya hay una carga posterior (del ${fechaCorta(posterior)}); esta se concilia contra lo que la app tenía al ${fechaCorta(fecha)}.`,
      )
    }
    const vistos = new Set<number>()

    for (const f of l.filas) {
      const activo = porTicker.get(f.ticker.toUpperCase()) ?? null
      if (activo) vistos.add(activo.id)
      const t = activo ? tens.get(`${cuenta.id}:${activo.id}`) : undefined
      const qApp = t?.cantidad ?? CERO
      const qLeida = f.cantidad !== null ? new Decimal(f.cantidad) : null
      const errores: string[] = []
      const avisos: string[] = []
      let estado: EstadoFila = f.estado
      let accion: DecisionFila['accion'] = 'ninguna'
      let operacion: OperacionAGrabar | null = null
      let completar: PrecioInferido | null = null

      if (qLeida === null) {
        accion = 'revisar'
        estado = 'error'
        errores.push('No se pudo leer la cantidad.')
      } else {
        const diff = qLeida.minus(qApp)
        const base = {
          activo_id: activo?.id ?? 0,
          moneda: 'ARS' as Moneda,
          importe: null,
          comisiones: '0',
          notas: null,
        }
        const aperturaPosterior = activo
          ? opsCuenta.find((o) => o.activo_id === activo.id && o.tipo === 'apertura' && o.fecha > fecha)
          : undefined
        if (diff.isZero()) {
          // D-19: el PPP de hoy completa una compra que quedó pendiente.
          const r = precioPendiente(t, hechos.operaciones, fecha, f.ppc_unitario)
          if (r?.ok) {
            accion = 'completar_precio'
            completar = r.completar
            avisos.push(
              `Completar el precio de la compra del ${fechaCorta(r.completar.fecha)} (${cant(new Decimal(r.completar.cantidad))}): ` +
                `${precioTexto(r.completar.precio)}, inferido del PPP: ${r.completar.formula}.`,
            )
            estado = peor(estado, 'advertencia')
          } else if (r) {
            avisos.push(r.motivo)
            estado = peor(estado, 'advertencia')
          }
        } else if (qApp.isZero() && !yaCargada && aperturaPosterior) {
          // Carga anterior a la primera de la cuenta: la apertura ya existe, después.
          accion = 'revisar'
          avisos.push(
            `La app ya tiene la apertura de ${f.ticker} del ${fechaCorta(aperturaPosterior.fecha)}, posterior a esta carga: no se vuelve a abrir. Aceptá para grabar solo el precio.`,
          )
          estado = peor(estado, 'advertencia')
        } else if (qApp.isZero() && !yaCargada) {
          // Primera carga de la cuenta: tenencia inicial (D-14). Una compra
          // del día (PPP "-", a liquidar) entra como compra pendiente (D-19).
          if (f.ppc_unitario === null && f.liquidacion === 'liquidar') {
            accion = 'compra'
            operacion = { ...base, tipo: 'compra', cantidad: qLeida.toFixed(), precio: null, ccl_del_dia: ccl, fecha_origen: null }
            avisos.push('Compra del día: el PPP llega con la próxima carga (D-19).')
            estado = peor(estado, 'advertencia')
          } else {
            accion = 'apertura'
            operacion = { ...base, tipo: 'apertura', cantidad: qLeida.toFixed(), precio: f.ppc_unitario, ccl_del_dia: null, fecha_origen: null }
            if (f.ppc_unitario === null) avisos.push('Sin PPP: el costo queda "sin dato" hasta que lo declares.')
          }
        } else if (diff.gt(0)) {
          // El bróker tiene más que la app: falta una compra (D-15)… o cambió el ratio.
          let precio: string | null = null
          let ratio = false
          let sinExplicar: Decimal | null = null
          const ppp = f.ppc_unitario !== null ? new Decimal(f.ppc_unitario) : null
          if (ppp !== null && t && t.costo_ars !== null) {
            // Precio implícito por el cambio de PPP: (PPP₁ × q₁ − costo₀) ÷ Δq (D-19).
            const costo1 = ppp.times(qLeida)
            const p = costo1.minus(t.costo_ars).div(diff)
            const mismoCosto = costo1.minus(t.costo_ars).abs().lte(toleranciaCosto(f, qLeida, qApp, t.costo_ars))
            if (mismoCosto && diff.gte(qApp.times('0.1'))) {
              // Más cantidad con el mismo costo total: así se ve un cambio de ratio (B22).
              ratio = true
              accion = 'revisar'
              operacion = { ...base, tipo: 'ajuste_ratio', cantidad: diff.toFixed(), precio: null, ccl_del_dia: ccl, fecha_origen: null }
              avisos.push(
                `¿Cambio de ratio? El bróker tiene ${cant(qLeida)} y la app ${cant(qApp)}, con el mismo costo total ` +
                  `(PPP × cantidad = ${plata(costo1)}; costo en la app ${plata(t.costo_ars)}): se propone un ajuste de ratio de +${cant(diff)}, sin precio. Si fue una compra, dejalo pendiente.`,
              )
            } else if (p.gt(0)) {
              precio = p.toFixed()
            } else {
              sinExplicar = p
            }
          } else if (ppp !== null && qApp.isZero()) {
            precio = f.ppc_unitario
          }
          if (!ratio) {
            accion = sinExplicar ? 'revisar' : 'compra'
            operacion = { ...base, tipo: 'compra', cantidad: diff.toFixed(), precio, ccl_del_dia: ccl, fecha_origen: null }
            avisos.push(
              `El bróker tiene ${cant(qLeida)} y la app ${cant(qApp)}: falta una compra de ${cant(diff)}` +
                (precio
                  ? ` a ${precioTexto(precio)} (inferido del PPP, sin comisiones).`
                  : sinExplicar
                    ? ` (precio pendiente): el PPP no la explica, da un precio de ${precioTexto(sinExplicar)}. ¿Cambio de ratio? Revisalo con el bróker.`
                    : ' (precio pendiente).'),
            )
          }
          estado = peor(estado, 'advertencia')
        } else {
          const q = diff.negated()
          accion = 'venta'
          operacion = { ...base, tipo: 'venta', cantidad: q.toFixed(), precio: f.precio_unitario, ccl_del_dia: ccl, fecha_origen: null }
          avisos.push(
            `El bróker tiene ${cant(qLeida)} y la app ${cant(qApp)}: falta una venta de ${cant(q)}` +
              (f.precio_unitario ? ` (precio de hoy como referencia; corregilo si vendiste a otro).` : '.'),
          )
          estado = peor(estado, 'advertencia')
        }
        if (posterior && operacion) {
          avisos.push(`Ojo: ya hay una carga posterior de ${l.cuenta} (del ${fechaCorta(posterior)}). Si esta operación ya quedó registrada ahí, dejala pendiente.`)
        }
      }
      if (!activo) {
        avisos.push('Ticker nuevo: confirmá tipo, moneda de riesgo y geografía para darlo de alta.')
        estado = peor(estado, 'advertencia')
      }
      if (ccl === null && operacion && operacion.tipo !== 'apertura') {
        errores.push('Falta el CCL del día: lo necesita la operación.')
        estado = 'error'
      }
      const motivos = f.estado === 'error' ? [...errores, ...f.motivos, ...avisos] : [...errores, ...avisos, ...f.motivos]
      propuesta.filas.push({
        clave: f.clave,
        cuenta: l.cuenta,
        cuenta_id: cuenta.id,
        ticker: f.ticker,
        nombre: f.nombre,
        activo_id: activo?.id ?? null,
        activo_nuevo: activo ? null : sugerirActivo(f),
        cantidad_leida: qLeida?.toFixed() ?? null,
        cantidad_app: qApp.toFixed(),
        accion,
        operacion,
        completar,
        cotizacion: f.precio_unitario !== null ? { precio_pesos: f.precio_unitario } : null,
        estado,
        motivos,
        fila: f,
      })
    }

    // Tenencias que la app tenía en esta cuenta al día de la carga y la fuente no trae.
    if (l.origen === 'excel') {
      for (const t of tens.values()) {
        if (t.cuenta_id !== cuenta.id || vistos.has(t.activo_id)) continue
        const a = hechos.activos.find((x) => x.id === t.activo_id)
        propuesta.ausentes.push({ cuenta: l.cuenta, ticker: a?.ticker ?? String(t.activo_id), cantidad_app: t.cantidad.toFixed() })
      }
    }

    for (const s of l.saldos) {
      const anteriores = hechos.saldos
        .filter((x) => x.cuenta_id === cuenta.id && x.moneda === s.moneda && x.fecha < fecha)
        .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      const ant = anteriores.at(-1) ?? null
      const d: DecisionSaldo = {
        clave: `${l.cuenta}:saldo:${s.moneda}`,
        cuenta: l.cuenta,
        cuenta_id: cuenta.id,
        moneda: s.moneda,
        monto: s.monto,
        anterior: ant ? { fecha: ant.fecha, monto: ant.monto.toFixed() } : null,
        estado: s.estado,
        motivos: [...s.motivos],
        saldo: s,
      }
      propuesta.saldos.push(d)
    }
  }
  return propuesta
}
