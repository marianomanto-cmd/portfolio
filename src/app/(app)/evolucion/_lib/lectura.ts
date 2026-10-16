// La lectura de Evolución y PnL (D-157, anatomía 2): una frase en serif que
// contesta "¿Gané o perdí, y por qué?", con un solo énfasis y sus cifras
// trazables. Función pura, con test. Lo que importa primero (spec): si en
// pesos ganaste y en dólares perdiste, eso es lo que dice; si no, quién puso
// la mayor parte, tus activos o el dólar. Cuando falta un dato lo dice con
// palabras (nunca "sin dato" ni un cero).

import { Decimal, monto } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { CalcVista } from '@/lib/domain/calc'
import { cifra, enfasis, texto, type ParteLectura } from '@/components/pantalla/lectura'
import type { VistaEvolucion } from '@/lib/vistas/contratos-evolucion'

type Vista = Pick<VistaEvolucion, 'estado' | 'primera' | 'totales'>

const dec = (c: CalcVista | undefined | null): Decimal | null => (c && c.valor !== null ? new Decimal(c.valor) : null)
const verbo = (x: Decimal) => (x.isNegative() ? 'perdiste' : 'ganaste')

export function lecturaEvolucion(v: Vista): ParteLectura[] {
  if (v.estado === 'sin_cargas' || !v.primera) return [texto('Todavía no hay cargas: tu evolución '), enfasis('arranca'), texto(' con la primera.')]
  if (v.estado === 'un_dia') return [texto(`Tu historia empieza el ${fechaCorta(v.primera)}: con tu `), enfasis('próxima'), texto(' carga vas a ver qué cambió y por qué.')]
  const t = v.totales
  const a = dec(t?.resultado.ars)
  if (!t || a === null) return [texto('En el período, tu resultado '), enfasis('todavía'), texto(' no se puede calcular: falta un dato.')]
  const enPesos = cifra(monto(a.abs(), 'ARS', { decimales: 0 }), t.resultado.ars, 'Resultado del período · en pesos', 'ARS')
  const u = dec(t.resultado.usd)
  if (u === null) return [texto(`En el período ${verbo(a)} `), enPesos, texto(' en pesos; en dólares, el resultado '), enfasis('todavía'), texto(' no se calcula: falta un dato.')]
  const enDolares = cifra(monto(u.abs(), 'USD', { decimales: 0 }), t.resultado.usd, 'Resultado del período · en dólares', 'USD')
  if (a.isZero() && u.isZero()) return [texto('En el período tu patrimonio no se '), enfasis('movió'), texto(' por resultados: ni en pesos ni en dólares.')]
  // Ganaste en una moneda y perdiste en la otra: es lo primero que hay que saber (spec, contexto).
  if (a.isNegative() !== u.isNegative() && !a.isZero() && !u.isZero())
    return [texto(`En el período ${verbo(a)} `), enPesos, texto(' en pesos, pero en dólares '), enfasis(verbo(u)), texto(': '), enDolares, texto('.')]
  const activo = dec(t.activo.ars)?.abs() ?? null
  const tc = dec(t.tc.ars)?.abs() ?? null
  const sinAtribuir = dec(t.sin_atribuir.ars)?.abs() ?? null
  const inicio = [texto(`En el período ${verbo(a)} `), enPesos, texto(' en pesos y '), enDolares, texto(' en dólares; ')]
  if (activo === null || tc === null) return [texto('En el período '), enfasis(verbo(a)), texto(' '), enPesos, texto(' en pesos y '), enDolares, texto(' en dólares.')]
  const gano = !a.isNegative()
  if (sinAtribuir !== null && sinAtribuir.gt(activo) && sinAtribuir.gt(tc)) return [...inicio, texto('la mayor parte, '), enfasis('sin atribuir'), texto(': falta un precio o un saldo nuevo.')]
  // "La mayor parte": la más grande de las partes, no necesariamente más de la mitad (con algo sin atribuir, ninguna llega).
  if (tc.gt(activo)) return [...inicio, texto(gano ? 'la mayor parte la puso el ' : 'la mayor parte vino del '), enfasis('dólar'), texto('.')]
  return [...inicio, texto(gano ? 'la mayor parte la pusieron tus ' : 'la mayor parte vino de tus '), enfasis('activos'), texto('.')]
}
