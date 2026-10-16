import type { ReactNode } from 'react'
import { Traza, TrazaBase } from '@/components/traza'
import type { ParteLectura } from './lectura'

/**
 * Encabezado de una pantalla (D-157, anatomía 1 y 2): la pregunta que contesta
 * (eyebrow en mono, con el punto sangría) y la lectura (Newsreader, un solo
 * énfasis en itálica sangría). La lectura la arma una función pura de la
 * pantalla con texto(), enfasis() y cifra() de ./lectura (con test y
 * validarLectura); cada cifra abre su traza y el modo privado la tapa.
 *
 *   <Encabezado
 *     pregunta="Patrimonio · ¿Cómo le va a cada cosa?"
 *     lectura={lecturaPosiciones(v)}
 *     ayuda="Tocá cualquier cifra para ver de dónde sale."
 *     tam="grande"                  // 44 px (Hoy y el Mapa); por defecto 40 px
 *     acciones={<SelectorPeriodo />} // a la derecha (Evolución: el período)
 *   />
 *
 * La lectura es el h1 de la pantalla (cada pantalla tiene uno solo). En el
 * teléfono baja a 28–30 px. En Hoy, la pregunta lleva la fecha: "Jueves 15 de
 * octubre · ¿Cómo estoy hoy?".
 */
export function Encabezado({
  pregunta,
  lectura,
  ayuda,
  tam = 'normal',
  acciones,
  className = '',
  id,
}: {
  pregunta: string
  lectura: readonly ParteLectura[]
  ayuda?: ReactNode
  tam?: 'normal' | 'grande'
  acciones?: ReactNode
  className?: string
  id?: string
}) {
  const medida = tam === 'grande' ? 'text-[clamp(30px,7vw,44px)] max-w-[24ch]' : 'text-[clamp(28px,6.4vw,40px)] max-w-[26ch]'
  return (
    <header className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${className}`}>
      <div className="flex min-w-0 flex-col gap-[14px]">
        <p className="eyebrow">{pregunta}</p>
        <h1 id={id} className={`lectura m-0 ${medida}`}>
          <Lectura partes={lectura} />
        </h1>
        {ayuda ? <p className="text-[13px] text-muted">{ayuda}</p> : null}
      </div>
      {acciones ? <div className="shrink-0">{acciones}</div> : null}
    </header>
  )
}

/** La puntuación que sigue a una cifra ("$ 2.916.600." o "US$ 87.587,"): va pegada a ella, nunca sola al principio del renglón. */
const PUNTUACION = /^[.,;:…)]+/

/** Las partes de la lectura: texto, la cifra con su traza (tapada en el modo privado) y el énfasis. */
export function Lectura({ partes }: { partes: readonly ParteLectura[] }) {
  return (
    <>
      {partes.map((p, i) => {
        const anterior = partes[i - 1]
        // La puntuación que ya se pegó a la cifra de antes no se repite.
        const quitada = anterior && (anterior.calc || anterior.obtener) && !p.calc && !p.obtener ? (PUNTUACION.exec(p.texto)?.[0] ?? '') : ''
        const siguiente = partes[i + 1]
        const pegada = (p.calc || p.obtener) && siguiente && !siguiente.calc && !siguiente.obtener ? (PUNTUACION.exec(siguiente.texto)?.[0] ?? '') : ''
        const cifra = p.calc ? (
          <Traza calc={p.calc} titulo={p.titulo ?? p.texto} moneda={p.moneda}>
            <span className="monto">{p.texto}</span>
          </Traza>
        ) : p.obtener ? (
          <TrazaBase obtener={p.obtener} titulo={p.titulo ?? p.texto} moneda={p.moneda}>
            <span className="monto">{p.texto}</span>
          </TrazaBase>
        ) : null
        if (cifra && pegada) {
          // La cifra y su puntuación, en un solo renglón (la puntuación, sin el énfasis).
          return (
            <span key={i} className="whitespace-nowrap">
              {p.enfasis ? <em>{cifra}</em> : cifra}
              {pegada}
            </span>
          )
        }
        const contenido = cifra ?? p.texto.slice(quitada.length)
        if (contenido === '') return null
        return p.enfasis ? <em key={i}>{contenido}</em> : <span key={i}>{contenido}</span>
      })}
    </>
  )
}
