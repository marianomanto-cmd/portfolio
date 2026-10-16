'use client'

import { ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { numero, porcentaje } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { FilaCartera, VistaCartera } from '@/lib/vistas/contratos'
import { decimalesPrecio, diasEnPosicion, type sumaColumna } from '@/components/calculos'
import { Grilla, type ColumnaGrilla } from '@/components/grilla'
import { anchoRelativo, tonoDe } from '@/components/hoy/barras'
import { MontoTrazado, SinDato } from '@/components/monto'
import { useMedia } from '@/components/preferencias'
import { Traza } from '@/components/traza'
import { Aviso, Chip, ChipEtiqueta } from '@/components/ui'
import {
  barraActivoTc,
  desgloseEn,
  esLiquidez,
  haceDias,
  hayFiltros,
  NOMBRE_TIPO,
  notasPendientes,
  pasa,
  pesoMaximo,
  SIN_FILTRO,
  sinAtribuirHoy,
  sumasParciales,
  totalesCartera,
  trazaActivoTc,
  trazaTotalActivoTc,
  type Filtros,
  type TotalesCartera,
} from './cuentas'

// Posiciones (rediseño del 15/10, D-157; handoff, capturas 03 y 04): la tabla
// densa del spec en doble moneda, en la Grilla común (AG Grid). Columnas del
// handoff: Activo · Cantidad · PPC ARS · PPC USD · Precio · Valor · Result.
// ARS · Result. USD · Activo · TC · % cartera · Días. Ordenable (de mayor a
// menor al primer toque; la liquidez, siempre al pie), con los totales fijos
// abajo y la liquidez en sus filas, sin costo ni resultado ("—": no aplica).
// Cuando una columna no entra en el ancho, la Grilla la oculta por prioridad
// y la fila suma "⋯" con lo que falta. Debajo de 768 px, una tarjeta por fila.
// Las cuentas están en ./cuentas (con test).

const NO_APLICA = <span className="text-muted">—</span>

/** Un número de dos renglones: arriba el monto, abajo el porcentaje (o la pastilla). */
function Doble({ arriba, abajo }: { arriba: ReactNode; abajo?: ReactNode }) {
  return (
    <span className="inline-flex flex-col items-end gap-[3px] leading-tight">
      <span>{arriba}</span>
      {abajo ? <span className="text-[12px]">{abajo}</span> : null}
    </span>
  )
}

/** Un porcentaje con una sola cifra decimal, como en el handoff ("+46,4%"), con su traza y su color si es un resultado. */
function Pct({ calc, titulo, signo = true, color = false, sufijo = '' }: { calc: CalcVista; titulo: string; signo?: boolean; color?: boolean; sufijo?: string }) {
  return (
    <Traza calc={calc} titulo={titulo}>
      {calc.valor === null ? (
        <SinDato motivo={calc.motivo} />
      ) : (
        <span className={`num ${color ? tonoDe(calc.valor, 3) : ''}`}>
          {porcentaje(calc.valor, { decimales: 1, signo })}
          {sufijo}
        </span>
      )}
    </Traza>
  )
}

/** Un resultado: el monto con su signo, en verde o sangría, y el % debajo (sin flechas, como en el handoff). */
function Resultado({ f, m }: { f: FilaCartera; m: 'ars' | 'usd' }) {
  const moneda = m === 'ars' ? 'ARS' : 'USD'
  const c = f.resultado[m]
  const tono = tonoDe(c.valor)
  return (
    <Doble
      arriba={<MontoTrazado calc={c} moneda={moneda} titulo={`${f.ticker} · resultado en ${m === 'ars' ? 'pesos' : 'dólares'}`} signo decimales={0} className={tono} />}
      abajo={f.resultado_pct[m].valor !== null ? <Pct calc={f.resultado_pct[m]} titulo={`${f.ticker} · resultado % en ${m === 'ars' ? 'pesos' : 'dólares'}`} color /> : null}
    />
  )
}

/** El nombre corto de una fila: el ticker o, en la liquidez, la moneda ("Pesos", "Dólares"). */
export const corto = (f: FilaCartera) => (esLiquidez(f) ? (f.moneda_riesgo === 'USD' ? 'Dólares' : 'Pesos') : f.ticker)

/**
 * La celda del activo: el color del activo, el ticker y, debajo, el nombre con
 * la cuenta o, si el precio es viejo (D-16), el chip "precio de hace N días"
 * (el nombre queda en el título). Siempre dos renglones: la fila no crece.
 */
function Activo({ f, hoy }: { f: FilaCartera; hoy: string | undefined }) {
  const hace = f.precio_viejo ? haceDias(f.fecha_precio, hoy) : null
  const nombre = esLiquidez(f) ? `Liquidez · ${f.cuenta}` : `${f.nombre} · ${f.cuenta}`
  const riesgo = f.moneda_riesgo === 'USD' ? 'arriesga dólares' : 'arriesga pesos'
  const titulo = `${esLiquidez(f) ? f.nombre : `${f.nombre} · ${NOMBRE_TIPO[f.tipo] ?? f.tipo} · ${riesgo}`} · ${f.cuenta}${f.precio_viejo && f.fecha_precio ? ` · ${esLiquidez(f) ? 'saldo' : 'precio'} del ${fechaCorta(f.fecha_precio)} (viejo: más de 2 días hábiles)` : ''}`
  return (
    <span className="flex min-w-0 items-center gap-2.5" title={titulo}>
      <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: f.color }} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{corto(f)}</span>
        {f.precio_viejo ? (
          <span className="self-start truncate rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[9px] uppercase leading-none tracking-[0.1em] text-muted">
            {esLiquidez(f) ? 'saldo' : 'precio'} de hace {hace ?? 'más de 2'} días
          </span>
        ) : (
          <span className="truncate text-[11px] text-muted">{nombre}</span>
        )}
      </span>
    </span>
  )
}

