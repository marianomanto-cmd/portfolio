// Los bloques de Evolución y PnL (plan §4 B.1), en el orden de la pantalla.
// Server Components sin cálculos: cada cifra llega armada, con su traza.

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Moneda } from '@/lib/domain/tipos'
import type { Par } from '@/lib/vistas/contratos'
import type {
  ContribuyenteVista,
  DiaCeroVista,
  FilaResultado,
  FuturoVista,
  LineaPuenteVista,
  MesVista,
  MonedaElegida,
  PuenteVista,
  ResultadosVista,
  SensibilidadVista,
  TotalesResultado,
  VistaEvolucion,
} from '@/lib/vistas/contratos-evolucion'
import { MOTIVO_SEGUNDA_CARGA } from '@/lib/domain/resultados'
import { textoPeriodo } from '@/lib/vistas/armar-evolucion'
import { Traza } from '@/components/traza'
import { Aviso, Boton, Chip, Rotulo, Tarjeta } from '@/components/ui'
import { Cifra, CifraPar, CifraPct, ChipEtiquetas, ChipPar, FraseVista, MotivoPar, monedasDe } from './cifras'
import { hrefEvolucion } from '../_lib/parametros'
import { GraficoContribuyentes, GraficoMeses, GraficoPuente, GraficosPatrimonio } from './graficos'
import { GrillaDiaCero, GrillaFuturo, GrillaMeses } from './grillas'
import { TablaResultados } from './tabla-resultados'

const enLaMoneda = (m: MonedaElegida): Moneda => (m === 'usd' ? 'USD' : 'ARS')
const nombreVista = (v: VistaEvolucion) => (v.parametros.vista === 'total' ? 'total' : 'financiero')

function Titulo({ id, children, extra }: { id: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Rotulo as="h3">
        <span id={id}>{children}</span>
      </Rotulo>
      {extra ? <span className="text-[13px] text-muted">{extra}</span> : null}
    </div>
  )
}

// ───────────── El período en una frase (primera tarjeta del detalle) ─────────────

export function ResumenPeriodo({ v }: { v: VistaEvolucion }) {
  if (v.estado === 'un_dia' && v.primera) {
    return (
      <Tarjeta className="p-4 md:p-6" aria-label="Tu punto de partida">
        <Rotulo as="p">Día cero · {fechaCorta(v.primera)}</Rotulo>
        <p className="mt-2 text-[17px] font-semibold leading-7 md:text-xl md:leading-8">
          Tu historia empieza el {fechaCorta(v.primera)}:{' '}
          {v.inicio ? <CifraPar par={v.inicio} moneda={v.parametros.moneda} titulo={`Tu patrimonio ${nombreVista(v)} el día cero`} /> : null} {nombreVista(v)}.{' '}
          {v.inicio ? <ChipPar par={v.inicio} /> : null}
        </p>
        <p className="mt-1 text-[15px] leading-6 text-muted">Con tu próxima carga vas a ver acá qué cambió y por qué: por tus activos, por el dólar o por la plata que entró y salió.</p>
        {v.inicio ? <MotivoPar par={v.inicio} className="mt-2 block" /> : null}
      </Tarjeta>
    )
  }
  if (v.estado !== 'periodo' || !v.desde || !v.hasta) return null
  return (
    <Tarjeta className="p-4 md:p-5" aria-label="Qué pasó en el período">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <Rotulo as="p">
          {textoPeriodo(v.desde, v.hasta)} · {nombreVista(v)}
        </Rotulo>
        {v.actual ? (
          <span className="text-[13px] text-muted">
            al {fechaCorta(v.hasta)}: <CifraPar par={v.actual} moneda={v.parametros.moneda} titulo={`Tu patrimonio ${nombreVista(v)} al ${fechaCorta(v.hasta)}`} />{' '}
            <ChipPar par={v.actual} />
          </span>
        ) : null}
      </div>
      {/* La frase es la de Hoy: habla de tu financiero. En la vista Total se dice, para no mezclarla con el puente total. */}
      {v.frase && v.parametros.vista === 'total' ? <p className="text-[13px] font-medium text-muted">Tu financiero (títulos y liquidez):</p> : null}
      {v.frase ? <FraseVista f={v.frase} /> : null}
    </Tarjeta>
  )
}

// ───────────── El puente ─────────────

