import type { ReactNode } from 'react'
import { Traza } from '@/components/traza'
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

/** Las partes de la lectura: texto, la cifra con su traza (tapada en el modo privado) y el énfasis. */
export function Lectura({ partes }: { partes: readonly ParteLectura[] }) {
  return (
    <>
      {partes.map((p, i) => {
        const contenido = p.calc ? (
          <Traza calc={p.calc} titulo={p.titulo ?? p.texto} moneda={p.moneda}>
            <span className="monto">{p.texto}</span>
          </Traza>
        ) : (
          p.texto
        )
        return p.enfasis ? <em key={i}>{contenido}</em> : <span key={i}>{contenido}</span>
      })}
    </>
  )
}
