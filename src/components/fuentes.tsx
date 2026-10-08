import type { EstadoFuente } from '@/lib/vistas/contratos'

// Estado de una fuente (HO-4, visión §4.0): tinta neutra o azul, nunca verde ni
// rojo. ✓ cerró su control · ≠ diferencia sin resolver · ○ tipeado, sin control
// posible · ◷ más de 2 días hábiles sin carga.

export const SIMBOLO_ESTADO: Record<EstadoFuente, string> = {
  ok: '✓',
  diferencia: '≠',
  tipeado: '○',
  viejo: '◷',
  sin_carga: '–',
}

export const NOMBRE_ESTADO: Record<EstadoFuente, string> = {
  ok: 'cerró su control',
  diferencia: 'diferencia sin resolver',
  tipeado: 'tipeado, sin control posible',
  viejo: 'más de 2 días hábiles sin carga',
  sin_carga: 'sin carga',
}

export function IconoFuente({ estado }: { estado: EstadoFuente }) {
  const tono = estado === 'ok' || estado === 'diferencia' ? 'text-accent' : 'text-muted'
  return (
    <span
      role="img"
      aria-label={NOMBRE_ESTADO[estado]}
      className={`inline-grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold leading-none ${tono}`}
    >
      {SIMBOLO_ESTADO[estado]}
    </span>
  )
}
