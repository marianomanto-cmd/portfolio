import { ArrowRight, CircleAlert, Database, Info, Upload } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { CalcVista } from '@/lib/domain/calc'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import { modoDemo } from '@/lib/server/sesion'
import { ejemploHoyVariante, varianteDemo } from '@/lib/vistas/ejemplo'
import type { FraseDelDia, Pendiente, TarjetaPatrimonio, VistaHoy } from '@/lib/vistas/contratos'
import { ErrorVista } from '@/components/error-vista'
import { Frase, type FilaDetalle, type ParteMostrada } from '@/components/hoy/frase'
import { Mostrar } from '@/components/hoy/redondeo-frase'
import { cargaPendiente, parcialDeTotal } from '@/components/calculos'
import { Monto, MontoTrazado, Porcentaje, SinDato } from '@/components/monto'
import { hoyDelPedido } from '@/components/shell/datos'
import { Traza } from '@/components/traza'
import { Aviso, Chip, ChipEtiqueta, Rotulo, Tarjeta } from '@/components/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Hoy' }

export default async function PaginaHoy({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  let v: VistaHoy
  try {
    const variante = modoDemo() ? varianteDemo(sp.demo) : null
    v = variante ? ejemploHoyVariante(variante) : await hoyDelPedido()
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Hoy</h1>
        <ErrorVista error={e} que="tus datos de hoy" />
      </>
    )
  }
  if (!v.hay_datos) return <DiaCero v={v} />

  const m = new Mostrar(v.frase, [v.financiero, v.total])
  // Después del cierre de BYMA (el ejemplo del modo demo no tiene hora: vale siempre).
  const pendienteCarga = modoDemo() ? v.es_habil_hoy && !v.cargo_hoy : cargaPendiente(v, new Date())

  return (
    <div className="flex flex-col gap-2 md:gap-4">
      <h1 className="sr-only">
        Hoy, {fechaLarga(v.hoy)}. Datos al cierre del {v.fecha_datos ? fechaCorta(v.fecha_datos) : '—'}
      </h1>
      {v.fecha_ccl && v.fecha_datos && v.fecha_ccl !== v.fecha_datos ? (
        <Aviso>
          El {fechaCorta(v.fecha_datos)} no tiene CCL: los dólares usan el{' '}
          <Traza calc={v.ccl} titulo="CCL que se usa">
            <span className="num">CCL del {fechaCorta(v.fecha_ccl)}</span>
          </Traza>{' '}
          y el cambio del día queda sin atribuir.
        </Aviso>
      ) : null}
      {v.aviso_fin_de_anio ? <Aviso>{v.aviso_fin_de_anio}</Aviso> : null}

      <div className="flex flex-col gap-2 md:gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start min-[112.5rem]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_24rem]">
        {/* Columna 1: la frase y las dos tarjetas */}
        <div className="order-1 flex flex-col gap-2 md:gap-4 xl:col-start-1 xl:row-start-1">
          <Tarjeta className="px-3 pb-1 pt-3 md:p-5" aria-label="Qué pasó desde la última carga">
            {v.frase ? (
              <Frase partes={partesFrase(v.frase, m)} detalle={detalleFrase(v.frase, m)} recortar />
            ) : (
              <p className="pb-2 text-[15px] leading-6 md:text-base">
                Primera carga guardada. Mañana vas a ver qué cambió y por qué.
              </p>
            )}
          </Tarjeta>
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            <TarjetaKpi t={v.financiero} m={m} corto="Financiero" desglose />
            <TarjetaKpi t={v.total} m={m} corto="Total" />
          </div>
        </div>

        {/* Atención: columna derecha desde 1280 px; en el teléfono, un renglón */}
        <aside
          aria-label="Atención"
          className="order-2 hidden md:block xl:col-start-2 xl:row-span-2 xl:row-start-1 min-[112.5rem]:col-start-3 min-[112.5rem]:row-span-1"
        >
          <Atencion pendientes={v.atencion} />
        </aside>

        {/* Columna 2: exposición, carga, excedente, quién movió, cuadre */}
        <div className="order-3 flex flex-col gap-2 md:gap-4 xl:col-start-1 xl:row-start-2 min-[112.5rem]:col-start-2 min-[112.5rem]:row-start-1">
          <LineaExposicion v={v} />
          <AtencionRenglon pendientes={v.atencion} />
          {pendienteCarga ? (
            <Link
              href="/carga"
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent-soft px-4 text-[15px] font-medium text-accent transition-colors hover:border-accent"
            >
              <span className="flex items-center gap-2">
                <Upload aria-hidden className="size-5" />
                Todavía no cargaste hoy
              </span>
              <span className="flex items-center gap-1">
                Cargar <ArrowRight aria-hidden className="size-4" />
              </span>
            </Link>
          ) : null}
          <Excedente hoy={v.hoy} />
          {v.movimientos.length ? <QuienMovio v={v} /> : null}
          <Cuadre v={v} />
        </div>
      </div>
    </div>
  )
}

