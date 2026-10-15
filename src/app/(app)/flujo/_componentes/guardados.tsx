'use client'

// Guardar, abrir, archivar y comparar escenarios (plan §6 D.1; D-148). Un
// escenario guarda sus supuestos, nunca resultados; no se borra: se archiva.
// Comparar: hasta 3, con trazos distintos (no solo color) y solo los supuestos
// que difieren. Sin palabras de valoración.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { diferencias, recordadosDe, resumenHorizonte } from '@/lib/domain/flujo/panel'
import { nombreMes, proyectar } from '@/lib/domain/flujo/proyeccion'
import type { BaseProyeccion, Supuestos } from '@/lib/domain/flujo/tipos'
import type { EscenarioVista } from '@/lib/vistas/contratos-flujo'
import { GraficoFlujo as Grafico } from './grafico-flujo'
import { MontoTrazado } from '@/components/monto'
import { useMedia, usePreferencias } from '@/components/preferencias'
import { guardarEscenarioAccion } from '../acciones'
import { opcionPatrimonio, tablaPatrimonio, TRAZOS, type SeriePatrimonio } from '../_lib/graficos'
import { Cifra } from './resultado'
import { Casilla } from '@/components/escenarios/casilla'

const BOTON = 'tocable inline-flex min-h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium'

