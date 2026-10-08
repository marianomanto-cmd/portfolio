'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { fechaCorta } from '@/lib/domain/fechas'
import type { EstadoFuente, Fuente } from '@/lib/vistas/contratos'
import { IconoFuente, NOMBRE_ESTADO } from '@/components/fuentes'

const AL_DIA: EstadoFuente[] = ['ok', 'tipeado']

function resumen(fuentes: Fuente[]): { icono: EstadoFuente; texto: string } {
  const alDia = fuentes.filter((f) => AL_DIA.includes(f.estado)).length
  const peor: EstadoFuente = fuentes.some((f) => f.estado === 'diferencia')
    ? 'diferencia'
    : fuentes.some((f) => f.estado === 'viejo')
      ? 'viejo'
      : fuentes.some((f) => f.estado === 'sin_carga')
        ? 'sin_carga'
        : 'ok'
  return { icono: peor, texto: `${alDia} de ${fuentes.length} fuentes` }
}

export interface EstadoChip {
  fechaDatos: string | null
  fuentes: Fuente[]
}

export function ChipEstado({
  fechaDatos,
  fuentes,
  variantes,
  problema,
}: {
  fechaDatos: string | null
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
      <span className="inline-flex h-9 items-center rounded-full border border-border px-3 text-[13px] text-muted max-md:h-11">
        {problema}
      </span>
    )
  }

  const r = resumen(lista)
  const largo = fecha ? `Datos al cierre del ${fechaCorta(fecha)}` : 'Sin cargas todavía'
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={`${largo} · ${r.texto}. Ver el estado de cada fuente`}
        className="tocable inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-text max-md:h-11"
      >
        <IconoFuente estado={r.icono} />
        <span className="hidden whitespace-nowrap lg:inline">
          {largo} · {r.texto}
        </span>
        <span className="whitespace-nowrap lg:hidden">{fecha ? fechaCorta(fecha) : 'sin datos'}</span>
      </button>
      {abierto ? (
        <div
          role="dialog"
          aria-label="Estado de las fuentes"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-3 shadow-lg"
        >
          <p className="text-sm font-medium">{largo}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            ✓ cargada y al día · ≠ diferencia sin resolver · ○ tipeado, sin control posible · ◷ más de 2 días hábiles sin carga
          </p>
          <ul className="mt-2 divide-y divide-border">
            {lista.map((f) => (
              <li key={f.nombre} className="flex items-start gap-3 py-2">
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
          <div className="mt-2 flex gap-2 border-t border-border pt-2">
            <Link href="/registro" onClick={() => setAbierto(false)} className="tocable inline-flex items-center rounded-lg px-2 text-sm text-accent hover:bg-surface-2">
              Ver el registro
            </Link>
            <Link href="/carga" onClick={() => setAbierto(false)} className="tocable inline-flex items-center rounded-lg px-2 text-sm text-accent hover:bg-surface-2">
              Cargar
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