const SIGNO: Record<string, string> = { inicial: '', final: '=', informativa: '' }

function FilaPuente({ l, moneda, unDia }: { l: LineaPuenteVista; moneda: MonedaElegida; unDia: boolean }) {
  const total = l.clave === 'inicial' || l.clave === 'final'
  return (
    <li className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 ${l.informativa ? 'pl-4 text-[13px] text-muted' : ''} ${l.clave === 'final' ? 'border-t border-border font-semibold' : ''}`}>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        {SIGNO[l.clave] ? <span aria-hidden className="text-muted">{SIGNO[l.clave]}</span> : null}
        <span className="min-w-0">{l.nombre}</span>
        <ChipPar par={l.valor} />
      </span>
      <CifraPar par={l.valor} moneda={moneda} titulo={l.nombre} signo={!total} color={['activo', 'tc', 'sin_atribuir'].includes(l.clave)} />
      {/* Con una sola carga el porqué es el mismo en todas: va una vez, abajo (y en la traza de cada una). */}
      {l.valor.ars.valor === null && l.valor.usd.valor === null && !total && !unDia ? <MotivoPar par={l.valor} className="basis-full" /> : null}
    </li>
  )
}

export function BloquePuente({ v, puente }: { v: VistaEvolucion; puente: PuenteVista }) {
  const moneda = v.parametros.moneda
  const ms = monedasDe(moneda)
  const unDia = v.estado === 'un_dia'
  return (
    <Tarjeta className="@container p-4 md:p-5" aria-labelledby="puente">
      <Titulo id="puente" extra={unDia ? 'necesita una segunda carga' : textoPeriodo(puente.desde, puente.hasta)}>
        El puente: de dónde vino el cambio
      </Titulo>
      {!unDia ? (
        <div className={`mb-3 hidden gap-4 md:grid ${ms.length > 1 ? '@min-[760px]:grid-cols-2' : ''}`}>
          {ms.map((m) => (
            <GraficoPuente key={m} lineas={puente.lineas} contribuyentes={v.contribuyentes} moneda={m} />
          ))}
          <p className="text-[13px] text-muted @min-[760px]:col-span-2">Tocá un escalón: en «activos» y «dólar» ves quiénes más sumaron y restaron; en los demás, su cálculo.</p>
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {puente.lineas.map((l) => (
          <FilaPuente key={l.clave} l={l} moneda={moneda} unDia={unDia} />
        ))}
      </ul>
      {unDia ? (
        <p className="mt-2 text-[13px] text-muted">
          <span className="font-medium text-text">Necesita una segunda carga:</span> con tu próxima carga cada línea se completa y el cuadre (final − inicial − cada línea = 0) se
          verifica.
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-muted">
          <span className="font-medium text-text">Cuadre {puente.cuadre.ok === null ? '○' : puente.cuadre.ok ? '✓' : '≠'}</span>{' '}
          {puente.cuadre.ok !== null ? (
            <>
              <CifraPar par={puente.cuadre.diferencia} moneda={moneda} titulo="Cuadre del puente: diferencia" signo={!puente.cuadre.ok} /> ·{' '}
            </>
          ) : null}
          {puente.cuadre.detalle}
        </p>
      )}
      {puente.cuotas_fuera.length ? (
        <Aviso className="mt-2">
          {puente.cuotas_fuera.length === 1 ? 'Una cuota del leasing no entra al puente: ' : `${puente.cuotas_fuera.length} cuotas del leasing no entran al puente: `}
          {puente.cuotas_fuera.join(' ')}
        </Aviso>
      ) : null}
    </Tarjeta>
  )
}

// ───────────── Quién sumó y quién restó ─────────────

export function BloqueContribuyentes({ v }: { v: VistaEvolucion }) {
  const m = enLaMoneda(v.parametros.moneda)
  if (!v.contribuyentes.length) return null
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="quien">
      <Titulo id="quien" extra={m === 'ARS' ? 'en pesos' : 'en dólares'}>
        Quién sumó y quién restó
      </Titulo>
      <GraficoContribuyentes cs={v.contribuyentes} moneda={m} />
      <p className="mt-1 text-[13px] text-muted">
        Sólido: por el precio del activo. Rayado: por el dólar. Tocá una barra para ver su cálculo.{' '}
        <a href="#resultados" className="tocable inline-flex items-center font-medium text-accent hover:underline md:hidden">
          Ver todos ▸
        </a>
      </p>
      <ListaContribuyentes cs={v.contribuyentes.slice(0, 3)} moneda={v.parametros.moneda} />
    </Tarjeta>
  )
}

function ListaContribuyentes({ cs, moneda }: { cs: ContribuyenteVista[]; moneda: MonedaElegida }) {
  return (
    <ul className="mt-2 divide-y divide-border border-t border-border">
      {cs.map((c) => (
        <li key={c.clave} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
            <span className="truncate">{c.nombre}</span>
          </span>
          <CifraPar par={c.resultado} moneda={moneda} titulo={`${c.nombre} · resultado del período`} signo color />
        </li>
      ))}
    </ul>
  )
}

// ───────────── Resultados por activo y cuenta ─────────────

function NoAplica() {
  return <span className="text-[13px] italic text-muted">no aplica</span>
}

export function BloqueResultados({ v, totales }: { v: VistaEvolucion; totales: TotalesResultado }) {
  const noAplica = [...new Set(v.filas.map((f) => f.no_aplica).filter((x): x is string => Boolean(x)))]
  return (
    <Tarjeta className="@container p-4 md:p-5" aria-labelledby="resultados">
      <Titulo id="resultados" extra="realizado: lo que vendiste o cobraste · no realizado: lo que seguís teniendo">
        Resultados por activo y cuenta
      </Titulo>
      <TablaResultados filas={v.filas} grupos={v.grupos} totales={totales} moneda={v.parametros.moneda} />
      {noAplica.length ? (
        <ul className="mt-2 space-y-0.5 text-[13px] text-muted">
          {noAplica.map((n) => (
            <li key={n}>No aplica: {n.charAt(0).toLowerCase() + n.slice(1)}</li>
          ))}
        </ul>
      ) : null}
    </Tarjeta>
  )
}

// ───────────── Patrimonio en el tiempo ─────────────

export function BloquePatrimonio({ v }: { v: VistaEvolucion }) {
  const ms = monedasDe(v.parametros.moneda)
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="tiempo">
      <Titulo id="tiempo" extra={v.serie.length === 1 ? 'un punto: el día cero' : `${v.serie.length} cargas`}>
        Tu patrimonio en el tiempo
      </Titulo>
      <GraficosPatrimonio serie={v.serie} aportado={v.aportado} futuro={v.futuro} monedas={ms} />
      <p className="mt-1 text-[13px] text-muted">
        {v.serie.length === 1
          ? 'Con tu próxima carga empieza la curva. '
          : 'La línea punteada es el capital aportado: arranca en tu patrimonio del día cero y suma lo que entró y salió, cada flujo a su CCL del día. Lo que queda entre las dos líneas es lo que ganaste o perdiste. '}
        {v.serie.some((p) => p.viejo) ? 'Un punto hueco: ese día algún precio o saldo era viejo. ' : null}
        {v.serie.some((p) => p.estimado) ? (
          <>
            <Chip>estimado</Chip> Tu patrimonio total lleva la deuda del leasing estimada: la curva también, hasta que la leasera informe el saldo.{' '}
          </>
        ) : null}
        {v.futuro?.estado === 'lista' ? `Desde hoy, fondo gris: el camino del escenario «${v.futuro.escenario.nombre}» (supuesto).` : null}
      </p>
    </Tarjeta>
  )
}

// ───────────── PnL por mes ─────────────

const LINEAS_MES = ['aportes', 'cuotas', 'amortizacion', 'activo', 'tc', 'sin_atribuir'] as const
/** El encabezado de cada columna del PnL por mes: corto, para que entre en la grilla (el nombre entero está en la traza de cada cifra). */
const NOMBRE_COLUMNA_MES: Record<string, string> = {
  aportes: 'Aportes y retiros',
  cuotas: 'Cuotas del leasing',
  amortizacion: 'Amortización',
  activo: 'Por tus activos',
  tc: 'Por el dólar',
  sin_atribuir: 'Sin atribuir',
}

export function BloqueMeses({ v }: { v: VistaEvolucion }) {
  if (!v.meses.length) return null
  const moneda = v.parametros.moneda
  const ms = monedasDe(moneda)
  const claves = LINEAS_MES.filter((c) => v.meses.some((x) => x.lineas.some((l) => l.clave === c)))
  const nombre = (c: string) => v.meses[0].lineas.find((l) => l.clave === c)?.nombre ?? c
  return (
    <Tarjeta className="@container p-4 md:p-5" aria-labelledby="meses">
      <Titulo id="meses" extra="cada mes es la suma exacta de sus días">
        PnL por mes
      </Titulo>
      <div className={`mb-3 grid gap-4 ${ms.length > 1 ? 'xl:grid-cols-2' : ''}`}>
        {ms.map((m) => (
          <GraficoMeses key={m} meses={v.meses} moneda={m} />
        ))}
      </div>
      <GrillaMeses meses={v.meses} claves={claves} nombres={Object.fromEntries(claves.map((c) => [c, NOMBRE_COLUMNA_MES[c] ?? nombre(c)]))} moneda={moneda} />
    </Tarjeta>
  )
}

// ───────────── Estado de resultados ─────────────

export function BloqueEstadoResultados({ v, r }: { v: VistaEvolucion; r: ResultadosVista }) {
  const moneda = v.parametros.moneda
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="estado-resultados">
      <Titulo id="estado-resultados" extra={r.etiqueta}>
        Estado de resultados (tu PnL)
      </Titulo>
      {r.un_dia ? <p className="mb-2 text-[13px] text-muted">Con una sola carga, lo de flujo es el del mes en curso; lo patrimonial empieza con tu próxima carga.</p> : null}
      <ul className="divide-y divide-border">
        {r.lineas.map((l) => {
          const det = l.signo === 'detalle'
          const total = l.signo === '='
          return (
            <li
              key={l.clave}
              className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 ${det ? 'pl-5 text-[13px] text-muted' : 'text-sm'} ${total ? 'font-semibold' : ''}`}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                {!det ? (
                  <span aria-hidden className="w-3 text-muted">
                    {l.signo}
                  </span>
                ) : null}
                <span className="min-w-0">{l.nombre}</span>
                <ChipPar par={l.valor} rotulo={l.rotulo} />
              </span>
              {l.nota ? (
                <Traza calc={l.valor.ars} titulo={l.nombre} moneda="ARS">
                  <span className="text-[13px] italic text-muted">{l.nota}</span>
                </Traza>
              ) : (
                <CifraPar
                  par={l.valor}
                  moneda={moneda}
                  titulo={l.nombre}
                  // Las partes del costo del leasing son partes de algo que se resta: van sin "+".
                  signo={total || (det && !l.clave.startsWith('leasing_'))}
                  color={l.clave === 'no_explicado' ? false : total}
                />
              )}
              {l.valor.ars.valor === null && !det && !(r.un_dia && l.valor.ars.motivo === MOTIVO_SEGUNDA_CARGA) ? <MotivoPar par={l.valor} className="basis-full" /> : null}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[13px] text-muted">
        &quot;No explicado&quot; es una diferencia, no un cuadre: consumo que no cargaste, plata que entró o quedó afuera de tus cuentas, una deuda que todavía no se actualizó.
      </p>
    </Tarjeta>
  )
}

