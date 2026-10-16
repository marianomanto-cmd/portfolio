import { porcentaje } from '@/lib/domain/dinero'
import type { Segmento } from '@/lib/vistas/contratos'
import type { VistaExposicionPantalla } from '@/lib/vistas/contratos-exposicion'
import { SinDato } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Rotulo, Tarjeta } from '@/components/ui'
import { tramosApertura } from '../_lib/apertura'
import { tintaSobre } from '../_lib/tinta'

// La apertura de tus activos (handoff, captura 05): por clase y por geografía,
// barras 100% apiladas de 22 px con el rótulo y el % adentro cuando entran; y
// la concentración, TOP 1 y TOP 3, en dos tarjetas. Lo que vale cada tramo, con
// su traza, está en el detalle de abajo.

function BarraApertura({ titulo, segmentos }: { titulo: string; segmentos: Segmento[] }) {
  const tramos = tramosApertura(segmentos)
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-1.5">
      <figcaption className="text-[12px] text-muted">{titulo}</figcaption>
      {tramos.length ? (
        <div role="img" aria-label={`${titulo}: ${tramos.map((t) => `${t.nombre} ${t.pct}`).join(', ')}`} className="flex h-[22px] gap-[2px] overflow-hidden rounded-[5px]">
          {tramos.map((t) => (
            <div
              key={t.clave}
              title={`${t.nombre} ${t.pct}`}
              className="@container flex min-w-[2px] items-center overflow-hidden whitespace-nowrap font-mono text-[10px]"
              style={{ width: t.ancho, background: t.color, color: tintaSobre(t.color) }}
            >
              {/* Solo si entra: un rótulo cortado no se lee (el nombre y el % están en el título y en el detalle). */}
              {t.rotulo ? <span className="hidden truncate px-1.5 @min-[40px]:block">{t.rotulo}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          <span className="italic">sin dato</span> · aparece con tu primera carga.
        </p>
      )}
    </figure>
  )
}

export function Apertura({ v }: { v: VistaExposicionPantalla }) {
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-3.5 p-4 md:p-5" aria-labelledby="apertura">
      <Rotulo id="apertura">Apertura de activos</Rotulo>
      <BarraApertura titulo="Por clase" segmentos={v.por_clase} />
      <BarraApertura titulo="Por geografía" segmentos={v.por_geografia} />
    </Tarjeta>
  )
}

/** Un porcentaje con un decimal y la traza del exacto. */
function Pct1({ calc, titulo }: { calc: Segmento['peso']; titulo: string }) {
  return (
    <Traza calc={calc} titulo={titulo}>
      {calc.valor === null ? <SinDato motivo={calc.motivo} /> : <span className="num">{porcentaje(calc.valor, { decimales: 1 })}</span>}
    </Traza>
  )
}

export function Concentracion({ v }: { v: VistaExposicionPantalla }) {
  const c = v.concentracion
  const tarjeta = (rotulo: string, calc: Segmento['peso'], quienes: string, titulo: string) => (
    <Tarjeta as="div" className="flex min-w-0 flex-col gap-1.5 p-4" aria-label={rotulo}>
      <span className="rotulo text-[10px]">{rotulo}</span>
      <span className="font-mono text-[24px] leading-tight text-viz-strong">
        <Pct1 calc={calc} titulo={titulo} />
      </span>
      <span className="min-w-0 break-words text-[12px] text-muted">{quienes}</span>
    </Tarjeta>
  )
  return (
    <div className="grid grid-cols-2 gap-3">
      {tarjeta('Top 1', c.top1, c.top1.valor === null ? '' : (c.top1_nombre ?? v.mayores[0] ?? ''), 'Concentración: tu posición más grande')}
      {tarjeta('Top 3', c.top3, c.top3.valor === null ? '' : v.mayores.join(' · '), 'Concentración: tus tres posiciones más grandes')}
    </div>
  )
}
