'use client'

import { ChevronRight, X } from 'lucide-react'
import { Fragment, useRef } from 'react'
import type { ParteFrase, VistaLeasing } from '@/lib/vistas/contratos-pasivos'
import { MontoTrazado, TextoConMontos } from '@/components/monto'
import { useMedia } from '@/components/preferencias'
import { Traza } from '@/components/traza'

/**
 * La frase de Pasivos: se lee de corrido. Con mouse, cada cifra abre su traza.
 * Con el dedo es texto (una cifra en línea no llega a 44 px sin romper el
 * renglón) y "Ver cada cifra de la frase" abre una hoja con cada una en su
 * fila tocable, en pesos y en dólares (como la frase de Hoy).
 */
export function FrasePasivos({ partes, detalle, titulo }: { partes: ParteFrase[]; detalle: VistaLeasing['frase_detalle']; titulo: string }) {
  // En el servidor se asume dedo (sin botones en línea): así el teléfono no salta al hidratar.
  const grueso = useMedia('(pointer: coarse)', true)
  const hoja = useRef<HTMLDialogElement>(null)
  const cifra = (p: ParteFrase) => <span className={`num whitespace-nowrap font-semibold monto ${p.texto.includes('US$') ? 'usd' : ''}`}>{p.texto}</span>
  return (
    <div>
      <p className="text-[15px] leading-7 text-text md:text-base md:leading-8">
        {partes.map((p, i) => (
          <Fragment key={i}>
            {p.calc && !grueso ? (
              <Traza calc={p.calc} titulo={`${titulo}: ${p.texto}`}>
                {cifra(p)}
              </Traza>
            ) : p.calc ? (
              cifra(p)
            ) : (
              <TextoConMontos texto={p.texto} />
            )}
          </Fragment>
        ))}
      </p>
      {grueso && detalle.length ? (
        <>
          <button
            type="button"
            onClick={() => hoja.current?.showModal()}
            className="tocable -ml-1 mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-medium text-accent pointer-fine:hidden"
          >
            Ver cada cifra de la frase <ChevronRight aria-hidden className="size-4" />
          </button>
          <dialog
            ref={hoja}
            aria-label={`${titulo}: cada cifra de la frase`}
            className="hoja fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85svh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-0 text-text shadow-lg"
            onClick={(e) => {
              if (e.target === e.currentTarget) hoja.current?.close()
            }}
          >
            <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded bg-border-strong" />
              <div className="flex items-start justify-between gap-2">
                <p className="pt-3 text-sm text-muted">Tocá una cifra para ver de dónde sale.</p>
                <button
                  type="button"
                  onClick={() => hoja.current?.close()}
                  aria-label="Cerrar"
                  className="tocable grid size-11 shrink-0 place-items-center rounded-lg text-muted"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              <ul className="mt-1 divide-y divide-border">
                {detalle.map((f) => (
                  <li key={f.etiqueta} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1">
                    <span className="text-sm text-muted">{f.etiqueta}</span>
                    <span className="flex flex-wrap items-center justify-end gap-x-3">
                      <MontoTrazado calc={f.ars} moneda="ARS" titulo={`${f.etiqueta} · en pesos`} />
                      <MontoTrazado calc={f.usd} moneda="USD" titulo={`${f.etiqueta} · en dólares`} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </dialog>
        </>
      ) : null}
    </div>
  )
}
