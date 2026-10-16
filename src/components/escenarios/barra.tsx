'use client'

import { Minus, Plus } from 'lucide-react'
import { fraccionBarra } from '@/lib/domain/flujo/panel'
import './barra.css'

// La barra de un supuesto (D-164; el dueño, el 15/10: «seleccionar los
// valores de las variables con barras»): un input range nativo (flechas del
// teclado, Inicio y Fin, el dedo y el lector de pantalla con su
// aria-valuetext), − y + de a un paso a los costados y, debajo, sus extremos
// y la marca de Igual en palabras. El riel, la marca de Igual (el 0) y el
// tramo pintado desde Igual hasta el pulgar se dibujan acá; el pulgar lo pone
// el input (barra.css), con el mismo recorrido: su centro va de 11 px a
// (ancho − 11 px). Las cuentas (el paso, el tope, el redondeo, dónde cae cada
// posición) están en panel.ts, con test: este componente solo dibuja.

const BOTON_PASO =
  'tocable inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong text-text transition-colors hover:border-text disabled:cursor-not-allowed disabled:opacity-40'

export interface PropsBarra {
  /** El nombre accesible de la barra ("Devaluación (CCL)"). */
  nombre: string
  min: number
  max: number
  paso: number
  /** La posición, como texto decimal; null = sin elegir (el pulgar, hueco, en el 0 o en el mínimo). */
  posicion: string | null
  /** La posición en palabras, para el lector de pantalla: "Sube +2,0 %/mes". */
  texto: string
  /** Marca el 0 como Igual: una barra de Baja a Sube. */
  conIgual?: boolean
  /** Los extremos, en palabras cortas, debajo de la barra ("Baja −15", "Sube +15"). */
  extremos?: [string, string]
  /** Los nombres de − y + ("Devaluación (CCL): 0,1 menos"). */
  etiquetas: { menos: string; mas: string }
  onPosicion: (texto: string) => void
  onMenos: () => void
  onMas: () => void
}

export function Barra({ nombre, min, max, paso, posicion, texto, conIgual = false, extremos, etiquetas, onPosicion, onMenos, onMas }: PropsBarra) {
  const valor = posicion ?? (conIgual ? '0' : String(min))
  const f = fraccionBarra(valor, min, max)
  const fi = conIgual ? fraccionBarra('0', min, max) : 0
  const desde = Math.min(f, fi)
  const hasta = Math.max(f, fi)
  const enMin = Number(valor) <= min
  const enMax = Number(valor) >= max
  // La marca de Igual, en el mismo recorrido que el pulgar (de 11 px a ancho − 11 px).
  const enRiel = (x: number) => `calc(11px + (100% - 22px) * ${x})`
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2">
      <button type="button" className={BOTON_PASO} aria-label={etiquetas.menos} disabled={enMin} onClick={onMenos}>
        <Minus aria-hidden className="size-4" />
      </button>
      <div className="relative h-11 min-w-0">
        <div aria-hidden className="pointer-events-none absolute inset-x-[11px] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3">
          {posicion !== null && hasta > desde ? <div className="absolute inset-y-0 rounded-full bg-text/70" style={{ left: `${desde * 100}%`, width: `${(hasta - desde) * 100}%` }} /> : null}
        </div>
        {conIgual ? <div aria-hidden className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted" style={{ left: enRiel(fi) }} /> : null}
        <input
          type="range"
          className="barra tocable absolute inset-0 h-full w-full"
          min={min}
          max={max}
          step={paso}
          value={valor}
          aria-label={nombre}
          aria-valuetext={texto}
          data-vacia={posicion === null ? '' : undefined}
          onChange={(e) => onPosicion(e.target.value)}
        />
      </div>
      <button type="button" className={BOTON_PASO} aria-label={etiquetas.mas} disabled={enMax} onClick={onMas}>
        <Plus aria-hidden className="size-4" />
      </button>
      {extremos ? (
        <div aria-hidden className="relative col-start-2 -mt-1 h-4 font-mono text-[10px] uppercase leading-4 tracking-[0.08em] text-muted">
          <span className="absolute left-0">{extremos[0]}</span>
          {conIgual && fi > 0.35 && fi < 0.65 ? (
            <span className="absolute -translate-x-1/2" style={{ left: enRiel(fi) }}>
              Igual
            </span>
          ) : null}
          <span className="absolute right-0">{extremos[1]}</span>
        </div>
      ) : null}
    </div>
  )
}
