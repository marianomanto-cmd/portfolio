'use client'

import { useState } from 'react'
import type { EjeComposicion, PerimetroComposicion, SegmentoBalance, VistaBalance } from '@/lib/vistas/contratos-balance'
import { SegmentadoBotones } from '@/components/pantalla/segmentado'
import { Rotulo, Tarjeta } from '@/components/ui'
import { ParCifra } from './cifra'
import { BarraTramos, Pct } from './tarjetas'

// Composición del activo (sin restar deudas): tres barras 100% apiladas, por
// moneda de riesgo, por clase y por liquidez (D-132), del financiero o del
// total. Barras de CSS, como Exposición: pesan poco y se leen igual. Sin tortas.

const EJES: { eje: EjeComposicion; titulo: string }[] = [
  { eje: 'moneda', titulo: 'Por moneda de riesgo' },
  { eje: 'clase', titulo: 'Por clase' },
  { eje: 'liquidez', titulo: 'Por liquidez' },
]

function Barra({ titulo, segmentos }: { titulo: string; segmentos: SegmentoBalance[] }) {
  const reglas = segmentos.filter((s) => s.regla)
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="mb-2 text-sm font-medium">{titulo}</figcaption>
      <div role="img" aria-label={`${titulo}: ${segmentos.map((s) => `${s.nombre}${s.pct ? ` ${s.pct.replace('.', ',')}%` : ''}`).join(', ')}`}>
        <BarraTramos titulo={titulo} tramos={segmentos} />
      </div>
      {/* En el teléfono, nombre y porcentaje en dos columnas; desde 768 px, también lo que vale cada tramo. */}
      <ul className="mt-2 grid grid-cols-2 gap-x-4 md:grid-cols-1">
        {segmentos.map((s) => (
          <li key={s.clave} className="flex min-w-0 flex-col border-b border-border py-1 text-sm">
            <span className="flex min-w-0 items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="min-w-0 break-words leading-5">{s.nombre}</span>
              </span>
              <span className="shrink-0 font-medium">
                <Pct pct={s.pct} calc={s.peso} titulo={`${titulo} · ${s.nombre}`} />
              </span>
            </span>
            {/* Un span propio: ParCifra ya trae su display y "hidden" no lo pisa. */}
            <span className="hidden pl-[18px] md:block print:block">
              <ParCifra par={s.valor} titulo={`${titulo} · ${s.nombre}`} className="text-[13px]" />
            </span>
          </li>
        ))}
      </ul>
      {reglas.length ? (
        <ul className="mt-1 space-y-0.5 text-[12px] text-muted">
          {reglas.map((s) => (
            <li key={s.clave}>
              <span className="font-medium">{s.nombre}:</span> {s.regla}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  )
}

export function Composicion({ comp, hayBienes }: { comp: VistaBalance['composicion']; hayBienes: boolean }) {
  const [per, setPer] = useState<PerimetroComposicion>(hayBienes ? 'total' : 'financiero')
  const opciones: { per: PerimetroComposicion; nombre: string }[] = [
    { per: 'financiero', nombre: 'Financiero' },
    { per: 'total', nombre: 'Total' },
  ]
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="composicion-balance">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Rotulo as="h3">
          <span id="composicion-balance">Composición del activo</span>
        </Rotulo>
        <SegmentadoBotones etiqueta="Qué parte del activo" opciones={opciones.map((o) => ({ valor: o.per, nombre: o.nombre }))} actual={per} alElegir={setPer} className="print:hidden" />
      </div>
      <p className="mt-1 text-[12px] text-muted">
        {per === 'total' ? 'Lo financiero más tus bienes, sin restar deudas.' : 'Títulos y liquidez de tus cuentas.'}
      </p>
      <div className="mt-3 grid gap-5 lg:grid-cols-3 lg:gap-6">
        {EJES.map((e) => (
          <Barra key={e.eje} titulo={e.titulo} segmentos={comp[per][e.eje]} />
        ))}
      </div>
    </Tarjeta>
  )
}