export function Guardados({
  base,
  s,
  abierto,
  escenarios,
  onAbrir,
  onGuardado,
}: {
  base: BaseProyeccion
  s: Supuestos
  abierto: { id: number; nombre: string } | null
  escenarios: EscenarioVista[]
  onAbrir: (e: EscenarioVista) => void
  onGuardado: (id: number, nombre: string) => void
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [enviando, iniciar] = useTransition()
  const [comparar, setComparar] = useState<number[]>([])
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('USD')
  const { privado } = usePreferencias()
  const movil = useMedia('(max-width: 767.98px)')
  const activos = useMemo(() => escenarios.filter((e) => !e.archivado), [escenarios])
  const archivados = useMemo(() => escenarios.filter((e) => e.archivado), [escenarios])

  const mandar = (p: Parameters<typeof guardarEscenarioAccion>[0], despues?: (id: number | null) => void) =>
    iniciar(async () => {
      const r = await guardarEscenarioAccion(p)
      setMensaje({ ok: r.ok, texto: r.mensaje })
      if (r.ok) {
        despues?.(r.id)
        router.refresh()
      }
    })

  const elegidos = useMemo(() => activos.filter((e) => comparar.includes(e.id) && e.supuestos), [activos, comparar])
  const proyecciones = useMemo(
    () => elegidos.map((e, i) => ({ e, p: proyectar(base, e.supuestos as Supuestos), trazo: TRAZOS[i] ?? 'solid' })),
    [elegidos, base],
  )
  const series: SeriePatrimonio[] = useMemo(
    () => proyecciones.filter((x) => x.p.estado === 'lista').map((x) => ({ nombre: x.e.nombre, meses: x.p.meses, trazo: x.trazo })),
    [proyecciones],
  )
  const opcion = useMemo(() => opcionPatrimonio(series, moneda, { privado, movil }), [series, moneda, privado, movil])
  const tabla = useMemo(() => tablaPatrimonio(series, moneda, privado), [series, moneda, privado])

  return (
    <section aria-labelledby="titulo-guardados" className="rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow)] md:p-4">
      <h2 id="titulo-guardados" className="text-base font-semibold text-text">
        Tus escenarios
      </h2>
      <p className="mt-0.5 text-xs text-muted">Guardás los supuestos, no los resultados: cada vez se proyectan desde tu última carga.</p>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(ev) => {
          ev.preventDefault()
          const n = nombre.trim() || (abierto ? `Copia de ${abierto.nombre}` : '')
          mandar({ accion: 'guardar', nombre: n, supuestos: s, recordados: recordadosDe(s) }, (id) => {
            if (id) onGuardado(id, n)
            setNombre('')
          })
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="text-muted">Guardar como…</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            placeholder={abierto ? `Copia de ${abierto.nombre}` : 'Ej.: dólar quieto, ingreso igual'}
            className="tocable min-h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-3 text-text"
          />
        </label>
        <button type="submit" disabled={enviando || !(nombre.trim() || abierto)} className={`${BOTON} border-accent bg-accent text-on-accent hover:bg-accent-strong disabled:opacity-60`}>
          {nombre.trim() ? 'Guardar como nuevo' : abierto ? 'Duplicar' : 'Guardar'}
        </button>
        {abierto ? (
          <button
            type="button"
            disabled={enviando}
            className={`${BOTON} border-border bg-surface text-text hover:bg-surface-2`}
            onClick={() => mandar({ accion: 'guardar', id: abierto.id, nombre: abierto.nombre, supuestos: s, recordados: recordadosDe(s) })}
          >
            Guardar cambios en «{abierto.nombre}»
          </button>
        ) : null}
      </form>
      {mensaje ? (
        <p role="status" className={`mt-2 text-sm ${mensaje.ok ? 'text-text' : 'text-negative'}`}>
          {mensaje.texto}
        </p>
      ) : null}

      {activos.length ? (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {activos.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 p-2">
              <Casilla
                className="min-w-0 flex-1"
                marcada={comparar.includes(e.id)}
                deshabilitada={!e.supuestos || (!comparar.includes(e.id) && comparar.length >= 3)}
                onCambio={(v) => setComparar((c) => (v ? [...c, e.id].slice(0, 3) : c.filter((x) => x !== e.id)))}
              >
                <span className="min-w-0 break-words font-medium text-text">{e.nombre}</span>
                {!e.supuestos ? <span className="text-xs text-muted">(de otra versión: no se puede abrir)</span> : null}
              </Casilla>
              <button type="button" disabled={!e.supuestos} className={`${BOTON} border-border bg-surface text-text hover:bg-surface-2`} onClick={() => onAbrir(e)}>
                Abrir
              </button>
              <button type="button" disabled={enviando} className={`${BOTON} border-border bg-surface text-muted hover:text-text`} onClick={() => mandar({ accion: 'archivar', id: e.id })}>
                Archivar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Todavía no guardaste ninguno.</p>
      )}
      {activos.length >= 2 ? <p className="mt-1 text-xs text-muted">Marcá dos o tres para compararlos.</p> : null}

      {archivados.length ? (
        <details className="mt-3">
          <summary className="tocable inline-flex min-h-9 cursor-pointer items-center text-sm text-muted">Archivados ({archivados.length})</summary>
          <ul className="mt-1 space-y-1">
            {archivados.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-muted">{e.nombre}</span>
                <button type="button" disabled={enviando} className={`${BOTON} border-border bg-surface text-text hover:bg-surface-2`} onClick={() => mandar({ accion: 'desarchivar', id: e.id })}>
                  Volver a la lista
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {elegidos.length >= 2 ? (
        <div role="group" className="mt-4 space-y-3 border-t border-border pt-3" aria-label="Comparación">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text">Comparar</h3>
            <div role="group" aria-label="Moneda de la comparación" className="inline-grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
              {(['ARS', 'USD'] as const).map((x) => (
                <button
                  key={x}
                  type="button"
                  aria-pressed={moneda === x}
                  onClick={() => setMoneda(x)}
                  className={`tocable inline-flex min-h-8 items-center justify-center rounded-md px-3 text-sm font-medium ${moneda === x ? 'bg-surface text-text shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
                >
                  {x === 'ARS' ? 'En pesos' : 'En dólares'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {proyecciones.map(({ e, p, trazo }) => {
              const r = resumenHorizonte(p)
              const ult = p.meses[p.meses.length - 1]
              return (
                <div key={e.id} className="min-w-0 rounded-lg border border-border p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium text-text">
                    <svg aria-hidden width="28" height="8" className="shrink-0">
                      <line x1="0" y1="4" x2="28" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray={trazo === 'dashed' ? '6 4' : trazo === 'dotted' ? '2 3' : undefined} />
                    </svg>
                    <span className="min-w-0 truncate">{e.nombre}</span>
                  </p>
                  {p.estado === 'faltan' || !r || !ult ? (
                    <p className="mt-1 text-xs text-muted">Le faltan supuestos: {p.faltan.map((f) => f.variable).join(', ')}.</p>
                  ) : (
                    <dl className="mt-1 space-y-1">
                      <div>
                        <dt className="text-xs text-muted">Excedente acumulado a {nombreMes(ult.mes)}</dt>
                        <dd className="flex flex-wrap gap-x-2">
                          <MontoTrazado calc={r.excedente.ars} moneda="ARS" titulo={`Excedente acumulado · ${e.nombre}`} compacta />
                          <MontoTrazado calc={r.excedente.usd} moneda="USD" titulo={`Excedente acumulado · ${e.nombre}`} compacta />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Financiero a {nombreMes(ult.mes)}</dt>
                        <dd className="flex flex-wrap gap-x-2">
                          <Cifra base={base} s={e.supuestos as Supuestos} m={ult} campo="financiero" moneda="ARS" nombre={`Financiero · ${e.nombre}`} compacta />
                          <Cifra base={base} s={e.supuestos as Supuestos} m={ult} campo="financiero" moneda="USD" nombre={`Financiero · ${e.nombre}`} compacta />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Neto sin la camioneta a {nombreMes(ult.mes)}</dt>
                        <dd className="flex flex-wrap gap-x-2">
                          <Cifra base={base} s={e.supuestos as Supuestos} m={ult} campo="neto_sin_financiados" moneda="ARS" nombre={`Neto sin la camioneta · ${e.nombre}`} compacta />
                          <Cifra base={base} s={e.supuestos as Supuestos} m={ult} campo="neto_sin_financiados" moneda="USD" nombre={`Neto sin la camioneta · ${e.nombre}`} compacta />
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              )
            })}
          </div>
          {series.length >= 2 ? <Grafico opcion={opcion} titulo={`Patrimonio financiero de cada escenario, en ${moneda === 'ARS' ? 'pesos' : 'dólares'}`} tabla={tabla} /> : null}
          <div>
            <p className="text-xs font-medium text-muted">Lo que cambia entre {elegidos.map((e) => e.nombre).join(' · ')}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-text">
              {diferenciasDe(elegidos, base).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function diferenciasDe(es: EscenarioVista[], base: BaseProyeccion): string[] {
  if (es.length < 2 || !es[0].supuestos || !es[1].supuestos) return []
  const a = diferencias(es[0].supuestos, es[1].supuestos, base)
  if (es.length === 3 && es[2].supuestos) {
    const b = diferencias(es[0].supuestos, es[2].supuestos, base).map((x) => `${x} (con ${es[2].nombre})`)
    return [...a, ...b]
  }
  return a.length ? a : ['Tienen los mismos supuestos.']
}
