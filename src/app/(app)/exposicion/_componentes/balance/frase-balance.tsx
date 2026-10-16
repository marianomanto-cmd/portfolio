'use client'

// La frase de arriba del balance (D-133), dentro de Exposición desde el
// rediseño (D-156). Es la misma pieza que la frase de Hoy de la entrega 4
// (components/hoy/frase.tsx), copiada acá para que el balance no dependa de
// cómo se rediseñe Hoy: misma lectura de corrido, misma hoja del teléfono.

import { ChevronRight, X } from 'lucide-react'
import { Fragment, useRef, type ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { TextoConMontos } from '@/components/monto'
import { useMedia } from '@/components/preferencias'
import { Traza } from '@/components/traza'

export interface ParteMostrada {
  texto: string
  calc: CalcVista | null
  /** Para colorear: 'pos' | 'neg' | null (solo resultados). */
  tono: 'pos' | 'neg' | null
  /** Es un monto (se oculta en modo privado) o un porcentaje (no). */
  esMonto: boolean
  titulo: string
}

export interface FilaDetalle {
  etiqueta: string
  ars: ParteMostrada | null
  usd: ParteMostrada | null
}

function Texto({ p }: { p: ParteMostrada }) {
  const tono = p.tono === 'pos' ? 'text-positive' : p.tono === 'neg' ? 'text-negative' : ''
  const usd = p.texto.includes('US$')
  return (
    <span className={`num whitespace-nowrap font-medium ${tono} ${p.esMonto ? 'monto' : ''} ${usd && p.esMonto ? 'usd' : ''}`}>{p.texto}</span>
  )
}

/**
 * La puntuación que rodea a una cifra va pegada a ella ("(US$ 4.200)."): la
 * cifra es un botón (inline-block) y un "(" o un punto, solos, quedaban en
 * otro renglón. Devuelve cada parte con lo que se le pega antes y después, y se
 * lo saca a la parte de al lado.
 */
function pegarPuntuacion(partes: readonly ParteMostrada[]): { p: ParteMostrada; antes: string; pegado: string }[] {
  const out = partes.map((p) => ({ p, antes: '', pegado: '' }))
  for (let i = 0; i + 1 < out.length; i++) {
    const act = out[i].p
    const sig = out[i + 1].p
    if (!act.calc && sig.calc) {
      // "… (" antes de una cifra: el paréntesis va con la cifra.
      const m = /\(+$/.exec(act.texto)
      if (!m) continue
      out[i] = { ...out[i], p: { ...act, texto: act.texto.slice(0, -m[0].length) } }
      out[i + 1] = { ...out[i + 1], antes: m[0] }
      continue
    }
    if (!act.calc || sig.calc) continue
    const m = /^[.,;:)]+/.exec(sig.texto)
    if (!m) continue
    out[i] = { ...out[i], pegado: m[0] }
    out[i + 1] = { ...out[i + 1], p: { ...sig, texto: sig.texto.slice(m[0].length) } }
  }
  return out
}

/** Una parte y su puntuación pegada, sin corte de renglón entre ellas. */
function Pegada({ antes = '', pegado, children }: { antes?: string; pegado: string; children: ReactNode }) {
  return antes || pegado ? (
    <span className="whitespace-nowrap">
      {antes}
      {children}
      {pegado}
    </span>
  ) : (
    <>{children}</>
  )
}

/**
 * La frase del balance: se lee de corrido y, con mouse, cada cifra abre su
 * traza. Con el dedo, la frase es texto (los números en línea no llegan a
 * 44 px sin romper el renglón) y "Ver la frase completa y cada cifra" abre una
 * hoja con cada cifra en su propia fila tocable.
 */
export function FraseBalance({ partes, detalle, recortar = false }: { partes: ParteMostrada[]; detalle: FilaDetalle[]; recortar?: boolean }) {
  // En el servidor se asume dedo (sin botones en línea): así el teléfono no salta al hidratar.
  const grueso = useMedia('(pointer: coarse)', true)
  const hoja = useRef<HTMLDialogElement>(null)

  const piezas = pegarPuntuacion(partes)
  const cuerpo = piezas.map(({ p, antes, pegado }, i) => (
    <Fragment key={i}>
      <Pegada antes={antes} pegado={pegado}>
        {p.calc && !grueso ? (
          <Traza calc={p.calc} titulo={p.titulo}>
            <Texto p={p} />
          </Traza>
        ) : p.calc ? (
          <Texto p={p} />
        ) : p.texto ? (
          // Un pedazo sin traza puede traer un monto: igual se oculta en modo privado.
          <span>
            <TextoConMontos texto={p.texto} />
          </span>
        ) : null}
      </Pegada>
    </Fragment>
  ))

  // Se recorta solo con el dedo, que es cuando está el botón que la abre
  // entera. Con mouse en una ventana angosta se lee entera, con cada cifra
  // tocable en el lugar.
  return (
    <div>
      <p className={`text-[15px] leading-7 md:text-base md:leading-8 ${recortar ? 'max-md:pointer-coarse:line-clamp-3 max-md:pointer-coarse:leading-6' : ''}`}>{cuerpo}</p>
      {grueso ? (
        <>
          <button
            type="button"
            onClick={() => hoja.current?.showModal()}
            className="tocable -ml-1 mt-1 inline-flex items-center gap-1 rounded-lg px-1 text-sm font-medium text-accent pointer-fine:hidden"
          >
            Ver la frase completa y cada cifra <ChevronRight aria-hidden className="size-4" />
          </button>
          <dialog
            ref={hoja}
            aria-label="La frase del balance, cifra por cifra"
            className="hoja fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85svh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-0 text-text shadow-lg"
            onClick={(e) => {
              if (e.target === e.currentTarget) hoja.current?.close()
            }}
          >
            <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded bg-border-strong" />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] leading-6">
                  {piezas.map(({ p, antes, pegado }, i) => (
                    <Fragment key={i}>
                      <Pegada antes={antes} pegado={pegado}>
                        {p.calc ? (
                          <Texto p={p} />
                        ) : p.texto ? (
                          <span>
                            <TextoConMontos texto={p.texto} />
                          </span>
                        ) : null}
                      </Pegada>
                    </Fragment>
                  ))}
                </p>
                <button
                  type="button"
                  onClick={() => hoja.current?.close()}
                  aria-label="Cerrar"
                  className="tocable grid size-11 shrink-0 place-items-center rounded-lg text-muted"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              <p className="mt-3 text-[13px] text-muted">Tocá una cifra para ver de dónde sale.</p>
              <ul className="mt-1 divide-y divide-border">
                {detalle.map((f) => (
                  <li key={f.etiqueta} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-sm text-muted">{f.etiqueta}</span>
                    <span className="flex flex-wrap items-center justify-end gap-x-3">
                      {f.ars?.calc ? (
                        <Traza calc={f.ars.calc} titulo={f.ars.titulo}>
                          <Texto p={f.ars} />
                        </Traza>
                      ) : null}
                      {f.usd?.calc ? (
                        <Traza calc={f.usd.calc} titulo={f.usd.titulo}>
                          <Texto p={f.usd} />
                        </Traza>
                      ) : null}
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
