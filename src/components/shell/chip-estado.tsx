'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import type { Fuente } from '@/lib/vistas/contratos'
import { IconoFuente, NOMBRE_ESTADO } from '@/components/fuentes'
import { resumenChip } from './estado'

/**
 * El chip de estado de los datos de la barra superior (D-156): una pastilla
 * en mono con el punto (verde: todo al día; oro: algo para revisar), la carga
 * ("CARGA DE HOY · 09:41" o "ÚLTIMA CARGA · 14/10") y el CCL y el cripto con
 * que está la app. Tocarlo abre el estado de cada fuente (✓ ≠ ○ ◷), con
 * links al Registro y a Cargar. En el teléfono dice solo la fecha.
 *
 *   <ChipEstado hoy={v.hoy} fechaDatos={v.fecha_datos} guardadoEn={v.guardado_en} fuentes={v.fuentes} />
 *
 * Lo arma estado-datos.tsx (servidor) con la vista de Hoy; el texto sale de
 * resumenChip (estado.ts, función pura con test).
 */

export interface EstadoChip {
  hoy?: Fecha
  fechaDatos: Fecha | null
  guardadoEn?: string | null
  fuentes: Fuente[]
}

export function ChipEstado({
  hoy,
  fechaDatos,
  guardadoEn = null,
  fuentes,
  variantes,
  problema,
}: {
  hoy?: Fecha
  fechaDatos: Fecha | null
  guardadoEn?: string | null
  fuentes: Fuente[]
  /** Solo en el modo demo: el estado de cada variante (?demo=…). */
  variantes?: Record<string, EstadoChip>
  problema?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const params = useSearchParams()
  const variante = variantes?.[params.get('demo') ?? '']
  const fecha = variante ? variante.fechaDatos : fechaDatos
  const lista = variante ? variante.fuentes : fuentes
  const guardado = variante ? (variante.guardadoEn ?? null) : guardadoEn
  const dia = (variante?.hoy ?? hoy) || fecha || ''

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: Event) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('touchstart', cerrar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('touchstart', cerrar)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  if (problema) {
    return (
      <span className="inline-flex h-9 items-center rounded-full border border-border px-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted max-md:h-11">
        {problema}
      </span>
    )
  }

  const r = resumenChip({ hoy: dia, fechaDatos: fecha, creadoEn: guardado, fuentes: lista })
  const largo = fecha ? `Datos al cierre del ${fechaCorta(fecha)}` : 'Sin cargas todavía'
  const punto = r.punto === 'al_dia' ? 'bg-positive' : 'bg-warn'
  return (
    <div ref={raiz} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={`${r.etiqueta}. Ver el estado de cada fuente`}
        className="tocable inline-flex h-9 max-w-full items-center gap-2 whitespace-nowrap rounded-full border border-border px-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted transition-colors hover:border-border-strong max-md:h-11"
      >
        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${punto}`} />
        <span className="hidden lg:inline">{r.texto}</span>
        <span className="lg:hidden">{r.corto}</span>
        {r.ccl || r.cripto ? (
          <span className="hidden items-center gap-2 xl:inline-flex">
            <span aria-hidden className="text-faint">
              |
            </span>
            {r.ccl ? (
              <span>
                CCL <span className="text-text">{r.ccl}</span>
              </span>
            ) : null}
            {r.cripto ? (
              <span>
                Cripto <span className="text-text">{r.cripto}</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
      {abierto ? (
        // Desde 768 px, anclado al chip. En el teléfono el chip no llega al
        // borde derecho y un panel anclado a él se salía por la izquierda: va
        // fijo debajo de la barra superior, a 16 px de cada borde (D-30).
        // (El header tiene backdrop-filter y es el bloque contenedor de lo
        // fijo: está pegado arriba y ocupa todo el ancho, así que da lo mismo.
        // Por lo mismo el panel no es de vidrio: un desenfoque adentro de otro
        // solo vería la barra, no la página de abajo.)
        <div
          role="dialog"
          aria-label="Estado de las fuentes"
          className="absolute right-0 top-full z-50 mt-2 border border-border bg-surface shadow-[var(--glass-shadow)] w-[min(22rem,calc(100vw-2rem))] rounded-tarjeta p-4 max-md:fixed max-md:inset-x-4 max-md:top-[calc(var(--barra-sup)+0.5rem)] max-md:mt-0 max-md:max-h-[calc(100dvh-var(--barra-sup)-var(--barra-inf)-1.5rem)] max-md:w-auto max-md:overflow-y-auto"
        >
          <p className="rotulo text-[10px]">Estado de los datos</p>
          <p className="mt-1 text-[15px] font-medium">{largo}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            ✓ cargada y al día · ≠ diferencia sin resolver · ○ tipeado, sin control posible · ◷ más de 2 días hábiles sin carga
          </p>
          <ul className="mt-2">
            {lista.map((f) => (
              <li key={f.nombre} className="flex items-start gap-3 border-t border-border py-2">
                <IconoFuente estado={f.estado} />
                <div className="min-w-0">
                  <p className="text-sm">
                    {f.nombre} <span className="text-muted">· {NOMBRE_ESTADO[f.estado]}</span>
                  </p>
                  {f.detalle ? <p className="text-[13px] text-muted">{f.detalle}</p> : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex gap-2 border-t border-border pt-2">
            <Link href="/registro" onClick={() => setAbierto(false)} className="tocable inline-flex items-center rounded-full px-2 text-sm text-muted transition-colors hover:text-text">
              Ver el registro
            </Link>
            <Link href="/carga" onClick={() => setAbierto(false)} className="tocable inline-flex items-center rounded-full px-2 text-sm text-muted transition-colors hover:text-text">
              Cargar
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