// ───────────── La frase ─────────────

const tono = (c: CalcVista, valor: string | null): ParteMostrada['tono'] =>
  valor === null || /^-?0(\.0+)?$/.test(valor) ? null : valor.startsWith('-') ? 'neg' : 'pos'

function partesFrase(f: FraseDelDia, m: Mostrar): ParteMostrada[] {
  return f.partes.map((p, i) => {
    if (!p.calc) return { texto: p.texto, calc: null, tono: null, esMonto: false, titulo: '' }
    const c = p.calc
    const esPct = p.texto.trim().endsWith('%')
    if (esPct || c.valor === null) return { texto: p.texto, calc: c, tono: null, esMonto: !esPct, titulo: tituloParte(f, i) }
    const moneda = p.texto.includes('US$') ? 'USD' : 'ARS'
    const conSigno = /^[+−-]/.test(p.texto.trim())
    const texto = m.texto(c, moneda, { signo: conSigno, abs: !conSigno })
    return { texto, calc: c, tono: conSigno ? tono(c, m.valor(c)) : null, esMonto: true, titulo: tituloParte(f, i) }
  })
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * El nombre que la frase le da a una cifra que no es la variación, los
 * activos, el CCL ni lo sin atribuir: el grupo que la sigue ("de SPY", "de tus
 * pesos en efectivo", en la segunda oración de una carga express).
 */
function nombreDeParte(f: FraseDelDia, i: number): string | null {
  const sig = f.partes[i + 1]
  if (!sig || sig.calc) return null
  const t = sig.texto.trim().replace(/[.,;:]+$/, '')
  return /^de /.test(t) ? t : null
}

function tituloParte(f: FraseDelDia, i: number): string {
  const p = f.partes[i]
  const c = p.calc!
  if (mismo(c, f.variacion.ars)) return 'Variación en pesos'
  if (mismo(c, f.variacion.usd)) return 'Variación en dólares'
  if (mismo(c, f.tc.ars)) return 'Lo que puso el CCL, en pesos'
  if (mismo(c, f.tc.usd)) return 'Lo que puso el CCL, en dólares'
  if (mismo(c, f.activos.ars)) return 'Lo que pusieron tus activos, en pesos'
  if (mismo(c, f.activos.usd)) return 'Lo que pusieron tus activos, en dólares'
  if (f.sin_atribuir && (mismo(c, f.sin_atribuir.ars) || mismo(c, f.sin_atribuir.usd))) return 'Sin atribuir (sin precio o saldo nuevo)'
  if (p.texto.trim().endsWith('%')) return 'Variación porcentual'
  const en = p.texto.includes('US$') ? 'en dólares' : 'en pesos'
  const nombre = nombreDeParte(f, i)
  return nombre ? `${mayuscula(nombre)}, ${en}` : `Cifra de la frase, ${en}`
}
const mismo = (a: CalcVista, b: CalcVista) => a.valor === b.valor && a.formula === b.formula

function detalleFrase(f: FraseDelDia, m: Mostrar): FilaDetalle[] {
  const parte = (c: CalcVista, moneda: 'ARS' | 'USD', titulo: string): ParteMostrada => ({
    texto: m.texto(c, moneda, { signo: true }),
    calc: c,
    tono: tono(c, m.valor(c)),
    esMonto: true,
    titulo,
  })
  const filas: FilaDetalle[] = [
    { etiqueta: 'Variación', ars: parte(f.variacion.ars, 'ARS', 'Variación en pesos'), usd: parte(f.variacion.usd, 'USD', 'Variación en dólares') },
    { etiqueta: 'Por tus activos', ars: parte(f.activos.ars, 'ARS', 'Tus activos, en pesos'), usd: parte(f.activos.usd, 'USD', 'Tus activos, en dólares') },
    { etiqueta: 'Por el CCL', ars: parte(f.tc.ars, 'ARS', 'El CCL, en pesos'), usd: parte(f.tc.usd, 'USD', 'El CCL, en dólares') },
  ]
  if (f.sin_atribuir) {
    filas.push({ etiqueta: 'Sin atribuir', ars: parte(f.sin_atribuir.ars, 'ARS', 'Sin atribuir, en pesos'), usd: parte(f.sin_atribuir.usd, 'USD', 'Sin atribuir, en dólares') })
  }
  // Las demás cifras de la frase (la segunda oración de una carga express),
  // cada una en su renglón tocable con el nombre que le da la frase (D-113).
  // Una cifra igual a otra que ya está arriba no se repite.
  const vistas: CalcVista[] = filas.flatMap((x) => [x.ars?.calc, x.usd?.calc]).filter((c): c is CalcVista => Boolean(c))
  const extra = new Map<string, FilaDetalle>()
  f.partes.forEach((p, i) => {
    const c = p.calc
    if (!c || p.texto.trim().endsWith('%') || vistas.some((x) => mismo(x, c))) return
    const lado = p.texto.includes('US$') ? 'usd' : 'ars'
    const base = mayuscula(nombreDeParte(f, i) ?? 'En la frase')
    let etiqueta = base
    for (let n = 2; extra.get(etiqueta)?.[lado]; n++) etiqueta = `${base} (${n})`
    const fila = extra.get(etiqueta) ?? { etiqueta, ars: null, usd: null }
    fila[lado] = parte(c, lado === 'usd' ? 'USD' : 'ARS', tituloParte(f, i))
    extra.set(etiqueta, fila)
    vistas.push(c)
  })
  return [...filas, ...extra.values()]
}

// ───────────── Las dos tarjetas ─────────────

const esCero = (c: CalcVista) => c.valor !== null && /^-?0(\.0+)?$/.test(c.valor)

function Cifra({ c, moneda, m, titulo, signo = false, color = false, className = '' }: { c: CalcVista; moneda: 'ARS' | 'USD'; m: Mostrar; titulo: string; signo?: boolean; color?: boolean; className?: string }) {
  return (
    <Traza calc={c} titulo={titulo} moneda={moneda}>
      {c.valor === null ? (
        <SinDato motivo={c.motivo} />
      ) : (
        <Monto valor={m.valor(c)} moneda={moneda} decimales={0} signo={signo} color={color} className={className} />
      )}
    </Traza>
  )
}

/**
 * Un total al que le falta una parte es "sin dato", y debajo, en gris, va la
 * suma de lo que sí se conoce, rotulada como parcial (D-65).
 */
function SumaParcial({ t, className = '' }: { t: TarjetaPatrimonio; className?: string }) {
  const ars = parcialDeTotal(t.valor.ars, 'ARS')
  const usd = parcialDeTotal(t.valor.usd, 'USD')
  if (!ars?.parcial && !usd?.parcial) return null
  const rotulo = (x: { contadas: number; de: number }) => `suma parcial (${x.contadas} de ${x.de}): `
  const misma = ars && usd && ars.contadas === usd.contadas && ars.de === usd.de
  return (
    <p className={`flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-6 text-muted ${className}`}>
      {ars?.parcial ? (
        <span className="inline-flex items-baseline gap-1.5">
          {rotulo(ars)}
          <MontoTrazado calc={ars.parcial} moneda="ARS" titulo={`${t.titulo} · suma parcial en pesos`} decimales={0} />
        </span>
      ) : null}
      {usd?.parcial ? (
        <span className="inline-flex items-baseline gap-1.5">
          {ars?.parcial ? '·' : null} {misma ? null : rotulo(usd)}
          <MontoTrazado calc={usd.parcial} moneda="USD" titulo={`${t.titulo} · suma parcial en dólares`} decimales={0} />
        </span>
      ) : null}
    </p>
  )
}

function TarjetaKpi({ t, m, corto, desglose = false }: { t: TarjetaPatrimonio; m: Mostrar; corto: string; desglose?: boolean }) {
  const titulo = t.titulo
  return (
    <Tarjeta aria-label={titulo} className="px-3 py-1.5 md:p-5">
      {/* Teléfono: dos renglones de 44 px (visión §4.1, 112 px por tarjeta) */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 md:hidden">
        <div className="row-span-2 flex flex-col items-start gap-1 self-center">
          <Rotulo as="h2">{corto}</Rotulo>
          <ChipEtiqueta calc={t.valor.ars} omitir={['parcial']} />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <Cifra c={t.valor.ars} moneda="ARS" m={m} titulo={`${titulo} · en pesos`} className="text-[17px] font-semibold" />
          {t.variacion_pct ? <Porcentaje calc={t.variacion_pct.ars} titulo={`${titulo} · variación en pesos`} color /> : null}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <Cifra c={t.valor.usd} moneda="USD" m={m} titulo={`${titulo} · en dólares`} className="text-[15px] font-semibold" />
          {t.variacion_pct ? <Porcentaje calc={t.variacion_pct.usd} titulo={`${titulo} · variación en dólares`} color /> : null}
        </div>
        <SumaParcial t={t} className="col-span-2 justify-end pb-1" />
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between gap-2">
          <Rotulo as="h2">{titulo}</Rotulo>
          <ChipEtiqueta calc={t.valor.ars} omitir={['parcial']} />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Cifra c={t.valor.ars} moneda="ARS" m={m} titulo={`${titulo} · en pesos`} className="cifra text-[28px] font-semibold leading-9 xl:text-[32px]" />
          <Cifra c={t.valor.usd} moneda="USD" m={m} titulo={`${titulo} · en dólares`} className="cifra text-[22px] font-semibold leading-8 xl:text-2xl" />
        </div>
        <SumaParcial t={t} className="mt-1" />
        {t.variacion ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
            <span className="inline-flex items-center gap-2">
              <Cifra c={t.variacion.ars} moneda="ARS" m={m} titulo={`${titulo} · variación en pesos`} signo color />
              {t.variacion_pct ? <Porcentaje calc={t.variacion_pct.ars} titulo={`${titulo} · variación % en pesos`} color={false} /> : null}
            </span>
            <span className="inline-flex items-center gap-2">
              <Cifra c={t.variacion.usd} moneda="USD" m={m} titulo={`${titulo} · variación en dólares`} signo color />
              {t.variacion_pct ? <Porcentaje calc={t.variacion_pct.usd} titulo={`${titulo} · variación % en dólares`} color={false} /> : null}
            </span>
          </div>
        ) : null}
        {desglose && t.desglose ? (
          <dl className="mt-3 grid grid-cols-[auto_auto_auto] justify-start gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
            <dt className="text-muted">activos</dt>
            <dd>
              <Cifra c={t.desglose.activos.ars} moneda="ARS" m={m} titulo="Lo que pusieron tus activos, en pesos" signo />
            </dd>
            <dd>
              <Cifra c={t.desglose.activos.usd} moneda="USD" m={m} titulo="Lo que pusieron tus activos, en dólares" signo />
            </dd>
            <dt className="text-muted">CCL</dt>
            <dd>
              <Cifra c={t.desglose.tc.ars} moneda="ARS" m={m} titulo="Lo que puso el CCL, en pesos" signo />
            </dd>
            <dd>
              <Cifra c={t.desglose.tc.usd} moneda="USD" m={m} titulo="Lo que puso el CCL, en dólares" signo />
            </dd>
            {esCero(t.desglose.sin_atribuir.ars) && esCero(t.desglose.sin_atribuir.usd) ? null : (
              <>
                <dt className="text-muted">sin atribuir</dt>
                <dd>
                  <Cifra c={t.desglose.sin_atribuir.ars} moneda="ARS" m={m} titulo="Sin atribuir, en pesos" signo />
                </dd>
                <dd>
                  <Cifra c={t.desglose.sin_atribuir.usd} moneda="USD" m={m} titulo="Sin atribuir, en dólares" signo />
                </dd>
              </>
            )}
          </dl>
        ) : null}
        {t.notas.length ? (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[13px] leading-5 text-muted">
            {t.notas.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Tarjeta>
  )
}

// ───────────── Pesos financieros − deuda del leasing ─────────────

function LineaExposicion({ v }: { v: VistaHoy }) {
  const e = v.exposicion
  const neto = e.neto_ars.valor
  const lado = neto === null ? null : neto.startsWith('-') ? 'corto' : 'largo'
  const sens = e.sensibilidad_usd_1pct.valor
  const verbo = sens === null ? null : sens.startsWith('-') ? 'pierde' : 'gana'
  return (
    <Tarjeta as="div" className="px-3 md:px-5 md:py-3">
      {/* Teléfono: un renglón de 48 px. Si no entra, baja el rótulo a dos
          renglones y los montos quedan enteros adentro de la tarjeta (D-30). */}
      <div className="flex min-h-12 items-center justify-between gap-2 text-[13px] md:hidden">
        <Link href="/exposicion" className="tocable inline-flex min-w-0 items-center font-medium text-text">
          Pesos fin. − leasing
        </Link>
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          {lado ? <span className="text-muted">{lado}</span> : null}
          <MontoTrazado calc={e.neto_ars} moneda="ARS" titulo="Pesos financieros − deuda del leasing" compacta />
          <MontoTrazado calc={e.neto_usd} moneda="USD" titulo="El neto en dólares" decimales={0} />
        </span>
      </div>
      {/* Desktop */}
      <div className="hidden flex-wrap items-center gap-x-2 gap-y-1 text-[15px] md:flex">
        <Link href="/exposicion" className="tocable-lg inline-flex items-center font-medium text-text hover:underline">
          Pesos financieros − deuda del leasing:
        </Link>
        {lado ? <span className="text-muted">{lado}</span> : null}
        <MontoTrazado calc={e.neto_ars} moneda="ARS" titulo="Pesos financieros − deuda del leasing" />
        <span className="text-muted">
          (<MontoTrazado calc={e.pesos_financieros.ars} moneda="ARS" titulo="Pesos financieros" compacta /> −{' '}
          <MontoTrazado calc={e.deuda_pesos.ars} moneda="ARS" titulo="Deuda del leasing (capital pendiente)" compacta />)
        </span>
        <MontoTrazado calc={e.neto_usd} moneda="USD" titulo="El neto en dólares" decimales={0} />
        {verbo ? (
          <span className="text-muted">
            · si el CCL sube 1%, {verbo}{' '}
            <Traza calc={e.sensibilidad_usd_1pct} titulo="Sensibilidad: si el CCL sube 1%" moneda="USD">
              <Monto valor={sens ? sens.replace(/^-/, '') : null} moneda="USD" decimales={0} />
            </Traza>
          </span>
        ) : null}
      </div>
    </Tarjeta>
  )
}

// ───────────── Atención ─────────────

function Atencion({ pendientes }: { pendientes: Pendiente[] }) {
  const primeros = pendientes.slice(0, 3)
  const resto = pendientes.slice(3)
  return (
    <Tarjeta className="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <Rotulo>Atención</Rotulo>
        <span className="text-[13px] text-muted">{pendientes.length ? `${pendientes.length} pendiente${pendientes.length > 1 ? 's' : ''} de datos` : 'nada pendiente'}</span>
      </div>
      {pendientes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Tus datos están completos. Nada que revisar.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {primeros.map((p) => (
            <ItemPendiente key={p.id} p={p} />
          ))}
        </ul>
      )}
      {resto.length ? (
        <details className="group mt-1">
          <summary className="tocable flex cursor-pointer list-none items-center gap-1 py-2 text-sm font-medium text-accent">
            {resto.length} pendiente{resto.length > 1 ? 's' : ''} más <span className="transition-transform group-open:rotate-90">▸</span>
          </summary>
          <ul className="divide-y divide-border">
            {resto.map((p) => (
              <ItemPendiente key={p.id} p={p} />
            ))}
          </ul>
        </details>
      ) : null}
    </Tarjeta>
  )
}

function ItemPendiente({ p }: { p: Pendiente }) {
  const Icono = p.gravedad === 'alta' ? CircleAlert : Info
  return (
    <li className="flex items-start gap-3 py-3">
      <Icono aria-hidden className={`mt-0.5 size-4 shrink-0 ${p.gravedad === 'alta' ? 'text-accent' : 'text-muted'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{p.titulo}</p>
        <p className="text-[13px] leading-5 text-muted">{p.detalle}</p>
      </div>
      {p.accion ? (
        <Link
          href={p.accion.href}
          className="tocable inline-flex h-8 shrink-0 items-center rounded-lg border border-border px-2.5 text-[13px] font-medium text-accent hover:bg-surface-2"
        >
          {p.accion.etiqueta}
        </Link>
      ) : null}
    </li>
  )
}

/** En el teléfono, Atención es un solo renglón que se despliega (visión §4.1). */
function AtencionRenglon({ pendientes }: { pendientes: Pendiente[] }) {
  if (!pendientes.length) return null
  return (
    <details className="group rounded-xl border border-border bg-surface shadow-[var(--shadow)] md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm">
        <span>
          <span className="font-semibold">Atención</span>
          <span className="text-muted"> · {pendientes.length} pendiente{pendientes.length > 1 ? 's' : ''} de datos</span>
        </span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <ul className="divide-y divide-border border-t border-border px-3">
        {pendientes.map((p) => (
          <ItemPendiente key={p.id} p={p} />
        ))}
      </ul>
    </details>
  )
}

// ───────────── Lo que llega en otra fase, el cuadre y quién movió ─────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function Excedente({ hoy }: { hoy: string }) {
  const mes = MESES[Number(hoy.slice(5, 7)) - 1]
  return (
    <p className="px-1 text-sm text-muted">
      Excedente de {mes}: <span className="italic">sin dato</span> · llega con Flujo (fase 2)
    </p>
  )
}

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
    <p className="px-1 text-[13px] text-muted">
      <span className="font-medium text-text">Cuadre {simbolo}</span>{' '}
      {cifras ? ok ? <>cierra (diferencia {cifras}). </> : <>no cierra por {cifras}. </> : null}
      {c.detalle}
    </p>
  )
}

function QuienMovio({ v }: { v: VistaHoy }) {
  const desde = v.frase ? fechaCorta(v.frase.desde) : null
  return (
    <details className="group rounded-xl border border-border bg-surface shadow-[var(--shadow)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm md:px-5">
        <span>
          <span className="font-medium">Quién movió tu financiero</span>
          {desde ? <span className="text-muted"> · desde el {desde}</span> : null}
        </span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <ul className="divide-y divide-border border-t border-border px-3 md:px-5">
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

// ───────────── Día cero ─────────────

function DiaCero({ v }: { v: VistaHoy }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Hoy · Día cero</h1>
      <Tarjeta className="p-5 md:p-8">
        <Rotulo as="p">Día cero · {fechaLarga(v.hoy)}</Rotulo>
        <p className="mt-3 max-w-[60ch] text-xl font-semibold leading-snug tracking-tight md:text-2xl">Todavía no hay datos: arrancá por acá.</p>
        <p className="mt-3 max-w-[70ch] text-[15px] leading-6 text-muted">
          Primero cargá en Datos tus cuentas, el catálogo (cada activo con su moneda de riesgo), la casa, la camioneta y el leasing. Después hacé tu primera
          carga: CCL, cripto, el Excel de IEB y las capturas de Galicia y Mercado Pago.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/carga"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[15px] font-medium text-on-accent hover:bg-accent-strong"
          >
            <Upload aria-hidden className="size-5" /> Hacer la primera carga
          </Link>
          <Link
            href="/datos"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-[15px] font-medium hover:bg-surface-2"
          >
            <Database aria-hidden className="size-5" /> Ir a Datos
          </Link>
        </div>
      </Tarjeta>
      <p className="px-1 text-sm text-muted">
        Ningún número aparece en cero mientras falte: dice “sin dato” y qué hace falta.
      </p>
    </div>
  )
}
