import type { CalcVista } from '@/lib/domain/calc'
import { Decimal, monto } from '@/lib/domain/dinero'
import type { FraseDelDia, Par, TarjetaPatrimonio } from '@/lib/vistas/contratos'
import { restoMayor } from '@/components/calculos'

// Cómo se muestran las cifras de la frase y de las tarjetas: las partes se
// redondean por resto mayor para que lo que se ve sume exacto lo que se ve
// (visión §4.0). El valor exacto queda en la traza.

export type Redondeo = Map<CalcVista, string>

const clave = (c: CalcVista) => `${c.valor}|${c.formula}`

/** Redondea un total y sus partes (en una moneda) y anota el valor mostrado de cada uno. */
function grupo(r: Map<string, Decimal>, total: CalcVista, partes: (CalcVista | null | undefined)[], decimales: number) {
  const ps = partes.filter((p): p is CalcVista => Boolean(p))
  if (total.valor === null || ps.some((p) => p.valor === null)) return
  const res = restoMayor(total.valor, ps.map((p) => p.valor as string), decimales)
  r.set(clave(total), res.total)
  ps.forEach((p, i) => r.set(clave(p), res.partes[i]))
}

export class Mostrar {
  private r = new Map<string, Decimal>()

  constructor(frase: FraseDelDia | null, tarjetas: TarjetaPatrimonio[]) {
    for (const t of tarjetas) {
      if (t.variacion && t.desglose) {
        grupo(this.r, t.variacion.ars, [t.desglose.tc.ars, t.desglose.activos.ars], 0)
        grupo(this.r, t.variacion.usd, [t.desglose.activos.usd, t.desglose.tc.usd], 0)
      }
    }
    if (frase) {
      grupo(this.r, frase.variacion.ars, [frase.tc.ars, frase.activos.ars, frase.sin_atribuir?.ars], 0)
      grupo(this.r, frase.variacion.usd, [frase.activos.usd, frase.tc.usd, frase.sin_atribuir?.usd], 0)
    }
  }

  /** El valor que se muestra (redondeado si es parte de un grupo), como texto decimal. */
  valor(c: CalcVista): string | null {
    if (c.valor === null) return null
    return (this.r.get(clave(c)) ?? new Decimal(c.valor)).toFixed()
  }

  texto(c: CalcVista, moneda: 'ARS' | 'USD', opciones: { signo?: boolean; abs?: boolean } = {}): string {
    const v = this.valor(c)
    if (v === null) return 'sin dato'
    const d = opciones.abs ? new Decimal(v).abs() : new Decimal(v)
    return monto(d, moneda, { decimales: 0, signo: opciones.signo })
  }

  par(p: Par): { ars: string | null; usd: string | null } {
    return { ars: this.valor(p.ars), usd: this.valor(p.usd) }
  }
}
