'use client'

// CCL y dólar cripto (spec: dos campos; Tab entre ellos; Enter guarda). Arrancan
// vacíos: el valor anterior es solo una ayuda, nunca un valor (DB-10). Al lado
// de cada uno, lo que entendió la app ("= 1.548,20") y la variación.

import { forwardRef } from 'react'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import { textoReferencia, variacionContra, type EntradaTC } from '../_lib/entrada'
import { CLASE_CAMPO } from './ui'

interface Props {
  fecha: Fecha
  ccl: EntradaTC
  cripto: EntradaTC
  referencia: string
  ultimo: { fecha: Fecha; ccl: string | null; cripto: string | null } | null
  onCcl: (texto: string) => void
  onCripto: (texto: string) => void
  onReferencia: (texto: string) => void
  deshabilitado?: boolean
}

function Eco({ entrada, comparacion, ayuda, id }: { entrada: EntradaTC; comparacion: string | null; ayuda: string | null; id: string }) {
  if (entrada.error) {
    return (
      <p id={id} className="text-sm text-negative" aria-live="polite">
        {entrada.error}
      </p>
    )
  }
  return (
    <p id={id} className="num min-h-5 text-sm text-muted" aria-live="polite">
      {entrada.eco ? (
        <>
          <span className="text-text">{entrada.eco}</span>
          {comparacion ? <span> · {comparacion}</span> : null}
        </>
      ) : ayuda ? (
        <span className="text-muted">{ayuda}</span>
      ) : null}
    </p>
  )
}

export const CamposTC = forwardRef<HTMLInputElement, Props>(function CamposTC(
  { fecha, ccl, cripto, referencia, ultimo, onCcl, onCripto, onReferencia, deshabilitado },
  refCcl,
) {
  const ayer = ultimo?.ccl ? `${ultimo.fecha === fecha ? 'cargado hoy' : `último ${fechaCorta(ultimo.fecha)}`}: ${textoReferencia(ultimo.ccl)}` : null
  const ayerCripto = ultimo?.cripto ? `${ultimo.fecha === fecha ? 'cargado hoy' : `último ${fechaCorta(ultimo.fecha)}`}: ${textoReferencia(ultimo.cripto)}` : null
  const varCcl = variacionContra(ccl.valor, ultimo && ultimo.fecha < fecha ? ultimo.ccl : null)
  const varCripto = variacionContra(cripto.valor, ccl.valor)
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <div className="min-w-0 space-y-1">
        <label htmlFor="tc-ccl" className="block text-sm font-medium text-text">
          CCL del cierre {fechaCorta(fecha).split(' ')[1]}
        </label>
        <input
          ref={refCcl}
          id="tc-ccl"
          name="ccl"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          autoFocus
          disabled={deshabilitado}
          value={ccl.texto}
          onChange={(e) => onCcl(e.target.value)}
          aria-invalid={ccl.error ? true : undefined}
          aria-describedby="tc-ccl-eco"
          className={`${CLASE_CAMPO} num text-lg`}
        />
        <Eco id="tc-ccl-eco" entrada={ccl} ayuda={ayer} comparacion={varCcl ? `${varCcl} vs ${ultimo ? fechaCorta(ultimo.fecha) : 'ayer'}` : null} />
      </div>
      <div className="min-w-0 space-y-1">
        <label htmlFor="tc-cripto" className="block text-sm font-medium text-text">
          Dólar cripto (venta)
        </label>
        <input
          id="tc-cripto"
          name="cripto"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          disabled={deshabilitado}
          value={cripto.texto}
          onChange={(e) => onCripto(e.target.value)}
          aria-invalid={cripto.error ? true : undefined}
          aria-describedby="tc-cripto-eco"
          className={`${CLASE_CAMPO} num text-lg`}
        />
        <Eco id="tc-cripto-eco" entrada={cripto} ayuda={ayerCripto} comparacion={varCripto ? `${varCripto} vs CCL` : null} />
      </div>
      <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
        <label htmlFor="tc-referencia" className="block text-sm text-muted">
          Referencia del CCL <span className="text-muted">(opcional)</span>
        </label>
        <input
          id="tc-referencia"
          name="referencia"
          autoComplete="off"
          enterKeyHint="done"
          disabled={deshabilitado}
          value={referencia}
          maxLength={200}
          onChange={(e) => onReferencia(e.target.value)}
          placeholder="promedio, GGAL…"
          className={CLASE_CAMPO}
        />
      </div>
    </div>
  )
})
