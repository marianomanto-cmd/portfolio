'use client'

import { cambiarPreferencia, usePreferencias, type Nav, type Paleta, type Tema } from '@/components/preferencias'
import { Tarjeta } from '@/components/ui'

function Segmentado<T extends string>({
  nombre,
  valor,
  opciones,
  onCambio,
}: {
  nombre: string
  valor: T
  opciones: { valor: T; etiqueta: string }[]
  onCambio: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={nombre} className="grid w-full auto-cols-fr grid-flow-col gap-1 rounded-xl border border-border bg-surface-2 p-1 sm:w-auto sm:min-w-80">
      {opciones.map((o) => {
        const actual = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={actual}
            onClick={() => onCambio(o.valor)}
            className={`tocable h-9 rounded-lg px-3 text-sm ${actual ? 'bg-surface font-semibold shadow-[var(--shadow)]' : 'text-muted hover:text-text'}`}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

function Fila({ titulo, detalle, children }: { titulo: string; detalle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between md:gap-8">
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium">{titulo}</h3>
        <p className="text-[13px] leading-5 text-muted">{detalle}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function FormularioPreferencias() {
  const p = usePreferencias()
  return (
    <Tarjeta className="p-4 md:p-6" aria-labelledby="pref-titulo">
      <h2 id="pref-titulo" className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        En este dispositivo
      </h2>
      <div className="divide-y divide-border">
        <Fila titulo="Tema" detalle="Claro u oscuro, o el que use tu sistema.">
          <Segmentado<Tema>
            nombre="Tema"
            valor={p.tema}
            onCambio={(v) => cambiarPreferencia('tema', v)}
            opciones={[
              { valor: 'sistema', etiqueta: 'Sistema' },
              { valor: 'claro', etiqueta: 'Claro' },
              { valor: 'oscuro', etiqueta: 'Oscuro' },
            ]}
          />
        </Fila>
        <Fila titulo="Paleta para daltonismo" detalle="Positivo en azul y negativo en naranja, en lugar de verde y rojo. El signo y la flecha siempre están.">
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Segmentado<Paleta>
              nombre="Paleta"
              valor={p.paleta}
              onCambio={(v) => cambiarPreferencia('paleta', v)}
              opciones={[
                { valor: 'normal', etiqueta: 'Verde y rojo' },
                { valor: 'daltonica', etiqueta: 'Azul y naranja' },
              ]}
            />
            <p className="num text-sm" aria-hidden>
              <span className="text-positive">+1,80% ▲</span> <span className="ml-3 text-negative">−0,60% ▼</span>
            </p>
          </div>
        </Fila>
        <Fila titulo="Modo privado" detalle="Oculta los montos y deja los porcentajes, para mirar la app con gente al lado. Atajo: h.">
          <button
            type="button"
            role="switch"
            aria-checked={p.privado}
            aria-label="Modo privado"
            onClick={() => cambiarPreferencia('privado', !p.privado)}
            className={`tocable relative inline-flex h-8 w-14 items-center rounded-full border transition-colors ${p.privado ? 'border-accent bg-accent' : 'border-border-strong bg-surface-3'}`}
          >
            <span className={`inline-block size-6 rounded-full bg-surface shadow transition-transform ${p.privado ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </Fila>
        <Fila titulo="Barra lateral" detalle="En la compu: automática (expandida desde 1280 px), siempre expandida o siempre en íconos.">
          <Segmentado<Nav>
            nombre="Barra lateral"
            valor={p.nav}
            onCambio={(v) => cambiarPreferencia('nav', v)}
            opciones={[
              { valor: 'auto', etiqueta: 'Automática' },
              { valor: 'expandida', etiqueta: 'Expandida' },
              { valor: 'colapsada', etiqueta: 'Íconos' },
            ]}
          />
        </Fila>
      </div>
    </Tarjeta>
  )
}
