// La lectura de Exposición (D-157, anatomía 2): una frase en serif que
// contesta "¿Cuánto estoy jugado al peso?", con un solo énfasis y su cifra
// trazable. Función pura, con test: el Encabezado solo la dibuja. Cuando falta
// un dato, la frase dice qué falta con palabras (nunca "sin dato" ni un cero).

import { monto } from '@/lib/domain/dinero'
import { cifra, enfasis, texto, type ParteLectura } from '@/components/pantalla/lectura'
import type { VistaExposicionPantalla } from '@/lib/vistas/contratos-exposicion'

type Vista = Pick<VistaExposicionPantalla, 'fecha_datos' | 'vista' | 'resumen' | 'sin_moneda_de_riesgo'>

/** "Casa", "Casa y Camioneta", "Casa, Auto y Camioneta". */
function lista(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
}

export function lecturaExposicion(v: Vista): ParteLectura[] {
  if (!v.fecha_datos) return [texto('Todavía no hay cargas: tu exposición '), enfasis('aparece'), texto(' con la primera.')]
  const r = v.resumen
  const neto = r.neto_ars
  if (neto.valor === null) {
    if (v.vista === 'total' && v.sin_moneda_de_riesgo.length)
      return [texto('Contando tus bienes, el neto '), enfasis('todavía'), texto(` no se calcula: falta elegir la moneda de riesgo de ${lista(v.sin_moneda_de_riesgo)}.`)]
    if (r.deuda_pesos.ars.valor === null) return [texto('Sin la deuda del leasing no se sabe cuánto estás jugado al peso: '), enfasis('falta'), texto(' cargarla.')]
    return [texto('A tus pesos les falta un dato: el neto '), enfasis('todavía'), texto(' no se calcula.')]
  }
  const abs = neto.valor.replace(/^-/, '')
  const cuanto = cifra(monto(abs, 'ARS', { decimales: 0 }), neto, 'Exposición neta al peso · en pesos', 'ARS')
  if (/^-?0(\.0*)?$/.test(neto.valor)) return [texto('Lo que tenés y lo que debés en pesos se '), enfasis('compensan'), texto(': estás neutral al peso.')]
  if (neto.valor.startsWith('-')) return [texto('Debés más pesos de los que tenés: estás '), enfasis('corto'), texto(' en pesos por '), cuanto, texto('.')]
  return [texto('Tenés más pesos de los que debés: estás '), enfasis('largo'), texto(' en pesos por '), cuanto, texto('.')]
}
