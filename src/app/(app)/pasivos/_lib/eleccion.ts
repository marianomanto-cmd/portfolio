// La opción que se muestra marcada en "¿Quién paga la cuota?" y "¿La empresa
// te reintegra el IVA?": la que quedó guardada. Mientras se guarda, la que
// tocaste; si guardar falla (sesión vencida, error de la base), vuelve la de
// antes: nunca se ve elegido algo que no se guardó.

export function eleccionMostrada(p: {
  /** La del contrato, como la leyó el servidor (null = sin declarar). */
  guardada: string | null
  /** La última que tocaste (null = ninguna todavía). */
  tocada: string | null
  /** El resultado del último guardado. */
  estado: { ok: boolean; mensaje: string } | null
  enviando: boolean
}): string | null {
  if (p.tocada === null) return p.guardada
  if (p.enviando) return p.tocada
  if (p.estado && !p.estado.ok) return p.guardada
  return p.tocada
}