// ───────────── El día cero ─────────────

export function BloqueDiaCero({ v, d, abierto }: { v: VistaEvolucion; d: DiaCeroVista; abierto: boolean }) {
  const moneda = v.parametros.moneda
  const contenido = (
    <div>
      <GrillaDiaCero d={d} moneda={moneda} />
      <MotivoPar par={d.total} className="mt-2 block" />
    </div>
  )
  const titulo = `Lo que ya traías al día cero (${fechaCorta(d.fecha)})`
  if (abierto)
    return (
      <Tarjeta className="p-4 md:p-5" aria-labelledby="dia-cero">
        <Titulo id="dia-cero" extra="desde la compra, según el PPP de tus brókers">
          {titulo}
        </Titulo>
        <p className="mb-2 text-[13px] text-muted">No es resultado de ningún período: es tu punto de partida. Lo que ganes o pierdas desde acá se mide contra esto.</p>
        {contenido}
      </Tarjeta>
    )
  return (
    <details className="group rounded-tarjeta border border-border bg-surface">
      <summary className="tocable flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm md:px-5">
        <span className="font-medium">{titulo}</span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="border-t border-border p-4 md:p-5">{contenido}</div>
    </details>
  )
}

// ───────────── Sensibilidad al CCL ─────────────

export function BloqueSensibilidad({ s }: { s: SensibilidadVista }) {
  return (
    <Tarjeta className="p-4 md:p-5" aria-labelledby="sensibilidad">
      <Titulo id="sensibilidad" extra="sensibilidad, no es un pronóstico">
        Si mañana el CCL sube 1%
      </Titulo>
      <ul className="space-y-2 text-[15px] leading-7">
        <li>
          En pesos, tu financiero varía <Cifra calc={s.ars} moneda="ARS" titulo="Si el CCL sube 1%: en pesos" signo className="font-semibold" /> (por tus{' '}
          <Cifra calc={s.base_usd.usd} moneda="USD" titulo="Lo que arriesga dólares" /> en activos en dólares).
        </li>
        <li>
          En dólares, varía <Cifra calc={s.usd} moneda="USD" titulo="Si el CCL sube 1%: en dólares" signo className="font-semibold" /> (por tus{' '}
          <Cifra calc={s.base_pesos.ars} moneda="ARS" titulo="Lo que arriesga pesos" /> en pesos).
        </li>
      </ul>
    </Tarjeta>
  )
}

