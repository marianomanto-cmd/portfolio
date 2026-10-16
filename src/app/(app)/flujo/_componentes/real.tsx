'use client'

// Proyectado contra real (plan §6 D.9; D-149): cada mes nace proyectado con lo
// declarado y se vuelve real con lo cargado. Una Grilla por mes (D-157):
// línea · proyectado · real · desvío, cada cifra en pesos y en dólares con su
// traza; debajo de 768 px, una tarjeta por línea (D-30).

import { useMemo } from 'react'
import type { FilaDesvioVista, MesCerrado } from '@/lib/vistas/contratos-flujo'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { useMedia } from '@/components/preferencias'
import { Chip, ParMonto, Rotulo, Tarjeta } from '@/components/ui'

function columnas(m: MesCerrado): ColumnaGrilla<FilaDesvioVista>[] {
  return [
    { id: 'linea', titulo: 'Línea', ancho: 150, flex: 1.2, prioridad: 0, celda: (f) => <span className="text-text">{f.nombre}</span> },
    { id: 'proyectado', titulo: 'Proyectado', tipo: 'numero', ancho: 150, prioridad: 0, celda: (f) => <ParMonto par={f.proyectado} titulo={`${f.nombre} de ${m.nombre} · proyectado`} vertical /> },
    { id: 'real', titulo: 'Real', tipo: 'numero', ancho: 150, prioridad: 0, celda: (f) => <ParMonto par={f.real} titulo={`${f.nombre} de ${m.nombre} · real`} vertical /> },
    { id: 'desvio', titulo: 'Desvío', tipo: 'numero', ancho: 150, prioridad: 1, celda: (f) => <ParMonto par={f.desvio} titulo={`${f.nombre} de ${m.nombre} · desvío`} signo vertical /> },
  ]
}

function TarjetaLinea({ f, m }: { f: FilaDesvioVista; m: MesCerrado }) {
  return (
    <div className="rounded-item border border-border bg-surface-2 p-3 text-sm" data-linea={f.linea}>
      <p className="font-medium text-text">{f.nombre}</p>
      <dl className="mt-1 space-y-1">
        {(
          [
            ['Proyectado', f.proyectado],
            ['Real', f.real],
            ['Desvío', f.desvio],
          ] as const
        ).map(([t, p]) => (
          <div key={t} className="flex flex-wrap items-baseline justify-between gap-x-2">
            <dt className="text-muted">{t}</dt>
            <dd className="ml-auto text-right">
              <ParMonto par={p} titulo={`${f.nombre} de ${m.nombre} · ${t.toLowerCase()}`} signo={t === 'Desvío'} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function MesReal({ m }: { m: MesCerrado }) {
  const cols = useMemo(() => columnas(m), [m])
  // Con el dedo (una tablet), cada cifra es un tocable de 44 px y cada celda lleva dos, una arriba de la otra (D-100).
  const grueso = useMedia('(pointer: coarse)', false)
  return (
    <section aria-label={`${m.nombre}: proyectado contra real`} className="flex min-w-0 flex-col gap-2" data-real={m.mes}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-medium text-text">{m.nombre}</h3>
        <Chip>{m.estado === 'en_curso' ? 'en curso' : 'cerrado'}</Chip>
      </div>
      <Grilla
        titulo={`${m.nombre}: proyectado, real y desvío por línea`}
        filas={m.filas}
        columnas={cols}
        idFila={(f) => f.linea}
        nombreFila={(f) => f.nombre}
        altoFila={grueso ? 100 : 56}
        tarjeta={(f) => <TarjetaLinea f={f} m={m} />}
      />
    </section>
  )
}

export function RealContraProyectado({ meses }: { meses: MesCerrado[] }) {
  return (
    <div id="real-contra-proyectado" className="scroll-mt-24">
      <Tarjeta className="p-5" aria-labelledby="titulo-real">
        <Rotulo id="titulo-real">Proyectado contra real</Rotulo>
        <p className="mt-1 text-[13px] text-muted">
          Cada mes nace proyectado con lo que declaraste y se vuelve real con lo que cargás (Cargar ingreso, las cuotas pagadas, tus cargas). Los gastos reales son sin dato
          salvo los que cargás. Lo extraordinario va aparte: no cambia lo recurrente.
        </p>
        {meses.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Todavía no hay meses con datos para comparar.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {meses.map((m) => (
              <MesReal key={m.mes} m={m} />
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