/** La barra Activo · TC: el resultado en pesos partido en activo (tinta, o sangría si resta) y tipo de cambio (oro). */
function BarraActivoTc({ activo, tc, traza, titulo }: { activo: string | null; tc: string | null; traza: CalcVista; titulo: string }) {
  const b = barraActivoTc(activo, tc)
  return (
    <Traza calc={traza} titulo={titulo} moneda="ARS" className="w-full [&>button]:w-full">
      <span role="img" aria-label={b ? 'Resultado: activo y tipo de cambio' : 'Sin desglose'} className="flex h-2 w-full min-w-[56px] gap-0.5 overflow-hidden rounded-full bg-surface-3">
        {b ? (
          <>
            <span className="h-full" style={{ width: b.activo, background: b.activoNegativo ? 'var(--accent)' : 'var(--text)' }} />
            <span className="h-full bg-viz" style={{ width: b.tc }} />
          </>
        ) : null}
      </span>
    </Traza>
  )
}

/** "% cartera": la mini barra (44 × 4) con el color del activo, medida contra la fila más grande, y el porcentaje. */
function PesoCartera({ f, maximo }: { f: FilaCartera; maximo: string | null }) {
  const ancho = anchoRelativo(f.peso.valor, maximo)
  return (
    // Con el dedo, el porcentaje es un tocable de 44 px: va debajo de la barrita, para que entre en la columna.
    <span className="flex items-center justify-end gap-2 pointer-coarse:flex-col pointer-coarse:items-end pointer-coarse:gap-1">
      <span aria-hidden className="h-1 w-11 shrink-0 overflow-hidden rounded-sm bg-surface-3">
        {ancho ? <span className="block h-full" style={{ width: ancho, background: f.color }} /> : null}
      </span>
      <span className="min-w-10 text-right">
        <Pct calc={f.peso} titulo={`${f.ticker === 'USD' || f.ticker === 'ARS' ? f.nombre : f.ticker} · peso en lo financiero`} signo={false} />
      </span>
    </span>
  )
}

/** Días en posición, con su traza; "ap." si se cuentan desde la apertura en la app y "decl." si desde la fecha que declaraste. */
function Dias({ f }: { f: FilaCartera }) {
  const c = diasEnPosicion(f.dias_en_posicion, f.dias_desde, f.fecha_inicio ?? null)
  const marca = f.dias_desde === 'apertura' ? 'ap.' : f.dias_desde === 'declarada' ? 'decl.' : null
  return (
    // Con el dedo, la cifra es un tocable de 44 px: la marca va debajo, para que entre en la columna.
    <span className="inline-flex items-baseline gap-1 text-muted pointer-coarse:flex-col pointer-coarse:items-end pointer-coarse:gap-0">
      <Traza calc={c} titulo={`${f.ticker} · días en posición`}>
        {c.valor === null ? <SinDato motivo={c.motivo} /> : <span className="num">{c.valor}</span>}
      </Traza>
      {marca ? <span className="font-mono text-[10px]">{marca}</span> : null}
    </span>
  )
}

