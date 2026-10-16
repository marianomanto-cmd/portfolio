// "Resultado en pesos · activo vs. TC" (handoff, captura 07): una barra por
// partida con su resultado del período en pesos partido en lo que hizo el
// activo (tinta; sangría si es pérdida), lo que hizo el CCL (oro) y lo que
// todavía no se puede separar (gris). Lo positivo crece a la derecha del cero y
// lo negativo a la izquierda, con una sola escala. Función pura, con test: los
// montos llegan calculados (D-35); acá solo se ubican.

import { Decimal } from '@/lib/domain/dinero'
import type { CalcVista } from '@/lib/domain/calc'
import type { FilaResultado } from '@/lib/vistas/contratos-evolucion'

export type ParteBarra = 'activo' | 'tc' | 'sin_atribuir'

export interface TramoActivoTc {
  parte: ParteBarra
  negativo: boolean
  /** En % del ancho. */
  desde: number
  ancho: number
}

export interface FilaActivoTc {
  clave: string
  rotulo: string
  nombre: string
  color: string
  resultado: CalcVista
  tramos: TramoActivoTc[]
}

const v = (c: CalcVista): Decimal | null => (c.valor === null ? null : new Decimal(c.valor))

/** El rótulo corto: el ticker de un título; de un saldo, la moneda y la cuenta ("USD · IEB"). */
function rotulo(f: Pick<FilaResultado, 'clase' | 'ticker' | 'cuenta'>): string {
  return f.clase === 'saldo' && f.cuenta ? `${f.ticker} · ${f.cuenta}` : f.ticker
}

export function barrasActivoTc(filas: readonly FilaResultado[], max = 8): { cero: number; filas: FilaActivoTc[]; resto: number; conSinAtribuir: boolean; conPerdida: boolean } {
  const conValor = filas
    .filter((f) => f.clase === 'posicion' || f.clase === 'saldo')
    .map((f) => ({ f, r: v(f.resultado.ars) }))
    .sort((a, b) => (a.r === null ? 1 : b.r === null ? -1 : b.r.abs().cmp(a.r.abs())))
  const elegidas = conValor.slice(0, max)
  const partes = elegidas.map(({ f, r }) => {
    if (r === null) return { f, ps: [] as { parte: ParteBarra; x: Decimal }[] }
    const ps = (['activo', 'tc', 'sin_atribuir'] as const).map((parte) => ({ parte, x: v(f[parte].ars) })).filter((p): p is { parte: ParteBarra; x: Decimal } => p.x !== null && !p.x.isZero())
    return { f, ps }
  })
  const suma = (ps: { x: Decimal }[], signo: 1 | -1) => ps.filter((p) => p.x.times(signo).gt(0)).reduce((a, p) => a.plus(p.x.abs()), new Decimal(0))
  const pos = partes.reduce((a, x) => Decimal.max(a, suma(x.ps, 1)), new Decimal(0))
  const neg = partes.reduce((a, x) => Decimal.max(a, suma(x.ps, -1)), new Decimal(0))
  const rango = pos.plus(neg)
  const cero = rango.isZero() ? 0 : neg.div(rango).times(100).toNumber()
  const pct = (x: Decimal) => (rango.isZero() ? 0 : x.abs().div(rango).times(100).toNumber())
  let conSinAtribuir = false
  let conPerdida = false
  const out = partes.map(({ f, ps }): FilaActivoTc => {
    let der = cero
    let izq = cero
    const tramos: TramoActivoTc[] = []
    for (const p of ps) {
      const ancho = pct(p.x)
      const negativo = p.x.isNegative()
      if (p.parte === 'sin_atribuir') conSinAtribuir = true
      if (p.parte === 'activo' && negativo) conPerdida = true
      if (negativo) {
        izq -= ancho
        tramos.push({ parte: p.parte, negativo, desde: izq, ancho })
      } else {
        tramos.push({ parte: p.parte, negativo, desde: der, ancho })
        der += ancho
      }
    }
    return { clave: f.clave, rotulo: rotulo(f), nombre: f.nombre, color: f.color, resultado: f.resultado.ars, tramos }
  })
  return { cero, filas: out, resto: conValor.length - elegidas.length, conSinAtribuir, conPerdida }
}
