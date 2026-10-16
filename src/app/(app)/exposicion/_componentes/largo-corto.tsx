import type { CSSProperties } from 'react'
import type { VistaExposicionPantalla } from '@/lib/vistas/contratos-exposicion'
import { MontoTrazado, TextoConMontos } from '@/components/monto'
import { ChipEtiqueta, Rotulo, Tarjeta } from '@/components/ui'
import { largoCorto, type FilaLargoCorto, type TramoDibujo } from '../_lib/largo-corto'
import { tintaSobre } from '../_lib/tinta'

// El gráfico principal de Exposición (handoff, captura 05): barras
// divergentes con el cero compartido. Barras de CSS, como en el diseño: cada
// tramo es un activo (su color, su ticker adentro); las cifras de la derecha
// abren su traza. En el teléfono, el rótulo y las cifras arriba y la barra
// abajo, a todo el ancho.

function estiloTramo(t: TramoDibujo): { clase: string; estilo: CSSProperties } {
  const base: CSSProperties = { flexGrow: t.parte, flexBasis: 0 }
  switch (t.tono) {
    case 'deuda':
      return { clase: 'border border-border-accent bg-accent-soft text-accent-glow', estilo: base }
    case 'corto':
      return { clase: 'bg-accent text-on-accent font-semibold', estilo: base }
    case 'largo':
      return { clase: 'bg-text text-bg font-semibold', estilo: base }
    default:
      // La tinta que se lee sobre ese color (AA): casi negra sobre lo claro, clara sobre lo oscuro.
      return { clase: '', estilo: { ...base, background: t.color, color: tintaSobre(t.color) } }
  }
}

function Barra({ f, cero }: { f: FilaLargoCorto; cero: number }) {
  return (
    <div aria-hidden className="relative h-[22px] md:h-[30px]">
      <div className="absolute -bottom-1.5 -top-1.5 w-px bg-border-strong" style={{ left: `${cero}%` }} />
      {f.barra ? (
        <div className="absolute inset-y-0 flex gap-[2px] overflow-hidden rounded-[5px]" style={{ left: `${f.barra.desde}%`, width: `${f.barra.ancho}%` }}>
          {f.tramos.map((t) => {
            const { clase, estilo } = estiloTramo(t)
            return (
              // El rótulo se ve solo si el tramo tiene lugar (consulta de contenedor): un ticker cortado a la mitad no se lee.
              <div key={t.clave} title={t.nombre} className={`@container flex min-w-[2px] items-center overflow-hidden whitespace-nowrap font-mono text-[10px] uppercase ${clase}`} style={estilo}>
                <span className="hidden truncate px-1.5 @min-[44px]:block">{t.etiqueta}</span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function Cifras({ f }: { f: FilaLargoCorto }) {
  // En sangría solo una cifra que resta; un "sin dato" va en tinta neutra (D-157).
  const negativo = f.valor.ars.valor !== null && (f.menos || f.valor.ars.valor.startsWith('-'))
  const tono = negativo ? 'text-accent-glow' : ''
  return (
    <div className="flex flex-col items-end gap-0.5 text-[13px]">
      <span className="flex items-baseline gap-1">
        {/* El "−" de la deuda, solo delante de una cifra: delante de "sin dato" no resta nada. */}
        {f.menos && f.valor.ars.valor !== null ? <span className={`num ${tono}`}>−</span> : null}
        <MontoTrazado calc={f.valor.ars} moneda="ARS" titulo={`${f.rotulo} · en pesos`} className={tono} />
      </span>
      <span className="flex items-baseline gap-1 text-[12px]">
        {f.menos && f.valor.usd.valor !== null ? <span className="num text-viz-strong">−</span> : null}
        <MontoTrazado calc={f.valor.usd} moneda="USD" titulo={`${f.rotulo} · en dólares`} decimales={0} />
      </span>
    </div>
  )
}

export function LargoCorto({ v }: { v: VistaExposicionPantalla }) {
  const { cero, filas } = largoCorto(v)
  const neto = v.resumen.neto_ars
  return (
    <Tarjeta className="flex flex-col gap-[18px] p-4 md:p-[22px]" aria-labelledby="largo-corto">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Rotulo id="largo-corto">Largo y corto · en pesos de hoy</Rotulo>
        <span aria-hidden className="font-mono text-[11px] text-muted">
          ← CORTO · LARGO →
        </span>
      </div>
      <ul className="flex flex-col gap-4 md:gap-3.5">
        {filas.map((f) => (
          <li key={f.clave} data-fila={f.clave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 md:grid-cols-[160px_minmax(0,1fr)_150px]">
            <span className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] ${f.fuerte ? 'font-semibold text-text' : 'text-muted'}`}>
              {f.rotulo}
              <ChipEtiqueta calc={f.valor.ars} omitir={['parcial']} />
            </span>
            <div className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1">
              <Barra f={f} cero={cero} />
            </div>
            <div className="col-start-2 row-start-1 md:col-start-3">
              <Cifras f={f} />
            </div>
          </li>
        ))}
      </ul>
      {neto.valor === null && neto.motivo ? (
        <p className="text-[13px] text-muted">
          <span className="font-medium text-text">Neto en pesos: sin dato.</span> <TextoConMontos texto={neto.motivo} />
        </p>
      ) : null}
      <p className="max-w-[70ch] text-[13px] text-muted">
        {v.tramos.deudas.length
          ? 'El leasing es deuda en pesos a cuota fija: funciona como una posición corta en pesos. Si el peso se deprecia, esa deuda vale menos dólares.'
          : 'Una deuda en pesos a cuota fija funciona como una posición corta en pesos: cuando cargues la del leasing, se resta acá.'}
        {v.vista === 'total' && v.tramos.bienes.length ? ' Tus bienes no suman ni a los pesos ni a los dólares hasta que les elijas la moneda de riesgo (D-73).' : ''}
      </p>
    </Tarjeta>
  )
}