// ───────────── Futuro ─────────────

export function BloqueFuturo({ v, demo = null }: { v: VistaEvolucion; demo?: string | null }) {
  const f = v.futuro
  const moneda = v.parametros.moneda
  if (!f) {
    return (
      <Tarjeta className="p-4 md:p-5" aria-labelledby="futuro">
        <Titulo id="futuro">El futuro, con tu escenario</Titulo>
        <p className="text-[15px] leading-6">
          {v.hay_escenarios
            ? 'Elegí un escenario en Flujo y escenarios para ver acá adónde te lleva: la curva sigue punteada desde hoy y abajo va el PnL proyectado por mes.'
            : 'Todavía no armaste un escenario. Con uno, acá ves adónde te lleva tu patrimonio mes a mes, con tus supuestos a la vista.'}
        </p>
        <Link href={v.parametros.s ? `/flujo?s=${v.parametros.s}` : '/flujo'} className="tocable mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          {v.hay_escenarios ? 'Elegir un escenario en Flujo y escenarios' : 'Armá tu primer escenario en Flujo y escenarios'} <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Tarjeta>
    )
  }
  return (
    <Tarjeta className="@container p-4 md:p-5" aria-labelledby="futuro">
      <Titulo
        id="futuro"
        extra={
          <Link href={f.ajustar} className="tocable inline-flex items-center gap-1 font-medium text-accent hover:underline">
            Ajustar supuestos <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      >
        El futuro con «{f.escenario.nombre}»
      </Titulo>
      <p className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <Chip>supuesto</Chip> Una proyección determinística con tus supuestos: un camino posible, no un pronóstico ni una recomendación.
      </p>
      {f.otros.length ? (
        <nav aria-label="Ver otro escenario" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-muted">Ver con:</span>
          {f.otros.map((o) => (
            <Link key={o.id} href={hrefEvolucion(v.parametros, { e: o.id, s: null }, demo)} className="tocable inline-flex min-w-0 items-center font-medium text-accent hover:underline">
              <span className="break-words">«{o.nombre}»</span>
            </Link>
          ))}
        </nav>
      ) : null}
      {f.estado === 'faltan' ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {f.faltan.map((x) => (
            <li key={x.variable}>{x.texto}</li>
          ))}
        </ul>
      ) : (
        <GrillaFuturo meses={f.meses} escenario={f.escenario.nombre} moneda={moneda} />
      )}
    </Tarjeta>
  )
}

export function SinCargas() {
  return (
    <Tarjeta className="p-5 md:p-8">
      <Rotulo as="h2">Evolución y PnL</Rotulo>
      <p className="mt-3 max-w-[60ch] text-xl font-semibold leading-snug">Todavía no hay cargas: tu evolución arranca con la primera.</p>
      <p className="mt-2 max-w-[70ch] text-[15px] leading-6 text-muted">
        Con una carga ves tu punto de partida y lo que ya traías desde la compra; con dos, el puente de qué cambió y por qué. Ningún número aparece en cero mientras falte: dice
        &quot;sin dato&quot; y qué hace falta.
      </p>
      <Boton href="/carga" className="mt-4">
        Hacer la primera carga
      </Boton>
    </Tarjeta>
  )
}