/**
 * Un total de columna: "sin dato" si le falta una fila (D-65), y debajo la
 * suma parcial con la marca ¹, que la leyenda de abajo explica (qué filas
 * faltan). Cuántas cuenta, en su traza.
 */
function TotalCelda({ t, moneda, titulo, signo = true, color = true }: { t: ReturnType<typeof sumaColumna>; moneda: 'ARS' | 'USD'; titulo: string; signo?: boolean; color?: boolean }) {
  const tono = color ? tonoDe(t.total.valor) : ''
  return (
    <span className="inline-flex flex-col items-end gap-[3px] leading-tight">
      <MontoTrazado calc={t.total} moneda={moneda} titulo={titulo} signo={signo} decimales={0} className={tono} />
      {t.parcial ? (
        <span className="flex items-baseline justify-end whitespace-nowrap text-[12px] font-normal text-muted">
          <MontoTrazado calc={t.parcial} moneda={moneda} titulo={`${titulo} · suma parcial (${t.contadas} de ${t.de})`} signo={signo} decimales={0} />
          <sup aria-label="suma parcial" className="ml-0.5 text-[10px]">
            ¹
          </sup>
        </span>
      ) : null}
    </span>
  )
}

/** Las columnas de la grilla, en el orden del handoff. Las cuentas de los totales vienen hechas. Exportada para el test. */
export function columnas(tot: TotalesCartera, maximo: string | null, hoy: string | undefined, filtrado: boolean): ColumnaGrilla<FilaCartera>[] {
  const nada = (f: FilaCartera) => esLiquidez(f)
  return [
    {
      id: 'activo',
      titulo: 'Activo',
      ancho: 155,
      flex: 1.6,
      prioridad: 0,
      celda: (f) => <Activo f={f} hoy={hoy} />,
      orden: (f) => (nada(f) ? null : f.ticker),
      total: () => <span className="font-medium">{filtrado ? `Total · lo filtrado` : 'Total'}</span>,
    },
    {
      id: 'cantidad',
      titulo: 'Cantidad',
      tipo: 'numero',
      ancho: 90,
      flex: 0.7,
      prioridad: 6,
      celda: (f) =>
        nada(f) ? (
          NO_APLICA
        ) : (
          <Traza calc={f.cantidad} titulo={`${f.ticker} · cantidad`}>
            {f.cantidad.valor === null ? <SinDato motivo={f.cantidad.motivo} /> : <span className="num">{numero(f.cantidad.valor, 4, { min: 0 })}</span>}
          </Traza>
        ),
      orden: (f) => (nada(f) ? null : f.cantidad.valor),
    },
    {
      id: 'ppc_ars',
      titulo: 'PPC ARS',
      tipo: 'numero',
      ancho: 98,
      flex: 0.8,
      prioridad: 5,
      celda: (f) =>
        nada(f) ? (
          NO_APLICA
        ) : (
          <Doble arriba={<MontoTrazado calc={f.ppc.ars} moneda="ARS" titulo={`${f.ticker} · PPC en pesos`} decimales={decimalesPrecio(f.ppc.ars.valor)} />} abajo={<ChipEtiqueta calc={f.ppc.ars} omitir={['parcial', 'declarado']} />} />
        ),
      orden: (f) => (nada(f) ? null : f.ppc.ars.valor),
    },
    {
      id: 'ppc_usd',
      titulo: 'PPC USD',
      tipo: 'numero',
      // Un PPC en dólares por 1 VN lleva 6 decimales ("US$ 0,000694") y el chip de su etiqueta debajo.
      ancho: 114,
      flex: 0.8,
      prioridad: 4,
      celda: (f) =>
        nada(f) ? (
          NO_APLICA
        ) : (
          <Doble arriba={<MontoTrazado calc={f.ppc.usd} moneda="USD" titulo={`${f.ticker} · PPC en dólares`} decimales={decimalesPrecio(f.ppc.usd.valor)} />} abajo={<ChipEtiqueta calc={f.ppc.usd} omitir={['parcial']} />} />
        ),
      orden: (f) => (nada(f) ? null : f.ppc.usd.valor),
    },
    {
      id: 'precio',
      titulo: 'Precio',
      tipo: 'numero',
      ancho: 98,
      flex: 0.8,
      prioridad: 3,
      celda: (f) =>
        nada(f) ? (
          NO_APLICA
        ) : (
          <MontoTrazado calc={f.precio} moneda="ARS" titulo={`${f.ticker} · precio`} decimales={decimalesPrecio(f.precio.valor)} className={f.precio_viejo ? 'text-muted' : ''} />
        ),
      orden: (f) => (nada(f) ? null : f.precio.valor),
    },
    {
      id: 'valor',
      titulo: 'Valor',
      tipo: 'numero',
      ancho: 106,
      flex: 1.1,
      prioridad: 0,
      celda: (f) => {
        const t = esLiquidez(f) ? f.nombre : f.ticker
        return (
          <Doble
            arriba={<MontoTrazado calc={f.valor.ars} moneda="ARS" titulo={`${t} · valor en pesos`} decimales={0} />}
            abajo={<MontoTrazado calc={f.valor.usd} moneda="USD" titulo={`${t} · valor en dólares`} decimales={0} />}
          />
        )
      },
      orden: (f) => (nada(f) ? null : f.valor.ars.valor),
      total: () => (
        <Doble
          arriba={<TotalCelda t={tot.valorArs} moneda="ARS" titulo="Valor de lo que está a la vista, en pesos" signo={false} color={false} />}
          abajo={<TotalCelda t={tot.valorUsd} moneda="USD" titulo="Valor de lo que está a la vista, en dólares" signo={false} color={false} />}
        />
      ),
    },
    {
      id: 'res_ars',
      titulo: 'Result. ARS',
      tipo: 'numero',
      ancho: 106,
      flex: 1.1,
      prioridad: 0,
      celda: (f) => (nada(f) ? NO_APLICA : <Resultado f={f} m="ars" />),
      orden: (f) => (nada(f) ? null : f.resultado.ars.valor),
      total: () => (
        <Doble
          arriba={<TotalCelda t={tot.resArs} moneda="ARS" titulo="Resultado total en pesos" />}
          abajo={tot.pctArs ? <Pct calc={tot.pctArs} titulo="Resultado total % en pesos" color /> : null}
        />
      ),
    },
    {
      id: 'res_usd',
      titulo: 'Result. USD',
      tipo: 'numero',
      ancho: 101,
      flex: 0.9,
      prioridad: 0,
      celda: (f) => (nada(f) ? NO_APLICA : <Resultado f={f} m="usd" />),
      orden: (f) => (nada(f) ? null : f.resultado.usd.valor),
      total: () => (
        <Doble
          arriba={<TotalCelda t={tot.resUsd} moneda="USD" titulo="Resultado total en dólares" />}
          abajo={tot.pctUsd && tot.pctUsd.valor !== null ? <Pct calc={tot.pctUsd} titulo="Resultado total % en dólares" color /> : null}
        />
      ),
    },
    {
      id: 'activo_tc',
      titulo: 'Activo · TC',
      ancho: 92,
      flex: 0.8,
      prioridad: 2,
      celda: (f) => {
        if (nada(f)) return NO_APLICA
        const d = desgloseEn(f, 'ARS')
        return <BarraActivoTc activo={d?.activo.valor ?? null} tc={d?.tc.valor ?? null} traza={trazaActivoTc(f)} titulo={`${f.ticker} · resultado: activo y tipo de cambio`} />
      },
      orden: (f) => (nada(f) ? null : (desgloseEn(f, 'ARS')?.tc.valor ?? null)),
      total: () => <BarraActivoTc activo={tot.actArs.total.valor} tc={tot.tcArs.total.valor} traza={trazaTotalActivoTc(tot)} titulo="Resultado total: activo y tipo de cambio" />,
    },
    {
      id: 'peso',
      titulo: '% cartera',
      tipo: 'numero',
      ancho: 104,
      flex: 0.9,
      prioridad: 1,
      celda: (f) => <PesoCartera f={f} maximo={maximo} />,
      orden: (f) => (nada(f) ? null : f.peso.valor),
      total: () => <Pct calc={tot.peso.total} titulo="Peso de lo que está a la vista en lo financiero" signo={false} />,
    },
    {
      id: 'dias',
      titulo: 'Días',
      tipo: 'numero',
      ancho: 75,
      flex: 0.4,
      prioridad: 7,
      celda: (f) => (nada(f) ? NO_APLICA : <Dias f={f} />),
      orden: (f) => (nada(f) ? null : f.dias_en_posicion),
    },
  ]
}

