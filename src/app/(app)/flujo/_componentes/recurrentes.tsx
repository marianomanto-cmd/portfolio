'use client'

// Tus ingresos y gastos declarados (plan §6 D.1 bloque 4; D-147): cada fila con
// su vigencia. "Cambia desde…" cierra la fila el día anterior y abre otra en
// una transacción (así se carga el cambio de feb-2027 cuando sepas el monto;
// mientras tanto es un tramo del escenario). Un error se anula, no se borra.

import { useId, useState } from 'react'
import { fechaCorta } from '@/lib/domain/fechas'
import type { FilaRecurrente } from '@/lib/vistas/contratos-flujo'
import { Chip, ParMonto } from '@/components/ui'
import { guardarRecurrenteAccion } from '../acciones'
import { CAMPO, Campo, FormAccion } from './form-accion'

const NATURALEZA: Record<string, string> = { sueldo: 'sueldo', honorarios: 'honorarios', dividendo: 'dividendo', retiro_a_cuenta: 'retiro a cuenta', otro: 'otro' }
const FRECUENCIAS = ['mensual', 'bimestral', 'trimestral', 'semestral', 'anual'] as const
const BOTON = 'tocable inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-2'

type Abierto = { id: number; que: 'cambiar' | 'cerrar' | 'anular' } | null

