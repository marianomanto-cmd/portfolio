// Correcciones a mano de una fila leída (D-11: lo que no cierra no se graba en
// silencio). Una fila en error se destraba editando su cantidad o su precio:
// la edición vuelve a pasar por el chequeo aritmético contra el valorizado de
// la fuente. La lectura original no se toca: queda como lectura cruda, y la
// edición queda en lo grabado.

import { Decimal, monto, numero } from '@/lib/domain/dinero'
import type { FilaLeida, LecturaCuenta } from '@/lib/carga/contratos'

export interface EdicionFila {
  /** Cantidad corregida (decimal normalizado). */
  cantidad: string | null
  /** Precio por 1 VN / 1 unidad corregido (decimal normalizado). */
  precio_unitario: string | null
  /** Valorizado corregido: la otra lectura de una captura (decimal normalizado). */
  valorizado?: string | null
}

export type Ediciones = Readonly<Record<string, EdicionFila>>

function decimalesDe(v: string): number {
  const i = v.indexOf('.')
  return i === -1 ? 0 : v.length - i - 1
}

/**
 * Tolerancia del chequeo para una fila tipeada: medio último dígito del precio
 * por la cantidad, más medio centavo del valorizado (D-37 de la visión).
 */
export function toleranciaEditada(cantidad: string, precio: string): Decimal {
  const medio = new Decimal(5).times(new Decimal(10).pow(-(decimalesDe(precio) + 1)))
  return new Decimal(cantidad).abs().times(medio).plus('0.005')
}

/** Aplica una edición a una fila y vuelve a correr su chequeo. */
export function editarFila(f: FilaLeida, e: EdicionFila): FilaLeida {
  const cantidad = e.cantidad ?? f.cantidad
  const precio = e.precio_unitario ?? f.precio_unitario
  const valorizado = e.valorizado ?? f.valorizado
  const cambios: string[] = []
  if (e.cantidad !== null && e.cantidad !== f.cantidad) cambios.push(`cantidad ${numero(e.cantidad, 4, { min: 0 })}`)
  if (e.precio_unitario !== null && e.precio_unitario !== f.precio_unitario) {
    cambios.push(`precio ${monto(e.precio_unitario, 'ARS', { decimales: Math.max(2, decimalesDe(e.precio_unitario)) })}`)
  }
  if (e.valorizado != null && e.valorizado !== f.valorizado) cambios.push(`valorizado ${monto(e.valorizado, 'ARS', { decimales: 2 })}`)
  const base: FilaLeida = {
    ...f,
    cantidad,
    precio_unitario: precio,
    valorizado,
    // El precio tipeado es por 1 VN: el mostrado deja de aplicar.
    precio_mostrado: e.precio_unitario !== null ? null : f.precio_mostrado,
    escala: e.precio_unitario !== null ? '1' : f.escala,
  }
  const queCambio = cambios.length ? cambios.join(' y ') : 'sin cambios'
  if (cantidad === null || precio === null) {
    return { ...base, estado: 'error', motivos: [`Editada a mano (${queCambio}), pero falta ${cantidad === null ? 'la cantidad' : 'el precio'}.`], chequeo: null }
  }
  if (valorizado === null) {
    return {
      ...base,
      estado: 'advertencia',
      motivos: [`Editada a mano (${queCambio}). La fuente no trae valorizado: no hay control aritmético.`],
      chequeo: null,
    }
  }
  const calculado = new Decimal(cantidad).times(precio)
  // La tolerancia sale de lo tipeado, pero nunca es más laxa que la del
  // chequeo original: tipear menos decimales que la fuente no alcanza para cerrar.
  const tipeada = toleranciaEditada(cantidad, precio)
  const original = f.chequeo && /^\d+(\.\d+)?$/.test(f.chequeo.tolerancia) ? new Decimal(f.chequeo.tolerancia) : null
  const tolerancia = original && original.lt(tipeada) ? original : tipeada
  const ok = calculado.minus(valorizado).abs().lte(tolerancia)
  return {
    ...base,
    estado: ok ? 'verificada' : 'error',
    motivos: ok
      ? [`Editada a mano (${queCambio}); cierra contra el valorizado de la fuente.`]
      : [
          `Editada a mano (${queCambio}), pero no cierra: ${numero(cantidad, 4, { min: 0 })} × ${numero(precio, 6, { min: 2 })} = ${monto(calculado, 'ARS', { decimales: 2 })} y la fuente dice ${monto(valorizado, 'ARS', { decimales: 2 })}.`,
        ],
    chequeo: {
      regla: 'cantidad × precio por 1 VN ≈ valorizado (editada a mano)',
      esperado: new Decimal(valorizado).toFixed(),
      calculado: calculado.toFixed(),
      tolerancia: tolerancia.toFixed(),
      ok,
    },
  }
}

/** Aplica las ediciones a todas las lecturas (sin mutar las originales). */
export function aplicarEdiciones(lecturas: readonly LecturaCuenta[], ediciones: Ediciones): LecturaCuenta[] {
  return lecturas.map((l) => ({
    ...l,
    filas: l.filas.map((f) => (ediciones[f.clave] ? editarFila(f, ediciones[f.clave]) : f)),
  }))
}

/** Una lectura sin lo crudo: alcanza para proponer y pesa mucho menos. */
export function sinCruda(l: LecturaCuenta): LecturaCuenta {
  return { ...l, cruda: null }
}
