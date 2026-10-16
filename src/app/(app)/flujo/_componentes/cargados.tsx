'use client'

// "Lo que cargaste" (plan §6 D.9): cada ingreso o gasto cargado, con Deshacer
// (revierte su lote, con las reglas de Registro: se va el aporte o el retiro)
// y Anular (para lo que entró o salió afuera; queda en la auditoría).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fechaCorta } from '@/lib/domain/fechas'
import type { FilaCargada } from '@/lib/vistas/contratos-flujo'
import { Chip, ParMonto } from '@/components/ui'
import { anularCargado, deshacerCargado } from '../acciones'

const BOTON = 'tocable inline-flex min-h-9 items-center justify-center rounded-full border border-border-strong px-3 text-[13px] text-text transition-colors hover:border-text disabled:opacity-60'

const nombreConcepto = (f: FilaCargada) =>
  f.sentido === 'ingreso' ? (f.concepto === 'mensual' ? 'Ingreso mensual' : 'Ingreso extraordinario') : f.concepto === 'mensual' ? 'Gasto fijo del mes' : 'Gasto extraordinario'

export function Cargados({ filas, limite }: { filas: FilaCargada[]; limite?: number }) {
  const router = useRouter()
  const [enviando, iniciar] = useTransition()
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [confirmar, setConfirmar] = useState<number | null>(null)
  const visibles = limite ? filas.slice(0, limite) : filas

  const hacer = (fn: () => Promise<{ ok: boolean; mensaje: string }>) =>
    iniciar(async () => {
      const r = await fn()
      setMensaje({ ok: r.ok, texto: r.mensaje })
      setConfirmar(null)
      if (r.ok) router.refresh()
    })

  if (!filas.length) return <p className="text-[13px] text-muted">Todavía no cargaste ningún ingreso ni gasto.</p>

  return (
    <div>
      {mensaje ? (
        <p role="status" className={`mb-2 text-sm ${mensaje.ok ? 'text-text' : 'text-negative'}`}>
          {mensaje.texto}
        </p>
      ) : null}
      <ul className="divide-y divide-border rounded-item border border-border" data-lista="cargados">
        {visibles.map((f) => (
          <li key={f.id} className={`flex flex-wrap items-start justify-between gap-2 p-3 ${f.anulado ? 'opacity-60' : ''}`} data-cargado={f.id}>
            <div className="min-w-0">
              <p className="text-[14px] text-text">
                {nombreConcepto(f)} <span className="font-normal text-muted">· {fechaCorta(f.fecha)}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {f.cuenta ? `${f.sentido === 'ingreso' ? 'Entró a' : 'Salió de'} ${f.cuenta} · ${f.movimiento === 'aporte' ? 'aporte' : 'retiro'}` : 'Afuera de tus cuentas'}
                {f.cripto ? ' · vendido al cripto' : ''}
              </p>
              <div className="mt-1 text-sm">
                <ParMonto par={f.valor} titulo={nombreConcepto(f)} signo />
              </div>
              {f.anulado ? (
                <p className="mt-1">
                  <Chip>anulado</Chip>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {f.puede_deshacer && f.lote && !f.anulado ? (
                confirmar === f.id ? (
                  <>
                    <button type="button" disabled={enviando} className={`${BOTON} border-negative/50 text-negative`} onClick={() => hacer(() => deshacerCargado(f.lote as string))}>
                      Sí, deshacer
                    </button>
                    <button type="button" className={BOTON} onClick={() => setConfirmar(null)}>
                      No
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={enviando} className={BOTON} onClick={() => setConfirmar(f.id)}>
                    Deshacer
                  </button>
                )
              ) : null}
              {f.puede_anular ? (
                <button type="button" disabled={enviando} className={BOTON} onClick={() => hacer(() => anularCargado(f.id))}>
                  Anular
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {limite && filas.length > limite ? <p className="mt-1 text-xs text-muted">Y {filas.length - limite} más en Flujo.</p> : null}
      <p className="mt-2 text-xs text-muted">Deshacer revierte la carga entera, como en Registro: solo se puede con la última carga de esa cuenta. Anular es para lo que fue afuera.</p>
    </div>
  )
}
