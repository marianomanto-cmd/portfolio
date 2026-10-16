// La frase del día, completa (HO-1), en las partes que dibuja <Frase>: cada
// cifra con su tono, si es un monto (el modo privado lo tapa) y el título de
// su traza; y el detalle para la hoja del teléfono, cada cifra en su renglón.
// Puras (sin React). Antes vivían en la página de Hoy; con el rediseño, la
// frase completa va en el detalle, debajo de la lectura.

import type { CalcVista } from '@/lib/domain/calc'
import type { FraseDelDia } from '@/lib/vistas/contratos'
import type { FilaDetalle, ParteMostrada } from './frase'
import type { Mostrar } from './redondeo-frase'

const tono = (valor: string | null): ParteMostrada['tono'] => (valor === null || /^-?0(\.0+)?$/.test(valor) ? null : valor.startsWith('-') ? 'neg' : 'pos')

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const mismo = (a: CalcVista, b: CalcVista) => a.valor === b.valor && a.formula === b.formula

/** La cifra que nombra un grupo en la frase express: "de tus US$ 4.200" (tus dólares en efectivo de la carga anterior). */
function esBaseDeGrupo(f: FraseDelDia, i: number): boolean {
  const ant = f.partes[i - 1]
  return Boolean(f.partes[i]?.calc) && Boolean(ant) && !ant.calc && ant.texto.trim() === 'de tus'
}

/**
 * El nombre que la frase le da a una cifra que no es la variación, los
 * activos, el CCL ni lo sin atribuir: el grupo que la sigue ("de SPY", "de tus
 * pesos en efectivo", en la segunda oración de una carga express).
 */
function nombreDeParte(f: FraseDelDia, i: number): string | null {
  const sig = f.partes[i + 1]
  if (!sig || sig.calc) return null
  const t = sig.texto.trim().replace(/[.,;:]+$/, '')
  // "+$ 49.560 de tus US$ 4.200": al grupo lo nombra una cifra con su traza (tus
  // dólares de la carga anterior), que no va en el rótulo (se ve en modo privado).
  if (t === 'de tus' && esBaseDeGrupo(f, i + 2)) return 'de tus dólares en efectivo'
  return /^de /.test(t) ? t : null
}

export function tituloParte(f: FraseDelDia, i: number): string {
  const p = f.partes[i]
  const c = p.calc!
  if (mismo(c, f.variacion.ars)) return 'Variación en pesos'
  if (mismo(c, f.variacion.usd)) return 'Variación en dólares'
  if (mismo(c, f.tc.ars)) return 'Lo que puso el CCL, en pesos'
  if (mismo(c, f.tc.usd)) return 'Lo que puso el CCL, en dólares'
  if (mismo(c, f.activos.ars)) return 'Lo que pusieron tus activos, en pesos'
  if (mismo(c, f.activos.usd)) return 'Lo que pusieron tus activos, en dólares'
  if (f.sin_atribuir && (mismo(c, f.sin_atribuir.ars) || mismo(c, f.sin_atribuir.usd))) return 'Sin atribuir (sin precio o saldo nuevo)'
  if (p.texto.trim().endsWith('%')) return 'Variación porcentual'
  if (esBaseDeGrupo(f, i)) return 'Tus dólares en efectivo, en la carga anterior'
  const en = p.texto.includes('US$') ? 'en dólares' : 'en pesos'
  const nombre = nombreDeParte(f, i)
  return nombre ? `${mayuscula(nombre)}, ${en}` : `Cifra de la frase, ${en}`
}

export function partesFrase(f: FraseDelDia, m: Mostrar): ParteMostrada[] {
  return f.partes.map((p, i) => {
    if (!p.calc) return { texto: p.texto, calc: null, tono: null, esMonto: false, titulo: '' }
    const c = p.calc
    const esPct = p.texto.trim().endsWith('%')
    if (esPct || c.valor === null) return { texto: p.texto, calc: c, tono: null, esMonto: !esPct, titulo: tituloParte(f, i) }
    const moneda = p.texto.includes('US$') ? 'USD' : 'ARS'
    const conSigno = /^[+−-]/.test(p.texto.trim())
    const texto = m.texto(c, moneda, { signo: conSigno, abs: !conSigno })
    return { texto, calc: c, tono: conSigno ? tono(m.valor(c)) : null, esMonto: true, titulo: tituloParte(f, i) }
  })
}

export function detalleFrase(f: FraseDelDia, m: Mostrar): FilaDetalle[] {
  const parte = (c: CalcVista, moneda: 'ARS' | 'USD', titulo: string, signo = true): ParteMostrada => ({
    texto: m.texto(c, moneda, signo ? { signo: true } : { signo: false, abs: true }),
    calc: c,
    tono: signo ? tono(m.valor(c)) : null,
    esMonto: true,
    titulo,
  })
  const filas: FilaDetalle[] = [
    { etiqueta: 'Variación', ars: parte(f.variacion.ars, 'ARS', 'Variación en pesos'), usd: parte(f.variacion.usd, 'USD', 'Variación en dólares') },
    { etiqueta: 'Por tus activos', ars: parte(f.activos.ars, 'ARS', 'Tus activos, en pesos'), usd: parte(f.activos.usd, 'USD', 'Tus activos, en dólares') },
    { etiqueta: 'Por el CCL', ars: parte(f.tc.ars, 'ARS', 'El CCL, en pesos'), usd: parte(f.tc.usd, 'USD', 'El CCL, en dólares') },
  ]
  if (f.sin_atribuir) {
    filas.push({ etiqueta: 'Sin atribuir', ars: parte(f.sin_atribuir.ars, 'ARS', 'Sin atribuir, en pesos'), usd: parte(f.sin_atribuir.usd, 'USD', 'Sin atribuir, en dólares') })
  }
  // Las demás cifras de la frase (la segunda oración de una carga express),
  // cada una en su renglón tocable con el nombre que le da la frase (D-113).
  // Una cifra igual a otra que ya está arriba no se repite.
  const vistas: CalcVista[] = filas.flatMap((x) => [x.ars?.calc, x.usd?.calc]).filter((c): c is CalcVista => Boolean(c))
  const extra = new Map<string, FilaDetalle>()
  f.partes.forEach((p, i) => {
    const c = p.calc
    if (!c || p.texto.trim().endsWith('%') || vistas.some((x) => mismo(x, c))) return
    const lado = p.texto.includes('US$') ? 'usd' : 'ars'
    const base = esBaseDeGrupo(f, i) ? 'Tus dólares en efectivo (carga anterior)' : mayuscula(nombreDeParte(f, i) ?? 'En la frase')
    let etiqueta = base
    for (let n = 2; extra.get(etiqueta)?.[lado]; n++) etiqueta = `${base} (${n})`
    const fila = extra.get(etiqueta) ?? { etiqueta, ars: null, usd: null }
    // Con signo solo lo que la frase muestra con signo (un saldo, como "US$ 4.200", no lo lleva).
    fila[lado] = parte(c, lado === 'usd' ? 'USD' : 'ARS', tituloParte(f, i), /^[+−-]/.test(p.texto.trim()))
    extra.set(etiqueta, fila)
    vistas.push(c)
  })
  return [...filas, ...extra.values()]
}
