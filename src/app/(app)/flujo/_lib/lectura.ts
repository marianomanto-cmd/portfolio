// La lectura de Flujo y escenarios (D-157, anatomía 2; handoff, captura 10):
// cuánto te sobra este mes (con lo declarado y tu última carga) y adónde
// llegás con el escenario elegido, al horizonte. Un solo énfasis: la cifra
// del escenario. Pura, con test (lectura.test.ts): la pantalla la arma de
// nuevo con cada movimiento de una barra. Lo que falta se dice con palabras.

import type { CalcVista } from '@/lib/domain/calc'
import { Decimal, monto } from '@/lib/domain/dinero'
import type { Proyeccion } from '@/lib/domain/flujo/tipos'
import { cifra, enfasis, texto, type ParteLectura } from '@/components/pantalla/lectura'

/** Qué escenario se mira: todo en Igual, uno guardado (tal cual o con barras que moviste después de abrirlo), o el que estás tanteando. */
export type QueEscenario = { tipo: 'igual' } | { tipo: 'guardado'; nombre: string; cambios?: boolean } | { tipo: 'cambios' }

const NUMEROS = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']

/** "en un año", "en tres años", "en 18 meses", "en un mes". */
export function enCuanto(meses: number): string {
  if (meses === 1) return 'en un mes'
  if (meses % 12 === 0) {
    const a = meses / 12
    return a === 1 ? 'en un año' : `en ${NUMEROS[a] ?? a} años`
  }
  return `en ${meses} meses`
}

function quien(e: QueEscenario): string {
  if (e.tipo === 'igual') return 'Con todo igual'
  if (e.tipo === 'guardado') return e.cambios ? `En «${e.nombre}» con tus cambios` : `En «${e.nombre}»`
  return 'Con tus supuestos'
}

export interface DatosLectura {
  /** El mes en curso, con lo declarado (null sin cargas). */
  mes: { excedente: CalcVista; nombre: string } | null
  /** La proyección del escenario (null sin cargas). */
  proy: Proyeccion | null
  escenario: QueEscenario
  /** La traza del financiero en dólares al horizonte, armada al tocar (la proyección no arma trazas). */
  trazaFinal?: () => CalcVista
}

/**
 * "Este mes te sobran $ 2.662.000. Con todo igual, en un año llegás a
 * *US$ 87.587* en lo financiero." Sin proyección, el énfasis va en lo que falta.
 */
export function lecturaFlujo(d: DatosLectura): ParteLectura[] {
  if (!d.mes || !d.proy) return [texto('Todavía no hay '), enfasis('cargas'), texto(': con la primera ves cuánto te sobra por mes y adónde te lleva.')]
  const out: ParteLectura[] = []
  const e = d.mes.excedente
  if (e.valor === null) out.push(texto('Este mes todavía no se sabe cuánto te sobra. '))
  else {
    const v = new Decimal(e.valor)
    const titulo = `Excedente de ${d.mes.nombre.toLowerCase()} · en pesos`
    if (v.isZero()) out.push(texto('Este mes no te sobra nada. '))
    else if (v.gt(0)) out.push(texto('Este mes te sobran '), cifra(monto(v, 'ARS'), e, titulo, 'ARS'), texto('. '))
    else out.push(texto('Este mes te faltan '), cifra(monto(v.abs(), 'ARS'), e, titulo, 'ARS'), texto(': salen de tus pesos. '))
  }
  const p = d.proy
  if (p.estado === 'faltan' || !p.meses.length) {
    out.push(texto('Para proyectar '), enfasis(p.faltan.length === 1 ? 'falta un dato' : `faltan ${p.faltan.length} datos`), texto(' de tus supuestos.'))
    return out
  }
  const ultimo = p.meses[p.meses.length - 1]
  const cuando = enCuanto(p.meses.length - 1)
  const usd = ultimo.financiero.usd
  if (usd === null) {
    out.push(texto(`${quien(d.escenario)}, ${cuando} tu financiero `), enfasis('no se puede proyectar'), texto(ultimo.motivos?.financiero ? `: ${ultimo.motivos.financiero.replace(/\.$/, '')}.` : '.'))
    return out
  }
  const parte: ParteLectura = { ...enfasis(monto(usd, 'USD', { decimales: 0 })), titulo: `Patrimonio financiero al horizonte · en dólares`, moneda: 'USD', obtener: d.trazaFinal }
  out.push(texto(`${quien(d.escenario)}, ${cuando} llegás a `), parte, texto(' en lo financiero.'))
  return out
}
