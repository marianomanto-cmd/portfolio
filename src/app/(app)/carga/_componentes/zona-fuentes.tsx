'use client'

// Una sola zona para soltar o pegar (CA-2): el Excel de IEB y las capturas de
// Galicia y de Mercado Pago, en cualquier orden. Ctrl+V funciona en toda la
// pantalla; en el teléfono, el botón abre el selector de fotos y archivos.

import { useRef } from 'react'
import { FileSpreadsheet, ImageIcon, Loader2, RotateCcw, Upload, X } from 'lucide-react'
import type { NombreCuenta } from '@/lib/carga/contratos'
import { textoDuracion } from '../_lib/tiempo'
import { Boton, Chip } from './ui'
import type { FuenteCarga } from './tipos'

const CORTO: Record<NombreCuenta, string> = { IEB: 'IEB', Galicia: 'Galicia', 'Mercado Pago': 'MP' }

export function nombreCorto(c: NombreCuenta | null): string {
  return c ? CORTO[c] : 'archivo'
}

function resumenLectura(f: FuenteCarga): { texto: string; tono: 'azul' | 'aviso' | 'neutro' } {
  const l = f.respuesta?.lectura
  if (!l) return { texto: '', tono: 'neutro' }
  const filas = l.filas.length
  const saldos = l.saldos.length
  const partes = [
    filas ? `${filas} ${filas === 1 ? 'fila' : 'filas'}` : null,
    saldos ? `${saldos} ${saldos === 1 ? 'saldo' : 'saldos'}` : null,
  ].filter(Boolean)
  const malos = l.filas.filter((x) => x.estado !== 'verificada').length + l.saldos.filter((x) => x.estado !== 'verificada').length
  const controlMalo = l.controles.some((c) => c.ok === false)
  const b2 = l.controles.find((c) => c.tipo === 'ieb_b2')
  const extra = b2 ? (b2.ok ? 'cierra contra B2' : 'no cierra contra B2') : l.controles.find((c) => c.tipo === 'galicia_total')?.ok ? 'cierra contra el total' : null
  return {
    texto: [partes.join(' · ') || 'sin filas', extra, malos ? `${malos} a revisar` : null].filter(Boolean).join(' · '),
    tono: malos || controlMalo ? 'aviso' : 'azul',
  }
}

export function ZonaFuentes({
  fuentes,
  activas,
  repetidas,
  arrastrando,
  deshabilitado,
  onArchivos,
  onReintentar,
  onQuitar,
  onUsar,
  onEjemplo,
}: {
  fuentes: FuenteCarga[]
  activas: Set<string>
  repetidas: NombreCuenta[]
  arrastrando: boolean
  deshabilitado?: boolean
  onArchivos: (archivos: File[]) => void
  onReintentar: (id: string) => void
  onQuitar: (id: string) => void
  onUsar: (id: string) => void
  onEjemplo?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <section aria-label="Archivos y capturas" className="space-y-3">
      <div
        className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${
          arrastrando ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface'
        }`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-text">
              <span className="hidden md:inline">Soltá o pegá acá (Ctrl+V): </span>
              <span className="md:hidden">Agregá: </span>
              Excel de IEB y capturas de Galicia y de Mercado Pago.
            </p>
            <p className="text-sm text-muted">El orden no importa. Se leen mientras tipeás.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Boton variante="suave" onClick={() => input.current?.click()} disabled={deshabilitado} className="max-md:w-full">
              <Upload aria-hidden className="size-4" />
              Elegir archivos
            </Boton>
            {onEjemplo ? (
              <Boton variante="fantasma" onClick={onEjemplo} disabled={deshabilitado} className="max-md:w-full">
                Probar con un ejemplo
              </Boton>
            ) : null}
          </div>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const archivos = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (archivos.length) onArchivos(archivos)
            }}
          />
        </div>

        {fuentes.length ? (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {fuentes.map((f) => {
              const activa = activas.has(f.id)
              const repetida = f.cuenta !== null && repetidas.includes(f.cuenta)
              const r = resumenLectura(f)
              const Icono = f.clase === 'excel' ? FileSpreadsheet : ImageIcon
              return (
                <li key={f.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <Icono aria-hidden className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 font-medium text-text">
                    {f.estado === 'leida' ? (f.cuenta ?? 'Fuente') : f.nombre}
                  </span>
                  {f.estado === 'leyendo' ? (
                    <span className="inline-flex items-center gap-1 text-sm text-muted" aria-live="polite">
                      <Loader2 aria-hidden className="size-4 animate-spin" /> leyendo…
                    </span>
                  ) : null}
                  {f.estado === 'leida' ? (
                    <>
                      <Chip tono={r.tono}>{r.tono === 'azul' ? '✓' : '≠'} {r.texto}</Chip>
                      <span className="num text-xs text-muted">
                        {f.clase === 'excel' ? 'Excel' : 'captura'}
                        {f.respuesta && f.respuesta.ms > 0
                          ? ` · ${f.respuesta.ms < 1000 ? `${(f.respuesta.ms / 1000).toFixed(1).replace('.', ',')} s` : textoDuracion(f.respuesta.ms)}`
                          : f.archivo
                            ? ''
                            : ' · ejemplo'}
                      </span>
                      {repetida ? (
                        activa ? (
                          <Chip tono="azul">la que vale</Chip>
                        ) : (
                          <Boton variante="secundario" onClick={() => onUsar(f.id)}>
                            Usar esta
                          </Boton>
                        )
                      ) : null}
                    </>
                  ) : null}
                  {f.estado === 'error' ? (
                    <span role="alert" className="min-w-0 basis-full text-sm text-negative sm:basis-auto">
                      {f.error}
                    </span>
                  ) : null}
                  <span className="ml-auto flex shrink-0 gap-1">
                    {f.estado === 'error' && f.archivo ? (
                      <Boton variante="secundario" onClick={() => onReintentar(f.id)}>
                        <RotateCcw aria-hidden className="size-4" /> Reintentar
                      </Boton>
                    ) : null}
                    <Boton
                      variante="fantasma"
                      onClick={() => onQuitar(f.id)}
                      aria-label={f.estado === 'error' ? `Dejar pendiente ${f.nombre}` : `Quitar ${f.cuenta ?? f.nombre}`}
                      title={f.estado === 'error' ? 'Dejar pendiente (no se carga hoy)' : 'Quitar de esta carga'}
                    >
                      {f.estado === 'error' ? 'Dejar pendiente' : <X aria-hidden className="size-4" />}
                    </Boton>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
        {repetidas.length ? (
          <p className="mt-2 text-sm text-muted">
            Hay más de una fuente de {repetidas.join(' y ')}: se graba una sola por cuenta. Elegí cuál vale.
          </p>
        ) : null}
      </div>
    </section>
  )
}
