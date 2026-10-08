/** Motivos de una reversión (visión §4.3): una opción, con texto opcional ("otro" lo pide). */
export const MOTIVOS = ['lectura equivocada', 'archivo de otro día', 'otro'] as const
export type Motivo = (typeof MOTIVOS)[number]

export interface EstadoReversion {
  ok: boolean
  mensaje: string
}
