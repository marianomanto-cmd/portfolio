import type { Metadata } from 'next'
import Link from 'next/link'
import { Encabezado } from '@/components/pantalla/encabezado'
import { enfasis, texto } from '@/components/pantalla/lectura'
import { CARGAR, GRUPOS, SECCIONES } from '@/components/shell/secciones'
import { Rotulo, Tarjeta } from '@/components/ui'
import { PALETA_DOLAR, PALETA_PESOS } from '@/lib/domain/colores'

export const metadata: Metadata = { title: 'Mapa de la app' }

// El Mapa de la app (D-156, capturas 11 y 12 del diseño): cómo está ordenado
// el menú, cómo se lee cada pantalla y qué quiere decir cada color. Sale de
// SECCIONES (components/shell/secciones.ts): si cambia el menú, cambia el mapa.

const ANATOMIA = [
  { n: '01', t: 'La pregunta', d: 'Arriba, en mono: qué contesta la pantalla.' },
  { n: '02', t: 'La lectura', d: 'Una frase en serif con la respuesta, armada con tus números. Un solo énfasis.' },
  { n: '03', t: 'Cifras clave', d: 'Hasta cuatro, siempre en pesos y en dólares.' },
  { n: '04', t: 'El gráfico principal', d: 'Uno por pantalla: el que mejor contesta la pregunta.' },
  { n: '05', t: 'El detalle', d: 'Tabla o lista. Toda cifra abre su traza al tocarla.' },
]

const FAMILIAS = `linear-gradient(90deg, ${[...PALETA_DOLAR, ...PALETA_PESOS.slice(0, 1), '#8C8696'].join(', ')})`

const REGLAS = [
  { muestra: 'var(--text)', t: 'Tinta = pesos.', d: 'Los montos en pesos van en tinta, sin pastilla.' },
  { muestra: 'var(--usd-bg)', t: 'Dorado = dólares.', d: 'Los dólares, siempre en la pastilla dorada; lo dolarizado, en la familia dorada.' },
  { muestra: 'var(--accent)', t: 'Sangría = deuda, pérdida y Cargar.', d: 'Siempre con signo: nunca solo el color.' },
  { muestra: 'var(--positive)', t: 'Verde = ganancia.', d: 'Solo en resultados, con "+".' },
  { muestra: FAMILIAS, t: 'Un color por activo,', d: 'el mismo en todos los gráficos.' },
]

export default function PaginaMapa() {
  const principales = GRUPOS.filter((g) => g !== 'Al pie')
  const alPie = SECCIONES.filter((s) => s.grupo === 'Al pie' && s.href !== '/mapa')
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <Encabezado pregunta="Al pie · ¿Dónde está cada cosa?" lectura={[texto('Seis pantallas, '), enfasis('una pregunta'), texto(' cada una.')]} tam="grande" />
        <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted">
          El menú se ordena por la pregunta que querés contestar, no por el tipo de dato. Cargar no es una sección: es una acción fija arriba a la
          derecha (tecla C) y, en el teléfono, el botón del centro de la barra de abajo.
        </p>
      </div>

      <section aria-label="Las pantallas, por pregunta" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {principales.map((g) => (
          <Tarjeta key={g} as="div" className="flex flex-col gap-3 p-[18px]">
            <Rotulo as="h2" className="text-[10px] tracking-[0.18em]">
              {g}
            </Rotulo>
            {SECCIONES.filter((s) => s.grupo === g).map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex flex-col gap-1.5 rounded-item border border-border bg-surface-2 p-3 transition-colors hover:border-border-strong"
              >
                <span className="text-[15px] font-medium text-text">{s.nombre}</span>
                {s.pregunta ? <span className="font-serif text-base italic text-accent-glow">{s.pregunta}</span> : null}
                {s.resumen ? <span className="text-[12px] leading-relaxed text-muted">{s.resumen}</span> : null}
              </Link>
            ))}
          </Tarjeta>
        ))}
        <Tarjeta as="div" className="flex flex-col gap-3 p-[18px]">
          <Rotulo as="h2" className="text-[10px] tracking-[0.18em]">
            Al pie
          </Rotulo>
          {alPie.map((s) => (
            <Link key={s.href} href={s.href} className="flex flex-col gap-1 rounded-item border border-border bg-surface-2 p-3 transition-colors hover:border-border-strong">
              <span className="text-[15px] font-medium text-text">{s.nombre}</span>
              <span className="text-[12px] leading-relaxed text-muted">{s.descripcion}</span>
            </Link>
          ))}
          <Link href={CARGAR.href} className="flex flex-col gap-1 rounded-item border border-border-accent bg-accent-soft p-3 transition-colors hover:border-accent">
            <span className="text-[15px] font-medium text-text">{CARGAR.nombre}</span>
            <span className="text-[12px] leading-relaxed text-muted">{CARGAR.descripcion}: arriba a la derecha, tecla C.</span>
          </Link>
        </Tarjeta>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Tarjeta className="flex flex-col gap-4 p-[22px]" aria-labelledby="mapa-anatomia">
          <Rotulo id="mapa-anatomia">Anatomía de cada pantalla</Rotulo>
          <ol className="flex flex-col gap-2">
            {ANATOMIA.map((a) => (
              <li key={a.n} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1 rounded-item bg-surface-2 px-3 py-2.5 sm:grid-cols-[28px_minmax(0,1fr)_minmax(0,1.3fr)]">
                <span className="font-mono text-[12px] text-accent-glow">{a.n}</span>
                <span className="text-sm font-medium">{a.t}</span>
                <span className="col-start-2 text-[12px] leading-relaxed text-muted sm:col-start-auto">{a.d}</span>
              </li>
            ))}
          </ol>
        </Tarjeta>

        <Tarjeta className="flex flex-col gap-3.5 p-[22px]" aria-labelledby="mapa-colores">
          <Rotulo id="mapa-colores">Reglas de color</Rotulo>
          <ul className="flex flex-col gap-3.5">
            {REGLAS.map((r) => (
              <li key={r.t} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3">
                <span aria-hidden className="h-[22px] rounded-[5px] border border-border" style={{ background: r.muestra }} />
                <span className="text-[13px] leading-relaxed">
                  <strong className="font-medium">{r.t}</strong> <span className="text-muted">{r.d}</span>
                </span>
              </li>
            ))}
          </ul>
          <div aria-hidden className="my-1 h-px bg-border" />
          <Rotulo as="h3">Tipografía</Rotulo>
          <div className="flex flex-col gap-2">
            <span className="font-serif text-[22px]">Newsreader · la lectura del día</span>
            <span className="text-sm">Geist · la interfaz, las etiquetas y el texto</span>
            <span className="num text-sm">JetBrains Mono · toda cifra</span>
          </div>
          <div aria-hidden className="my-1 h-px bg-border" />
          <p className="text-[13px] leading-relaxed text-muted">
            En el teléfono, la barra de abajo: Hoy · Patrimonio · <span className="text-accent-glow">Cargar</span> · Resultados · Más.
          </p>
        </Tarjeta>
      </section>
    </div>
  )
}
