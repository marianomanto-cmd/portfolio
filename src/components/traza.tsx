'use client'

import { X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NOMBRE_ETIQUETA, type CalcVista, type InsumoVista } from '@/lib/domain/calc'
import { monto, numero, porcentaje } from '@/lib/domain/dinero'
import { decimalesInsumo } from './calculos'

/**
 * Traza (spec, "requisito no negociable"; CO-1; sistema visual D-157). Toda
 * cifra calculada se toca y dice de dónde sale: la fórmula con los valores
 * reales, los insumos (cada uno con su carga y su lugar en la fuente, y su
 * propio cálculo a un toque) y "¿Qué es esto?".
 *
 * Uso:
 *   <Traza calc={v.total.ars} titulo="Patrimonio neto · en pesos" moneda="ARS">
 *     <Monto valor={v.total.ars.valor} moneda="ARS" />
 *   </Traza>
 *   // Una traza armada recién al abrir (la proyección no arma trazas por mes):
 *   <TrazaBase obtener={() => trazaMes(base, mes, 'excedente')} titulo="…">…</TrazaBase>
 * Casi siempre conviene MontoTrazado (components/monto.tsx), que ya trae el
 * "sin dato" y la pastilla del dólar.
 *
 * La cifra lleva el subrayado punteado de las cifras con traza (.trazable). Al
 * tocarla se abre una placa de vidrio: con mouse, fija abajo a la derecha (380
 * px); en el teléfono, una hoja desde abajo. La placa va en un portal (el body,
 * o el <dialog> abierto que contiene la cifra): ninguna tarjeta, celda de la
 * grilla ni contenedor con overflow la recorta. Hay una sola abierta a la vez;
 * Escape, tocar afuera o la × la cierran, y el foco vuelve a la cifra. Las
 * trazas que abrís a propósito muestran la cuenta entera aunque esté el modo
 * privado (manual §10).
 */

export function formatearInsumo(i: InsumoVista): string {
  if (i.valor === null) return 'sin dato'
  switch (i.unidad) {
    // Con sus decimales: un precio de $ 1,124 por VN no se ve como $ 1,12.
    case 'ARS':
      return monto(i.valor, 'ARS', { decimales: decimalesInsumo(i.valor) })
    case 'USD':
      return monto(i.valor, 'USD', { decimales: decimalesInsumo(i.valor) })
    case 'cantidad':
      return numero(i.valor, 4, { min: 0 })
    case 'ratio':
      return numero(i.valor, 6, { min: 0 })
    case 'fraccion':
      return porcentaje(i.valor)
    default:
      return i.valor
  }
}

/** El símbolo de la moneda no se separa de su número al cortar el renglón. */
function sinCorte(f: string): string {
  return f.replace(/(US\$|\$) (?=[\d−-])/g, (_, simbolo: string) => `${simbolo} `)
}

function Insumos({ insumos, nivel }: { insumos: InsumoVista[]; nivel: number }) {
  return (
    <ul className={nivel > 0 ? 'mt-1 border-l border-border pl-3' : 'flex flex-col'}>
      {insumos.map((i, k) => (
        <InsumoItem key={k} insumo={i} nivel={nivel} />
      ))}
    </ul>
  )
}