function Fila({ f, hoy, abierto, onAbrir }: { f: FilaRecurrente; hoy: string; abierto: Abierto; onAbrir: (a: Abierto) => void }) {
  const id = useId()
  const esta = abierto?.id === f.id ? abierto.que : null
  return (
    <li className="p-3" data-recurrente={f.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">
            {f.concepto}{' '}
            <span className="font-normal text-muted">
              · {f.sentido === 'ingreso' ? 'ingreso' : 'gasto'} {f.frecuencia !== 'mensual' ? f.frecuencia : 'mensual'}
              {f.naturaleza ? ` · ${NATURALEZA[f.naturaleza] ?? f.naturaleza}` : ''}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Desde el {fechaCorta(f.desde)}
            {f.hasta ? ` hasta el ${fechaCorta(f.hasta)}` : ''}
            {f.primer_mes && f.frecuencia !== 'mensual' ? ` · primer mes ${f.primer_mes.slice(5, 7)}/${f.primer_mes.slice(0, 4)}` : ''}
            {f.pagador === 'empresa' ? ' · lo paga la empresa' : ''}
          </p>
          <div className="mt-1 text-sm">
            <ParMonto par={f.valor} titulo={f.concepto} />
          </div>
          {!f.vigente ? (
            <p className="mt-1">
              <Chip>ya no vale</Chip>
            </p>
          ) : null}
        </div>
        {f.vigente ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Cambiar ${f.concepto}`}>
            <button type="button" className={BOTON} aria-expanded={esta === 'cambiar'} aria-controls={`${id}-f`} onClick={() => onAbrir(esta === 'cambiar' ? null : { id: f.id, que: 'cambiar' })}>
              Cambia desde…
            </button>
            <button type="button" className={BOTON} aria-expanded={esta === 'cerrar'} aria-controls={`${id}-f`} onClick={() => onAbrir(esta === 'cerrar' ? null : { id: f.id, que: 'cerrar' })}>
              Termina…
            </button>
            <button type="button" className={BOTON} aria-expanded={esta === 'anular'} aria-controls={`${id}-f`} onClick={() => onAbrir(esta === 'anular' ? null : { id: f.id, que: 'anular' })}>
              Anular
            </button>
          </div>
        ) : null}
      </div>
      {esta ? (
        <div id={`${id}-f`} className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
          {esta === 'cambiar' ? (
            <FormAccion accion={guardarRecurrenteAccion} boton="Guardar el cambio" ocultos={{ accion: 'cambiar_desde', sentido: f.sentido, id: String(f.id) }}>
              {(e) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo etiqueta={`Monto nuevo (${f.moneda === 'USD' ? 'US$' : '$'})`} htmlFor={`${id}-monto`} error={e.monto}>
                    <input id={`${id}-monto`} name="monto" inputMode="decimal" autoComplete="off" className={CAMPO} />
                  </Campo>
                  <Campo etiqueta="Desde" htmlFor={`${id}-desde`} error={e.desde}>
                    <input id={`${id}-desde`} name="desde" type="date" defaultValue={hoy} min={f.desde} className={CAMPO} />
                  </Campo>
                </div>
              )}
            </FormAccion>
          ) : esta === 'cerrar' ? (
            <FormAccion accion={guardarRecurrenteAccion} boton="Guardar hasta cuándo" ocultos={{ accion: 'cerrar', sentido: f.sentido, id: String(f.id) }}>
              {(e) => (
                <Campo etiqueta="Vale hasta (inclusive)" htmlFor={`${id}-hasta`} error={e.hasta}>
                  <input id={`${id}-hasta`} name="hasta" type="date" defaultValue={hoy} min={f.desde} className={CAMPO} />
                </Campo>
              )}
            </FormAccion>
          ) : (
            <FormAccion accion={guardarRecurrenteAccion} boton="Sí, anular" ocultos={{ accion: 'anular', sentido: f.sentido, id: String(f.id) }}>
              {() => <p className="text-sm text-muted">Anular es para un error: deja de contar desde siempre y queda en la auditoría. Si dejó de valer, usá «Termina…».</p>}
            </FormAccion>
          )}
        </div>
      ) : null}
    </li>
  )
}

function Alta({ hoy }: { hoy: string }) {
  const id = useId()
  const [sentido, setSentido] = useState<'ingreso' | 'gasto'>('ingreso')
  const [frecuencia, setFrecuencia] = useState<string>('mensual')
  return (
    <FormAccion accion={guardarRecurrenteAccion} boton={sentido === 'ingreso' ? 'Declarar el ingreso' : 'Declarar el gasto'} ocultos={{ accion: 'alta', sentido }}>
      {(e) => (
        <>
          <div role="group" aria-label="Ingreso o gasto" className="inline-grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
            {(['ingreso', 'gasto'] as const).map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={sentido === x}
                onClick={() => setSentido(x)}
                className={`tocable inline-flex min-h-8 items-center justify-center rounded-md px-3 text-sm font-medium ${sentido === x ? 'bg-surface text-text shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
              >
                {x === 'ingreso' ? 'Ingreso' : 'Gasto'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Concepto" htmlFor={`${id}-concepto`} error={e.concepto}>
              <input id={`${id}-concepto`} name="concepto" maxLength={80} autoComplete="off" placeholder={sentido === 'ingreso' ? 'Ej.: honorarios del exterior' : 'Ej.: gastos de la casa'} className={CAMPO} />
            </Campo>
            <Campo etiqueta="Moneda" htmlFor={`${id}-moneda`} error={e.moneda}>
              <select id={`${id}-moneda`} name="moneda" defaultValue="" className={CAMPO}>
                <option value="" disabled>
                  Elegí
                </option>
                <option value="USD">US$</option>
                <option value="ARS">$</option>
              </select>
            </Campo>
            <Campo etiqueta="Monto por vez" htmlFor={`${id}-monto`} error={e.monto}>
              <input id={`${id}-monto`} name="monto" inputMode="decimal" autoComplete="off" className={CAMPO} />
            </Campo>
            <Campo etiqueta="Desde" htmlFor={`${id}-desde`} error={e.desde}>
              <input id={`${id}-desde`} name="desde" type="date" defaultValue={`${hoy.slice(0, 7)}-01`} className={CAMPO} />
            </Campo>
            {sentido === 'gasto' ? (
              <>
                <Campo etiqueta="Cada cuánto" htmlFor={`${id}-frecuencia`} error={e.frecuencia}>
                  <select id={`${id}-frecuencia`} name="frecuencia" value={frecuencia} onChange={(ev) => setFrecuencia(ev.target.value)} className={CAMPO}>
                    {FRECUENCIAS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Campo>
                {frecuencia !== 'mensual' ? (
                  <Campo etiqueta="Primer mes en que se paga" htmlFor={`${id}-primer`} error={e.primer_mes}>
                    <input id={`${id}-primer`} name="primer_mes" type="month" defaultValue={hoy.slice(0, 7)} className={CAMPO} />
                  </Campo>
                ) : null}
              </>
            ) : (
              <Campo etiqueta="Qué es (opcional)" htmlFor={`${id}-naturaleza`} error={e.naturaleza}>
                <select id={`${id}-naturaleza`} name="naturaleza" defaultValue="" className={CAMPO}>
                  <option value="">Sin decir</option>
                  {Object.entries(NATURALEZA).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
        </>
      )}
    </FormAccion>
  )
}

export function Recurrentes({ filas, hoy }: { filas: FilaRecurrente[]; hoy: string }) {
  const [abierto, setAbierto] = useState<Abierto>(null)
  const [alta, setAlta] = useState(false)
  const vigentes = filas.filter((f) => f.vigente)
  const viejas = filas.filter((f) => !f.vigente)
  return (
    <div className="space-y-3">
      {vigentes.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {vigentes.map((f) => (
            <Fila key={f.id} f={f} hoy={hoy} abierto={abierto} onAbrir={setAbierto} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Todavía no declaraste ingresos ni gastos: sin ellos, tu excedente es sin dato.</p>
      )}
      {viejas.length ? (
        <details>
          <summary className="tocable inline-flex min-h-9 cursor-pointer items-center text-sm text-muted">Los que ya no valen ({viejas.length})</summary>
          <ul className="mt-1 divide-y divide-border rounded-lg border border-border">
            {viejas.map((f) => (
              <Fila key={f.id} f={f} hoy={hoy} abierto={abierto} onAbrir={setAbierto} />
            ))}
          </ul>
        </details>
      ) : null}
      {alta ? (
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <Alta hoy={hoy} />
        </div>
      ) : (
        <button type="button" className={BOTON} onClick={() => setAlta(true)}>
          Declarar un ingreso o un gasto
        </button>
      )}
    </div>
  )
}
