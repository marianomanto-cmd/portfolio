// Conciliación de la carga (D-14, D-15, D-19): compara lo que leyó cada fuente
// contra lo que la app ya sabe (tenencias derivadas de sus operaciones) y
// propone qué grabar. Nada se aplica solo: la bandeja lo muestra y el dueño
// confirma. Una diferencia de cantidad nunca se convierte en silencio en una
// operación: se propone, con su motivo, como advertencia a aceptar.

import { Decimal, monto, numero } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import { tenencias } from '@/lib/domain/posiciones'
import type { Activo, Fecha, Hechos, Moneda } from '@/lib/domain/tipos'
import type {
  ActivoNuevo,
  DecisionFila,
  DecisionSaldo,
  EstadoFila,
  FilaLeida,
  LecturaCuenta,
  OperacionAGrabar,
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

export function proponerCarga(
  lecturas: LecturaCuenta[],
  hechos: Hechos,
  fecha: Fecha,
  tc: { ccl: Decimal | null },
): PropuestaCarga {
  const porTicker = new Map<string, Activo>(hechos.activos.map((a) => [a.ticker.toUpperCase(), a]))
  const tens = tenencias(hechos.operaciones)
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

    const yaCargada =
      hechos.operaciones.some((o) => o.cuenta_id === cuenta.id) || hechos.cargas.some((c) => c.cuenta_id === cuenta.id && c.estado !== 'revertida')
    const vistos = new Set<number>()

    for (const f of l.filas) {
      const activo = porTicker.get(f.ticker.toUpperCase()) ?? null
      if (activo) vistos.add(activo.id)
      const t = activo ? tens.get(`${cuenta.id}:${activo.id}`) : undefined
      const qApp = t?.cantidad ?? new Decimal(0)
      const qLeida = f.cantidad !== null ? new Decimal(f.cantidad) : null
      const motivos = [...f.motivos]
      let estado: EstadoFila = f.estado
      let accion: DecisionFila['accion'] = 'ninguna'
      let operacion: OperacionAGrabar | null = null

      if (qLeida === null) {
        accion = 'revisar'
        estado = 'error'
        motivos.push('No se pudo leer la cantidad.')
      } else {
        const diff = qLeida.minus(qApp)
        const base = {
          activo_id: activo?.id ?? 0,
          moneda: 'ARS' as Moneda,
          importe: null,
          comisiones: '0',
          notas: null,
        }
        if (!diff.isZero()) {
          if (qApp.isZero() && !yaCargada) {
            // Primera carga de la cuenta: tenencia inicial (D-14). Una compra
            // del día (PPP "-", a liquidar) entra como compra pendiente (D-19).
            if (f.ppc_unitario === null && f.liquidacion === 'liquidar') {
              accion = 'compra'
              operacion = { ...base, tipo: 'compra', cantidad: qLeida.toFixed(), precio: null, ccl_del_dia: ccl, fecha_origen: null }
              motivos.push('Compra del día: el PPP llega con la próxima carga (D-19).')
              estado = peor(estado, 'advertencia')
            } else {
              accion = 'apertura'
              operacion = { ...base, tipo: 'apertura', cantidad: qLeida.toFixed(), precio: f.ppc_unitario, ccl_del_dia: null, fecha_origen: null }
              if (f.ppc_unitario === null) motivos.push('Sin PPP: el costo queda "sin dato" hasta que lo declares.')
            }
          } else if (diff.isPositive()) {
            // El bróker tiene más que la app: falta una compra (D-15).
            let precio: string | null = null
            if (f.ppc_unitario !== null && t && t.costo_ars !== null) {
              // Precio implícito por el cambio de PPP: (PPP₁ × q₁ − costo₀) ÷ Δq (D-19).
              const p = new Decimal(f.ppc_unitario).times(qLeida).minus(t.costo_ars).div(diff)
              if (p.isPositive()) precio = p.toFixed()
            } else if (f.ppc_unitario !== null && qApp.isZero()) {
              precio = f.ppc_unitario
            }
            accion = 'compra'
            operacion = { ...base, tipo: 'compra', cantidad: diff.toFixed(), precio, ccl_del_dia: ccl, fecha_origen: null }
            motivos.push(
              `El bróker tiene ${numero(qLeida, 4, { min: 0 })} y la app ${numero(qApp, 4, { min: 0 })}: falta una compra de ${numero(diff, 4, { min: 0 })}` +
                (precio ? ` a ${monto(precio, 'ARS', { decimales: 4 })} (inferido del PPP, sin comisiones).` : ' (precio pendiente).'),
            )
            estado = peor(estado, 'advertencia')
          } else {
            const q = diff.negated()
            accion = 'venta'
            operacion = { ...base, tipo: 'venta', cantidad: q.toFixed(), precio: f.precio_unitario, ccl_del_dia: ccl, fecha_origen: null }
            motivos.push(
              `El bróker tiene ${numero(qLeida, 4, { min: 0 })} y la app ${numero(qApp, 4, { min: 0 })}: falta una venta de ${numero(q, 4, { min: 0 })}` +
                (f.precio_unitario ? ` (precio de hoy como referencia; corregilo si vendiste a otro).` : '.'),
            )
            estado = peor(estado, 'advertencia')
          }
        }
      }
      if (!activo) {
        motivos.push('Ticker nuevo: confirmá tipo, moneda de riesgo y geografía para darlo de alta.')
        estado = peor(estado, 'advertencia')
      }
      if (ccl === null && operacion && operacion.tipo !== 'apertura') {
        motivos.push('Falta el CCL del día: lo necesita la operación.')
        estado = 'error'
      }
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
        cotizacion: f.precio_unitario !== null ? { precio_pesos: f.precio_unitario } : null,
        estado,
        motivos,
        fila: f,
      })
    }

    // Tenencias que la app tiene en esta cuenta y la fuente no trae.
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