function InsumoItem({ insumo, nivel }: { insumo: InsumoVista; nivel: number }) {
  const [abierto, setAbierto] = useState(false)
  const tieneDetalle = Boolean(insumo.calc && (insumo.calc.insumos.length || insumo.calc.formula))
  return (
    <li className={`text-[13px] ${nivel === 0 ? 'border-t border-border py-[7px]' : 'py-1'}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 text-muted">{insumo.nombre}</span>
        <span className="num shrink-0 text-right text-text">{formatearInsumo(insumo)}</span>
      </div>
      {insumo.origen || tieneDetalle ? (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          {insumo.origen ? (
            <span className="text-[11px] text-faint">
              carga #{insumo.origen.carga_id}
              {insumo.origen.lugar ? ` · ${insumo.origen.lugar}` : ''}
            </span>
          ) : null}
          {tieneDetalle ? (
            <button
              type="button"
              className="tocable text-[11px] text-muted underline-offset-2 hover:text-text hover:underline"
              onClick={() => setAbierto((a) => !a)}
              aria-expanded={abierto}
            >
              {abierto ? 'ocultar el cálculo' : 'ver cálculo ▸'}
            </button>
          ) : null}
        </div>
      ) : null}
      {abierto && insumo.calc ? (
        <div className="mt-1 border-l border-border pl-3">
          <p className="num break-words text-[11px] text-accent-glow">{sinCorte(insumo.calc.formula)}</p>
          {insumo.calc.insumos.length ? <Insumos insumos={insumo.calc.insumos} nivel={nivel + 1} /> : null}
        </div>
      ) : null}
    </li>
  )
}

/**
 * Lo que dice la placa: rótulo, título, fórmula (o "Sin dato." con el motivo),
 * etiquetas, insumos y "¿Qué es esto?". Sirve sola dentro de otro diálogo
 * (Evolución, al tocar una barra) o dentro de la placa de Traza.
 */
export function PanelTraza({
  calc,
  titulo,
  moneda,
  alCerrar,
  movil = false,
  refCerrar,
}: {
  calc: CalcVista
  titulo: string
  moneda?: 'ARS' | 'USD'
  /** Con alCerrar, la placa trae su ×  (o "Cerrar" en el teléfono). */
  alCerrar?: () => void
  movil?: boolean
  refCerrar?: React.Ref<HTMLButtonElement>
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="rotulo text-[10px]">De dónde sale</span>
          <p className="text-[15px] font-medium leading-snug text-text">{titulo}</p>
        </div>
        {alCerrar && !movil ? (
          <button
            ref={refCerrar}
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="tocable grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>
      {calc.valor === null ? (
        <p className="text-sm text-muted">
          <span className="font-medium text-text">Sin dato.</span> {calc.motivo}
        </p>
      ) : (
        <p className="num break-words text-[12px] leading-relaxed text-accent-glow">
          {sinCorte(calc.formula)}
          {moneda && !calc.formula.includes('=') ? ` = ${monto(calc.valor, moneda, { decimales: 2 })}` : ''}
        </p>
      )}
      {calc.etiquetas.length ? (
        <div className="flex flex-wrap gap-1">
          {calc.etiquetas.map((e) => (
            <span key={e} className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              {NOMBRE_ETIQUETA[e] ?? e}
            </span>
          ))}
        </div>
      ) : null}
      {calc.insumos.length ? <Insumos insumos={calc.insumos} nivel={0} /> : null}
      {calc.explicacion ? (
        <p className="border-t border-border pt-2 text-[12px] leading-relaxed text-muted">
          <span className="font-medium text-text">¿Qué es esto?</span> {calc.explicacion}
        </p>
      ) : null}
      {calc.valor !== null ? (
        <button
          type="button"
          className="tocable self-start text-[11px] text-faint transition-colors hover:text-text"
          onClick={() => navigator.clipboard?.writeText(calc.valor ?? '')}
        >
          Copiar valor exacto
        </button>
      ) : null}
      {alCerrar && movil ? (
        <button
          ref={refCerrar}
          type="button"
          className="tocable w-full rounded-full border border-border-strong py-2 text-sm font-medium text-text"
          onClick={alCerrar}
        >
          Cerrar
        </button>
      ) : null}
    </div>
  )
}

// Una sola placa abierta a la vez: abrir otra cierra la anterior.
let cerrarLaAbierta: (() => void) | null = null

const MOVIL = '(max-width: 767px)'

/**
 * La cifra tocable y su placa. `calc` (ya armada) u `obtener` (se arma al
 * abrir). Ver el comentario de arriba.
 */
export function TrazaBase({
  calc,
  obtener,
  titulo,
  moneda,
  children,
  className = '',
}: {
  calc?: CalcVista
  obtener?: () => CalcVista
  titulo: string
  moneda?: 'ARS' | 'USD'
  children: ReactNode
  className?: string
}) {
  const [abierta, setAbierta] = useState<CalcVista | null>(null)
  const [esMovil, setEsMovil] = useState(false)
  const raiz = useRef<HTMLSpanElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const cerrarBoton = useRef<HTMLButtonElement>(null)
  const id = useId()
  const abierto = abierta !== null
  // Mientras está abierta, si la cifra cambia (otra vista), se ve la de ahora.
  const mostrada = abierto ? (calc ?? abierta) : null

  const cerrar = useCallback((devolverFoco = false) => {
    setAbierta(null)
    if (devolverFoco) boton.current?.focus({ preventScroll: true })
  }, [])

  const abrir = () => {
    cerrarLaAbierta?.()
    setAbierta(calc ?? obtener?.() ?? null)
  }

  useEffect(() => {
    const mq = window.matchMedia(MOVIL)
    const f = () => setEsMovil(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  useEffect(() => {
    if (!abierto) return
    const cerrarEsta = () => setAbierta(null)
    cerrarLaAbierta = cerrarEsta
    // El foco va a la placa (a su ×), sin mover la página.
    cerrarBoton.current?.focus({ preventScroll: true })
    const afuera = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (raiz.current?.contains(t) || panel.current?.contains(t)) return
      setAbierta(null)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      cerrar(true)
    }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('touchstart', afuera)
    document.addEventListener('keydown', esc)
    return () => {
      if (cerrarLaAbierta === cerrarEsta) cerrarLaAbierta = null
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('touchstart', afuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto, cerrar])

  // El portal: el <dialog> abierto que contiene la cifra (si no, lo de afuera quedaría inerte) o el body.
  const destino = abierto ? ((raiz.current?.closest('dialog[open]') as HTMLElement | null) ?? document.body) : null

  return (
    <span ref={raiz} className={`relative inline-flex max-w-full ${className}`}>
      <button
        ref={boton}
        type="button"
        className="trazable tocable inline-flex max-w-full items-center rounded text-left"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => (abierto ? cerrar() : abrir())}
      >
        {children}
      </button>
      {mostrada && destino
        ? createPortal(
            esMovil ? (
              <div
                className="fixed inset-0 z-50 flex items-end bg-black/40"
                role="presentation"
                onClick={(e) => {
                  if (e.target === e.currentTarget) cerrar(true)
                }}
              >
                <div
                  ref={panel}
                  id={id}
                  role="dialog"
                  aria-label={titulo}
                  className="vidrio max-h-[80svh] w-full overflow-y-auto rounded-t-[20px] p-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-left font-sans text-base font-normal normal-case tracking-normal whitespace-normal text-text"
                >
                  <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded bg-border-strong" />
                  <PanelTraza calc={mostrada} titulo={titulo} moneda={moneda} alCerrar={() => cerrar(true)} movil refCerrar={cerrarBoton} />
                </div>
              </div>
            ) : (
              <div
                ref={panel}
                id={id}
                role="dialog"
                aria-label={titulo}
                className="vidrio fixed bottom-6 right-6 z-50 max-h-[min(72vh,560px)] w-[380px] max-w-[calc(100vw-48px)] overflow-y-auto rounded-[14px] p-5 text-left font-sans text-base font-normal normal-case tracking-normal whitespace-normal text-text"
              >
                <PanelTraza calc={mostrada} titulo={titulo} moneda={moneda} alCerrar={() => cerrar(true)} refCerrar={cerrarBoton} />
              </div>
            ),
            destino,
          )
        : null}
    </span>
  )
}

/** Una cifra ya calculada con su traza. */
export function Traza({ calc, titulo, moneda, children, className }: { calc: CalcVista; titulo: string; moneda?: 'ARS' | 'USD'; children: ReactNode; className?: string }) {
  return (
    <TrazaBase calc={calc} titulo={titulo} moneda={moneda} className={className}>
      {children}
    </TrazaBase>
  )
}
