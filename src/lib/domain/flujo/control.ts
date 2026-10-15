// Control de "Cargar ingreso" (plan §6 D.9; D-37): si vendiste dólares al
// cripto, los pesos que recibiste tienen que cerrar con US$ × cripto dentro de
// la precisión que tipeaste: medio último dígito del cripto por cada dólar,
// más medio último dígito de los pesos. La base hace el mismo control.

import { Decimal, numero } from '../dinero'

export interface ControlCripto {
  ok: boolean
  esperado: string
  tolerancia: string
  diferencia: string
  /** El cripto que cierra exacto: pesos ÷ dólares (por si la casa de cambio cobró algo). */
  efectivo: string
}

function decimales(t: string): number {
  const i = t.indexOf('.')
  return i < 0 ? 0 : t.length - i - 1
}

/** Los tres como texto decimal ("1541.20"). */
export function controlCripto(usd: string, cripto: string, pesos: string): ControlCripto {
  const u = new Decimal(usd)
  const c = new Decimal(cripto)
  const p = new Decimal(pesos)
  const esperado = u.times(c)
  const tol = u.times(new Decimal(10).pow(-decimales(cripto.trim()))).div(2).plus(new Decimal(10).pow(-decimales(pesos.trim())).div(2))
  const dif = p.minus(esperado)
  return { ok: dif.abs().lte(tol), esperado: esperado.toFixed(), tolerancia: tol.toFixed(), diferencia: dif.toFixed(), efectivo: u.gt(0) ? p.div(u).toFixed() : '0' }
}

export interface AvisoCripto {
  estado: 'incompleto' | 'ok' | 'no_cierra'
  texto: string
}

/**
 * El control a la vista mientras tipeás (formato argentino: "3.800", "1.541,20").
 * Mismo control que el servidor y la base: no frena nada acá, solo avisa.
 */
export function avisoCripto(usdTexto: string, criptoTexto: string, pesosTexto: string, leer: (t: string) => string | null): AvisoCripto {
  const u = usdTexto.trim() ? leer(usdTexto) : null
  const c = criptoTexto.trim() ? leer(criptoTexto) : null
  const p = pesosTexto.trim() ? leer(pesosTexto) : null
  if (!criptoTexto.trim() && !pesosTexto.trim()) return { estado: 'incompleto', texto: 'Si no los vendiste, dejá los dos vacíos.' }
  if (u === null || c === null || p === null || !(Number(u) > 0) || !(Number(c) > 0) || !(Number(p) > 0)) {
    return { estado: 'incompleto', texto: 'El cripto y los pesos van juntos: completá los dos (o ninguno).' }
  }
  const r = controlCripto(u, c, p)
  const esperado = new Decimal(r.esperado)
  const fmt = (x: Decimal) => numero(x, 2)
  if (r.ok) return { estado: 'ok', texto: `Cierra: US$ × cripto = $ ${fmt(esperado)}.` }
  const efectivo = new Decimal(r.efectivo)
  return {
    estado: 'no_cierra',
    texto: `No cierra: US$ × cripto da $ ${fmt(esperado)} y pusiste $ ${fmt(new Decimal(p))}. Con esos pesos, el cripto sería ${fmt(efectivo)}: revisá cuál de los dos está mal.`,
  }
}

/** Un aporte o un retiro de Datos › Movimientos, para el control de doble carga (texto decimal). */
export interface MovimientoParaControl {
  fecha: string
  tipo: 'aporte' | 'retiro'
  cuenta_id: number
  /** Lo que entró o salió de la cuenta y, si hubo conversión, lo del otro lado. */
  montos: { moneda: 'ARS' | 'USD'; monto: string }[]
}

/**
 * ¿Ya cargaste esto en Datos › Movimientos? (plan §6 D.9): mismo día, misma
 * cuenta, aporte para un ingreso o retiro para un gasto, y el mismo monto en
 * esa moneda. Solo avisa: puede ser otro movimiento igual.
 */
export function posibleDobleCarga(
  movimientos: readonly MovimientoParaControl[],
  f: { fecha: string; sentido: 'ingreso' | 'gasto'; cuenta_id: number | null; moneda: 'ARS' | 'USD' | null; monto: string | null },
): MovimientoParaControl | null {
  if (f.cuenta_id === null || f.moneda === null || f.monto === null || !/^\d+(\.\d+)?$/.test(f.monto)) return null
  const monto = new Decimal(f.monto)
  const tipo = f.sentido === 'ingreso' ? 'aporte' : 'retiro'
  return (
    movimientos.find((m) => m.fecha === f.fecha && m.tipo === tipo && m.cuenta_id === f.cuenta_id && m.montos.some((x) => x.moneda === f.moneda && new Decimal(x.monto).eq(monto))) ?? null
  )
}
