import type { Metadata } from 'next'
import Link from 'next/link'
import type { CalcVista } from '@/lib/domain/calc'
import { porcentaje } from '@/lib/domain/dinero'
import { modoDemo } from '@/lib/server/sesion'
import { vistaCartera } from '@/lib/vistas'
import { ejemploCarteraVariante, varianteDemo } from '@/lib/vistas/ejemplo'
import type { VistaCartera } from '@/lib/vistas/contratos'
import { parcialDeTotal } from '@/components/calculos'
import { extremos, lecturaPosiciones } from '@/components/cartera/lectura'
import { TablaCartera } from '@/components/cartera/tabla'
import { ErrorVista } from '@/components/error-vista'
import { tonoDe } from '@/components/hoy/barras'
import { MontoTrazado, SinDato } from '@/components/monto'
import { CifraClave, CifrasClave } from '@/components/pantalla/cifra-clave'
import { Encabezado } from '@/components/pantalla/encabezado'
import { Traza } from '@/components/traza'

export const dynamic = 'force-dynamic'
// En la pantalla se llama Posiciones (D-156); la ruta sigue siendo /cartera.
export const metadata: Metadata = { title: 'Posiciones' }

// Posiciones (D-157; handoff "Portfolio UI", capturas 03 y 04): la pregunta,
// la lectura (cuántas posiciones y cuál explica más de lo que ganaste), las
// cuatro cifras clave (el valor de la cartera, el resultado total, la mejor y
// la peor en dólares) y la tabla densa, con los filtros de siempre.

/** Un porcentaje de resultado con una cifra decimal, en verde o sangría, con su traza (sin flechas, como en el handoff). */
function Pct({ calc, titulo, sufijo = '', pastilla = false }: { calc: CalcVista; titulo: string; sufijo?: string; pastilla?: boolean }) {
  const tono = tonoDe(calc.valor, 3)
  return (
    <Traza calc={calc} titulo={titulo}>
      {calc.valor === null ? (
        <SinDato motivo={calc.motivo} />
      ) : (
        <span className={`num ${pastilla ? 'usd' : ''} ${tono}`}>
          {porcentaje(calc.valor, { decimales: 1, signo: true })}
          {sufijo}
        </span>
      )}
    </Traza>
  )
}

function Cifras({ v }: { v: VistaCartera }) {
  const t = v.totales
  const { mejor, peorUsd } = extremos(v.filas)
  const parcialUsd = parcialDeTotal(t.resultado.usd, 'USD')
  return (
    <CifrasClave>
      <CifraClave rotulo="Valor de la cartera" par={t.valor} titulo="Valor de la cartera" decimalesUsd={0} />
      <CifraClave
        rotulo="Resultado total"
        principal={<MontoTrazado calc={t.resultado.ars} moneda="ARS" titulo="Resultado total · en pesos" signo decimales={0} className={tonoDe(t.resultado.ars.valor)} />}
        secundaria={<MontoTrazado calc={t.resultado.usd} moneda="USD" titulo="Resultado total · en dólares" signo decimales={0} className={tonoDe(t.resultado.usd.valor)} />}
        nota={
          parcialUsd?.parcial ? (
            <>
              En dólares, suma parcial ({parcialUsd.contadas} de {parcialUsd.de}):{' '}
              <MontoTrazado calc={parcialUsd.parcial} moneda="USD" titulo="Resultado total · suma parcial en dólares" signo decimales={0} />
            </>
          ) : null
        }
      />
      <CifraClave
        rotulo={mejor ? `Mejor · ${mejor.ticker}` : 'Mejor'}
        principal={mejor ? <Pct calc={mejor.resultado_pct.ars} titulo={`${mejor.ticker} · resultado % en pesos`} /> : <SinDato motivo="Ninguna posición tiene resultado." />}
        secundaria={mejor ? <Pct calc={mejor.resultado_pct.usd} titulo={`${mejor.ticker} · resultado % en dólares`} sufijo=" USD" pastilla /> : null}
      />
      <CifraClave
        rotulo={peorUsd ? `Peor en dólares · ${peorUsd.ticker}` : 'Peor en dólares'}
        principal={peorUsd ? <Pct calc={peorUsd.resultado_pct.ars} titulo={`${peorUsd.ticker} · resultado % en pesos`} /> : <SinDato motivo="Ninguna posición tiene resultado en dólares." />}
        secundaria={peorUsd ? <Pct calc={peorUsd.resultado_pct.usd} titulo={`${peorUsd.ticker} · resultado % en dólares`} sufijo=" USD" pastilla /> : null}
      />
    </CifrasClave>
  )
}

export default async function PaginaCartera({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  let v: VistaCartera
  try {
    const variante = modoDemo() ? varianteDemo(sp.demo) : null
    v = variante ? ejemploCarteraVariante(variante) : await vistaCartera()
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Posiciones</h1>
        <ErrorVista error={e} que="tus posiciones" />
      </>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <Encabezado pregunta="Patrimonio · ¿Qué tengo y cómo le va a cada cosa?" lectura={lecturaPosiciones(v)} className="max-md:[&_h1]:text-[28px]" />
      {v.filas.length === 0 ? (
        <p className="rounded-tarjeta border border-border bg-surface p-5 text-sm text-muted">
          Con tu primera carga (el Excel de IEB y las capturas de Galicia y Mercado Pago), cada posición aparece acá, en pesos y en dólares.{' '}
          <Link href="/carga" className="tocable font-medium text-text underline-offset-2 hover:underline">
            Hacer la primera carga →
          </Link>
        </p>
      ) : (
        <>
          <Cifras v={v} />
          <TablaCartera v={v} />
        </>
      )}
    </div>
  )
}
