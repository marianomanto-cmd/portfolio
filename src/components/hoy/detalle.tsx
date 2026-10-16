import { fechaCorta } from '@/lib/domain/fechas'
import type { VistaHoy } from '@/lib/vistas/contratos'
import { MontoTrazado } from '@/components/monto'
import { Chip, Rotulo, Tarjeta } from '@/components/ui'
import { Frase } from './frase'
import { detalleFrase, partesFrase } from './partes-frase'
import type { Mostrar } from './redondeo-frase'

// El detalle de Hoy (D-157, anatomía 5): lo que la pantalla tenía antes del
// rediseño y el handoff no muestra arriba, para que no se pierda nada. La
// frase del día completa (cada cifra, en pesos y en dólares, con su traza),
// quién movió lo invertible y el cuadre del día.

function Cuadre({ v }: { v: VistaHoy }) {
  const c = v.cuadre
  const ok = Boolean(c.ars_ok && c.usd_ok)
  const simbolo = c.ars_ok === null ? '○' : ok ? '✓' : '≠'
  // Por cuánto cierra o no cierra, en las dos monedas y con su traza (D-66,
  // visión §4.1: "Cuadre ✓ 0,00 en $ y en US$"). Sin diferencia (no
  // verificable), solo el detalle: no se inventa un cero.
  const d = c.diferencia
  const cifras = d ? (
    <>
      <MontoTrazado calc={d.ars} moneda="ARS" titulo="Cuadre: diferencia en pesos" decimales={2} signo={!ok} />
      {' · '}
      <MontoTrazado calc={d.usd} moneda="USD" titulo="Cuadre: diferencia en dólares" decimales={2} signo={!ok} />
    </>
  ) : null
  return (
    <p className="text-[13px] text-muted">
      <span className="font-medium text-text">Cuadre {simbolo}</span>{' '}
      {cifras ? ok ? <>cierra (diferencia {cifras}). </> : <>no cierra por {cifras}. </> : null}
      {c.detalle}
    </p>
  )
}

function QuienMovio({ v }: { v: VistaHoy }) {
  const desde = v.frase ? fechaCorta(v.frase.desde) : null
  return (
    <details className="group border-t border-border">
      <summary className="tocable flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-sm">
        <span>
          <span className="font-medium">Quién movió tu financiero</span>
          {desde ? <span className="text-muted"> · desde el {desde}</span> : null}
        </span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {v.movimientos.map((x) => (
          <li key={x.clave} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-1.5 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {x.nombre}
              {x.sin_precio_nuevo ? <Chip>sin precio nuevo</Chip> : null}
            </span>
            <span className="flex items-center gap-3">
              <MontoTrazado calc={x.aporte.ars} moneda="ARS" titulo={`${x.nombre} · en pesos`} signo color />
              <MontoTrazado calc={x.aporte.usd} moneda="USD" titulo={`${x.nombre} · en dólares`} signo color />
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** "Qué pasó desde la última carga": la frase completa, quién movió y el cuadre. */
export function DetalleHoy({ v, m }: { v: VistaHoy; m: Mostrar }) {
  return (
    <Tarjeta aria-label="Qué pasó desde la última carga" className="flex min-w-0 flex-col gap-3 p-5">
      <Rotulo>Qué pasó desde la última carga</Rotulo>
      {v.frase ? (
        <Frase partes={partesFrase(v.frase, m)} detalle={detalleFrase(v.frase, m)} recortar />
      ) : (
        <p className="text-[15px] leading-6">Primera carga guardada. Mañana vas a ver qué cambió y por qué.</p>
      )}
      {v.movimientos.length ? <QuienMovio v={v} /> : null}
      <div className="border-t border-border pt-2.5">
        <Cuadre v={v} />
      </div>
    </Tarjeta>
  )
}
