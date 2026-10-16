// La frase de arriba del balance, lista para FraseBalance (que resuelve el
// dedo: en el teléfono la frase es texto y "Ver la frase completa y cada
// cifra" abre una hoja con una fila tocable por cifra).

import type { FilaDetalle, ParteMostrada } from '../../_componentes/balance/frase-balance'
import type { ParteFraseBalance } from '@/lib/vistas/contratos-balance'

const esMonto = (texto: string) => /\$/.test(texto) || texto === 'sin dato'

export function partesMostradas(partes: readonly ParteFraseBalance[]): ParteMostrada[] {
  return partes.map((x) => ({
    texto: x.texto,
    calc: x.calc,
    tono: null, // no es un resultado: nada de verde ni rojo
    esMonto: x.calc !== null && esMonto(x.texto),
    titulo: x.titulo ?? 'Balance',
  }))
}

/** Una fila por cifra: el par de pesos y dólares de un mismo título va junto; un porcentaje, solo. */
export function detalleFrase(partes: readonly ParteFraseBalance[]): FilaDetalle[] {
  const filas: FilaDetalle[] = []
  for (const m of partesMostradas(partes)) {
    if (!m.calc) continue
    const usd = m.texto.includes('US$')
    const ultima = filas.at(-1)
    if (usd && ultima && ultima.etiqueta === m.titulo && ultima.usd === null) {
      ultima.usd = m
      continue
    }
    filas.push({ etiqueta: m.titulo, ars: usd ? null : m, usd: usd ? m : null })
  }
  return filas
}
