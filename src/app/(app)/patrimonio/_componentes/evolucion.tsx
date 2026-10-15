'use client'

import { useMemo, useState } from 'react'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Moneda } from '@/lib/domain/tipos'
import type { PuntoBalance } from '@/lib/vistas/contratos-balance'
import { Grafico } from '@/components/graficos/grafico'
import { useMedia, usePreferencias } from '@/components/preferencias'
import { Rotulo, Tarjeta } from '@/components/ui'
import { leyendaEvolucion, opcionEvolucion, tablaEvolucion, type ItemLeyenda } from '../_lib/graficos'

// La evolución del balance: el activo por clase, apilado, y el patrimonio
// neto, un punto por fecha de carga. Pesos o dólares (dos monedas no
// comparten un eje). El gráfico lo dibuja el envoltorio compartido; la
// leyenda va en HTML, debajo, para que se lea entera en cualquier ancho.

function Muestra({ i }: { i: ItemLeyenda }) {
  if (i.forma === 'area') return <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: i.color ?? undefined }} />
  const dash = i.forma === 'rayada' ? '6 4' : i.forma === 'punteada' ? '1.5 3' : undefined
  return (
    <svg aria-hidden width="22" height="8" viewBox="0 0 22 8" className="shrink-0 text-text">
      <line x1="1" y1="4" x2="21" y2="4" stroke="currentColor" strokeWidth={i.forma === 'punteada' ? 2 : 3} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  )
}

export function Evolucion({ serie, rotuloFirme }: { serie: PuntoBalance[]; rotuloFirme: string | null }) {
  const [moneda, setMoneda] = useState<Moneda>('ARS')
  const { privado, tema } = usePreferencias()
  const sistemaOscuro = useMedia('(prefers-color-scheme: dark)')
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && sistemaOscuro)
  const opcion = useMemo(() => opcionEvolucion(serie, { moneda, privado, oscuro, rotuloFirme }), [serie, moneda, privado, oscuro, rotuloFirme])
  const tabla = useMemo(() => tablaEvolucion(serie, { moneda, privado, rotuloFirme }), [serie, moneda, privado, rotuloFirme])
  const leyenda = useMemo(() => leyendaEvolucion(serie, rotuloFirme), [serie, rotuloFirme])
  const opciones: { m: Moneda; nombre: string }[] = [
    { m: 'ARS', nombre: 'En pesos' },
    { m: 'USD', nombre: 'En dólares' },
  ]
  return (
    <Tarjeta className="p-4 md:p-5 print:hidden" aria-labelledby="evolucion-balance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Rotulo as="h2">
          <span id="evolucion-balance">Evolución del balance</span>
        </Rotulo>
        <div role="group" aria-label="Moneda del gráfico" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1">
          {opciones.map((o) => (
            <button
              key={o.m}
              type="button"
              aria-pressed={moneda === o.m}
              onClick={() => setMoneda(o.m)}
              className={`tocable min-h-8 rounded-lg px-3 text-sm max-md:min-h-11 ${moneda === o.m ? 'bg-surface font-semibold shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
            >
              {o.nombre}
            </button>
          ))}
        </div>
      </div>
      {serie.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          <span className="italic">sin dato</span> · aparece con tu primera carga.
        </p>
      ) : (
        <>
          {serie.length === 1 ? (
            <p className="mt-2 text-sm text-muted">Con tu próxima carga empieza la curva: por ahora es un punto, el {fechaCorta(serie[0].fecha)}.</p>
          ) : null}
          {/* relative + overflow-hidden: la tabla accesible del gráfico (sr-only) no agranda la página. */}
          <div className="relative mt-2 min-w-0 overflow-hidden">
            <Grafico
              opcion={opcion}
              alto={{ movil: 240, escritorio: 320 }}
              titulo={`Evolución del balance ${moneda === 'ARS' ? 'en pesos' : 'en dólares'}: el activo por clase y el patrimonio neto, por fecha de carga`}
              tabla={tabla}
            />
          </div>
          <ul aria-label="Referencias del gráfico" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            {leyenda.map((i) => (
              <li key={i.nombre} className="flex items-center gap-1.5">
                <Muestra i={i} />
                {i.nombre}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted">Un punto por fecha de carga: entre cargas no se inventa nada, y un dato que falta deja un hueco.</p>
        </>
      )}
    </Tarjeta>
  )
}