// ───────────── Filtros ─────────────

const SELECT =
  'tocable h-9 min-w-0 rounded-item border border-border bg-surface px-2.5 pr-7 text-[13px] text-text transition-colors hover:border-border-strong max-md:h-11'

function BarraFiltros({ filas, x, setX }: { filas: FilaCartera[]; x: Filtros; setX: (f: Filtros) => void }) {
  const cuentas = [...new Set(filas.map((f) => f.cuenta))].filter(Boolean)
  const clases = [...new Set(filas.map((f) => f.tipo))]
  const toggle = (k: 'sinDato' | 'viejos', etiqueta: string) => (
    <button
      type="button"
      aria-pressed={x[k]}
      onClick={() => setX({ ...x, [k]: !x[k] })}
      className={`tocable inline-flex h-9 items-center rounded-full border px-3 text-[13px] transition-colors max-md:h-11 ${
        x[k] ? 'border-border-accent bg-accent-soft font-medium text-text' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text'
      }`}
    >
      {etiqueta}
    </button>
  )
  return (
    <div role="group" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="f-cuenta">
        Cuenta
      </label>
      <select id="f-cuenta" className={SELECT} value={x.cuenta} onChange={(e) => setX({ ...x, cuenta: e.target.value })}>
        <option value="">Todas las cuentas</option>
        {cuentas.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-clase">
        Clase
      </label>
      <select id="f-clase" className={SELECT} value={x.clase} onChange={(e) => setX({ ...x, clase: e.target.value })}>
        <option value="">Todas las clases</option>
        {clases.map((c) => (
          <option key={c} value={c}>
            {NOMBRE_TIPO[c] ?? c}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-moneda">
        Moneda de riesgo
      </label>
      <select id="f-moneda" className={SELECT} value={x.moneda} onChange={(e) => setX({ ...x, moneda: e.target.value })}>
        <option value="">Pesos y dólares</option>
        <option value="USD">Arriesga dólares</option>
        <option value="ARS">Arriesga pesos</option>
      </select>
      {toggle('sinDato', 'Solo con sin dato')}
      {toggle('viejos', 'Solo precios viejos')}
      {hayFiltros(x) ? (
        <button type="button" onClick={() => setX(SIN_FILTRO)} className="tocable inline-flex h-9 items-center rounded-full px-2 text-[13px] text-accent hover:underline max-md:h-11">
          Limpiar filtros
        </button>
      ) : null}
    </div>
  )
}

// ───────────── Teléfono: una tarjeta por fila ─────────────

function TarjetaPosicion({ f, hoy }: { f: FilaCartera; hoy: string | undefined }) {
  const [abierta, setAbierta] = useState(false)
  if (esLiquidez(f)) {
    const enUsd = f.moneda_riesgo === 'USD'
    return (
      <div className="rounded-tarjeta border border-border bg-surface p-4" data-tarjeta={f.nombre}>
        <div className="flex items-start justify-between gap-2">
          <Activo f={f} hoy={hoy} />
          <span className="shrink-0 text-right text-[12px] text-muted">
            <Pct calc={f.peso} titulo={`${f.nombre} · peso en lo financiero`} signo={false} />
            <span className="block">de la cartera</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3">
          <MontoTrazado calc={enUsd ? f.valor.usd : f.valor.ars} moneda={enUsd ? 'USD' : 'ARS'} titulo={`${f.nombre} · valor`} decimales={0} className="cifra text-xl" />
          <MontoTrazado calc={enUsd ? f.valor.ars : f.valor.usd} moneda={enUsd ? 'ARS' : 'USD'} titulo={`${f.nombre} · valor`} decimales={0} className="text-sm" />
        </div>
      </div>
    )
  }
  const enUsd = f.moneda_riesgo === 'USD'
  const grande = enUsd ? f.valor.usd : f.valor.ars
  const chico = enUsd ? f.valor.ars : f.valor.usd
  const d = desgloseEn(f, enUsd ? 'ARS' : 'USD')
  const resOtra = enUsd ? f.resultado.ars : f.resultado.usd
  const frase =
    d && d.tc.valor !== null && resOtra.valor !== null ? (
      <p className="mt-2 text-[13px] leading-5 text-muted">
        De tus <MontoTrazado calc={resOtra} moneda={enUsd ? 'ARS' : 'USD'} titulo={`${f.ticker} · resultado`} signo compacta /> en {enUsd ? 'pesos' : 'dólares'},{' '}
        <MontoTrazado calc={d.tc} moneda={enUsd ? 'ARS' : 'USD'} titulo={`${f.ticker} · lo que puso el CCL`} signo compacta /> fueron el CCL
      </p>
    ) : null
  return (
    <div className="rounded-tarjeta border border-border bg-surface p-4" data-tarjeta={f.ticker}>
      <div className="flex items-start justify-between gap-2">
        <Activo f={f} hoy={hoy} />
        <span className="shrink-0 text-right text-[12px] text-muted">
          <Pct calc={f.peso} titulo={`${f.ticker} · peso en lo financiero`} signo={false} />
          <span className="block">de la cartera</span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <MontoTrazado calc={grande} moneda={f.moneda_riesgo} titulo={`${f.ticker} · valor`} decimales={0} className="cifra text-xl" />
        <MontoTrazado calc={chico} moneda={enUsd ? 'ARS' : 'USD'} titulo={`${f.ticker} · valor`} decimales={0} className="text-sm" />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3">
        {(enUsd ? (['usd', 'ars'] as const) : (['ars', 'usd'] as const)).map((m, i) => (
          <div key={m} className={i === 1 ? 'text-right' : ''}>
            <dt className="rotulo text-[10px]">Res. {m.toUpperCase()}</dt>
            <dd className={`flex flex-col ${i === 1 ? 'items-end' : 'items-start'}`}>
              <MontoTrazado calc={f.resultado[m]} moneda={m === 'usd' ? 'USD' : 'ARS'} titulo={`${f.ticker} · resultado en ${m === 'usd' ? 'dólares' : 'pesos'}`} signo compacta className={tonoDe(f.resultado[m].valor)} />
              {f.resultado_pct[m].valor !== null ? <Pct calc={f.resultado_pct[m]} titulo={`${f.ticker} · resultado %`} color /> : null}
            </dd>
          </div>
        ))}
      </dl>
      {frase}
      {f.ganas_pesos_perdes_dolares ? <Chip className="mt-2">ganás en pesos, perdés en dólares</Chip> : null}
      <button type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} className="tocable mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-text">
        {abierta ? 'Menos' : 'Más datos'} <ChevronRight aria-hidden className={`size-4 transition-transform ${abierta ? 'rotate-90' : ''}`} />
      </button>
      {abierta ? (
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-2">
          <div className="min-w-0">
            <dt className="rotulo text-[10px]">Precio</dt>
            <dd>
              <MontoTrazado calc={f.precio} moneda="ARS" titulo={`${f.ticker} · precio`} decimales={decimalesPrecio(f.precio.valor)} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="rotulo text-[10px]">Cantidad</dt>
            <dd>
              <Traza calc={f.cantidad} titulo={`${f.ticker} · cantidad`}>
                {f.cantidad.valor === null ? <SinDato motivo={f.cantidad.motivo} /> : <span className="num">{numero(f.cantidad.valor, 4, { min: 0 })}</span>}
              </Traza>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="rotulo text-[10px]">PPC ARS</dt>
            <dd>
              <MontoTrazado calc={f.ppc.ars} moneda="ARS" titulo={`${f.ticker} · PPC en pesos`} decimales={decimalesPrecio(f.ppc.ars.valor)} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="rotulo text-[10px]">PPC USD</dt>
            <dd>
              <MontoTrazado calc={f.ppc.usd} moneda="USD" titulo={`${f.ticker} · PPC en dólares`} decimales={decimalesPrecio(f.ppc.usd.valor)} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="rotulo text-[10px]">Días</dt>
            <dd>
              <Dias f={f} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="rotulo text-[10px]">Activo · TC</dt>
            <dd className="pt-2">
              <BarraActivoTc activo={desgloseEn(f, 'ARS')?.activo.valor ?? null} tc={desgloseEn(f, 'ARS')?.tc.valor ?? null} traza={trazaActivoTc(f)} titulo={`${f.ticker} · resultado: activo y tipo de cambio`} />
            </dd>
          </div>
        </dl>
      ) : null}
      {abierta && f.pendiente ? <p className="mt-2 text-[13px] text-muted">{f.pendiente}</p> : null}
    </div>
  )
}

// ───────────── La tabla ─────────────

export function TablaCartera({ v }: { v: VistaCartera }) {
  const [x, setX] = useState<Filtros>(SIN_FILTRO)
  // Con el dedo (una tablet), cada cifra es un tocable de 44 px y las celdas tienen dos, una arriba de la otra (D-100).
  const grueso = useMedia('(pointer: coarse)', false)
  const visibles = useMemo(() => v.filas.filter((f) => pasa(f, x)), [v.filas, x])
  const tot = useMemo(() => totalesCartera(visibles, v), [visibles, v])
  const maximo = useMemo(() => pesoMaximo(v.filas), [v.filas])
  const filtrado = hayFiltros(x)
  const cols = useMemo(() => columnas(tot, maximo, v.hoy, filtrado), [tot, maximo, v.hoy, filtrado])
  const posiciones = v.filas.filter((f) => !esLiquidez(f)).length
  const parciales = sumasParciales(tot)
  const notas = notasPendientes(visibles)
  const sinAtribuir = sinAtribuirHoy(visibles)
  const cuentasLiq = v.filas.filter(esLiquidez).length
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[13px] text-muted" aria-live="polite">
          {tot.posiciones} de {posiciones} posiciones{cuentasLiq ? ` y ${cuentasLiq} saldos de liquidez` : ''}
          {v.fecha_datos ? ` · al cierre del ${fechaCorta(v.fecha_datos)}` : ''} · CCL{' '}
          <Traza calc={v.ccl} titulo="CCL de la foto">
            {v.ccl.valor === null ? <SinDato /> : <span className="num">{numero(v.ccl.valor, 2)}</span>}
          </Traza>
          {v.fecha_ccl && v.fecha_datos && v.fecha_ccl !== v.fecha_datos ? ` del ${fechaCorta(v.fecha_ccl)} (ese día no cargaste CCL)` : ''} <ChipEtiqueta calc={v.ccl} />
        </p>
        <BarraFiltros filas={v.filas} x={x} setX={setX} />
      </div>

      <Grilla
        titulo="Posiciones, en pesos y en dólares"
        filas={visibles}
        columnas={cols}
        idFila={(f) => f.clave}
        nombreFila={(f) => (esLiquidez(f) ? f.nombre : f.ticker)}
        ordenInicial={{ columna: 'valor', direccion: 'desc' }}
        altoFila={grueso ? 100 : 52}
        tarjeta={(f) => <TarjetaPosicion f={f} hoy={v.hoy} />}
        vacio={<Aviso>Ninguna posición con esos filtros.</Aviso>}
        className="[&_.ag-cell[col-id=activo]]:pl-3 [&_.ag-cell[col-id=dias]]:pr-3 [&_.ag-header-cell[col-id=activo]]:pl-3 [&_.ag-header-cell[col-id=dias]]:pr-3 [&_.ag-header-row]:[--ag-cell-horizontal-padding:6px] [&_.ag-row]:[--ag-cell-horizontal-padding:6px]"
      />

      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-text" />
          Resultado del activo
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-viz" />
          Resultado del tipo de cambio
        </span>
        <span>Días: «ap.», desde la apertura en la app; «decl.», desde la fecha de compra que declaraste.</span>
        {parciales.length ? (
          <span>
            ¹ Suma parcial: {parciales.map((p) => `en ${p.columna}, ${p.cuantas > 1 ? 'faltan' : 'falta'} ${p.faltan}`).join('; ')}.
          </span>
        ) : null}
      </div>
      {/* Lo pendiente de cada fila, a la vista (en el teléfono, lo pendiente va en "Más datos" de su tarjeta). */}
      {notas.length || sinAtribuir.length ? (
        <ul aria-label="Lo pendiente" className="flex flex-col gap-1 text-[12px] leading-relaxed text-muted max-md:hidden">
          {notas.map((n) => (
            <li key={n.texto}>
              <span className="font-medium text-text">{n.quienes}:</span> {n.texto}
            </li>
          ))}
          {sinAtribuir.map((s) => (
            <li key={s.ticker}>
              <span className="font-medium text-text">{s.ticker}:</span> sin atribuir hoy (sin precio o CCL nuevo){' '}
              <MontoTrazado calc={s.calc} moneda={s.moneda} titulo={`${s.ticker} · sin atribuir`} signo decimales={s.moneda === 'ARS' ? 0 : 2} />.
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
