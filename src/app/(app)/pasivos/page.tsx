import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { numero } from '@/lib/domain/dinero'
import { fechaLarga } from '@/lib/domain/fechas'
import type { CalcVista } from '@/lib/domain/calc'
import type { Par, VistaLeasing, VistaPasivos } from '@/lib/vistas/contratos-pasivos'
import { vistaPasivos } from '@/lib/vistas/pasivos'
import { ErrorVista } from '@/components/error-vista'
import { MontoTrazado, Porcentaje, SinDato } from '@/components/monto'
import { Encabezado } from '@/components/pantalla/encabezado'
import { Traza } from '@/components/traza'
import { Chip, ChipEtiqueta, ParMonto, Rotulo, Tarjeta } from '@/components/ui'
import { TablaApertura } from './_componentes/apertura'
import { CuadroMarcha } from './_componentes/cuadro'
import { GraficoCuota } from './_componentes/cuota'
import { FrasePasivos } from './_componentes/frase'
import { GraficoApertura, GraficoIndexado } from './_componentes/graficos'
import { ElegirDato } from './_componentes/pagador'
import { Proximas } from './_componentes/proximas'
import { Resumen } from './_componentes/resumen'
import { lecturaPasivos } from './_lib/pantalla'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pasivos' }

// Pasivos (rediseño del 15/10, D-157, D-162 y D-163; handoff "Portfolio UI",
// capturas 08 y 09): la pregunta, la lectura, la tira de cuotas con las cuatro
// cifras (saldo de capital, pagado, falta, opción de compra), la cuota en
// pesos y en dólares y las próximas cuotas. Abajo, "El detalle: tu leasing",
// lo de siempre: la deuda con su origen, la tasa del contrato, el costo contra
// el bien, el cuadro de marcha entero, cada cuota abierta (lo único que baja
// la deuda es la amortización), los totales, el recupero fiscal, la frase, el
// contrato y quién paga. Toda cifra en pesos y en dólares, con su traza; lo
// que no es un hecho, con su chip. Las cuentas están en _lib (puras, con test).

const ENLACE = 'tocable inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-accent hover:underline lg:min-h-9'

function Seccion({ titulo, id, children, className = '', accion }: { titulo: string; id: string; children: ReactNode; className?: string; accion?: ReactNode }) {
  return (
    <Tarjeta className={`min-w-0 p-5 ${className}`} aria-labelledby={id}>
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Rotulo as="h2" className="min-w-0">
          <span id={id}>{titulo}</span>
        </Rotulo>
        {accion}
      </div>
      {children}
    </Tarjeta>
  )
}

/** Un renglón "nombre · pesos · dólares", que en el teléfono se apila. */
function Renglon({ nombre, par, detalle, punto, cuenta }: { nombre: ReactNode; par: Par; detalle?: ReactNode; punto?: string; cuenta?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border py-2 first:border-t-0">
      <dt className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted">
        {punto ? <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: punto }} /> : null}
        <span>{nombre}</span>
        {par.ars.valor === null ? null : <ChipEtiqueta calc={par.ars} />}
        {cuenta ? <Chip>la que cuenta</Chip> : null}
      </dt>
      <dd className="ml-auto min-w-0 text-right">
        <ParMonto par={par} titulo={typeof nombre === 'string' ? nombre : 'Monto'} />
        {/* Un "sin dato" dice por qué (nunca un cero). */}
        {par.ars.valor === null && par.ars.motivo ? <span className="block text-xs text-muted">{par.ars.motivo}</span> : detalle ? <span className="block text-xs text-muted">{detalle}</span> : null}
      </dd>
    </div>
  )
}

function Veces({ calc, titulo }: { calc: CalcVista; titulo: string }) {
  return (
    <Traza calc={calc} titulo={titulo}>
      {calc.valor === null ? <SinDato motivo={calc.motivo} /> : <span className="num font-semibold">{numero(calc.valor, 2)} veces</span>}
    </Traza>
  )
}

function Deuda({ l }: { l: VistaLeasing }) {
  const d = l.deuda
  const cuentaDespues = 'cuenta desde tu próxima carga'
  // Lo cargado después de tu última carga va en el renglón del informado si todavía no hay ninguno; si no, aparte.
  const enInformada = d.posterior?.naturaleza === 'informado' && !d.informada ? d.posterior : null
  const aparte = d.posterior && !enInformada ? d.posterior : null
  return (
    <Seccion titulo="La deuda, con su origen" id={`deuda-${l.contrato.id}`}>
      <p className="mb-2 text-[13px] text-muted">
        Cuenta una sola, la misma que restan Exposición, Hoy y Flujo, al {fechaLarga(d.al)} (tu última carga): la que informa la leasera; sin ella, la según el cuadro de
        marcha; sin cuadro o sin la tasa del contrato, la estimada que aprobaste. Lo que falta pagar va al lado: nunca se resta, porque trae intereses e impuestos.
      </p>
      <dl>
        {d.informada ? (
          <Renglon nombre="Valor de cancelación (informado)" par={d.informada.par} cuenta={d.vigente === 'informada'} detalle={`al ${fechaLarga(d.informada.fecha)}${d.informada.fuente ? ` · ${d.informada.fuente}` : ''}`} />
        ) : enInformada ? (
          <Renglon nombre="Valor de cancelación (informado)" par={enInformada.par} detalle={`al ${fechaLarga(enInformada.fecha)} · ${cuentaDespues}${enInformada.fuente ? ` · ${enInformada.fuente}` : ''}`} />
        ) : (
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
            <dt className="text-sm text-muted">Valor de cancelación (informado)</dt>
            <dd className="text-right text-sm">
              <span className="italic text-muted">sin dato</span> · pedíselo a la leasera.{' '}
              <Link href="/datos/leasing" className={ENLACE}>
                Cargar el valor <ArrowRight aria-hidden className="size-4" />
              </Link>
            </dd>
          </div>
        )}
        <Renglon nombre="Según el cuadro de marcha" par={d.segun_cuadro} cuenta={d.vigente === 'segun_cuadro'} detalle={`al ${fechaLarga(d.al)} · valor presente de cánones y opción a la tasa del contrato`} />
        {d.estimada ? (
          <Renglon nombre="Estimada (la que aprobaste)" par={d.estimada.par} cuenta={d.vigente === 'estimada'} detalle={`al ${fechaLarga(d.estimada.fecha)}${d.estimada.fuente ? ` · ${d.estimada.fuente}` : ''}`} />
        ) : null}
        {aparte ? (
          <Renglon
            nombre={aparte.naturaleza === 'informado' ? 'Valor de cancelación nuevo (informado)' : 'Estimada nueva'}
            par={aparte.par}
            detalle={`al ${fechaLarga(aparte.fecha)} · ${cuentaDespues}${aparte.fuente ? ` · ${aparte.fuente}` : ''}`}
          />
        ) : null}
        <Renglon nombre="Lo que falta pagar (nominal)" par={d.falta_pagar} detalle="con intereses, IVA, seguro y percepción" />
      </dl>
    </Seccion>
  )
}

function Tasa({ l }: { l: VistaLeasing }) {
  return (
    <Seccion titulo="Tasa implícita del contrato" id={`tasa-${l.contrato.id}`}>
      {l.tea.valor === null ? (
        <div className="space-y-2 text-sm">
          <p>
            <span className="italic text-muted">sin dato</span> · {l.tea.motivo}
          </p>
          <Link href="/datos/leasing" className={ENLACE}>
            Completar el contrato <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="cifra flex flex-wrap items-baseline gap-x-3 text-[22px]">
            <span>
              TEA <Porcentaje calc={l.tea} titulo="TEA implícita del contrato" signo={false} />
            </span>
            <span className="text-[15px]">
              TEM <Porcentaje calc={l.tem} titulo="TEM equivalente" signo={false} />
            </span>
            <ChipEtiqueta calc={l.tea} />
          </p>
          <p className="text-[13px] text-muted">
            Calculada del contrato: lo financiado ({l.contrato.fecha_desembolso ? `desde el ${fechaLarga(l.contrato.fecha_desembolso)}` : 'sin fecha'}) contra cánones y opción, en días/365. No es la
            deuda.
          </p>
        </div>
      )}
    </Seccion>
  )
}

function Costo({ l }: { l: VistaLeasing }) {
  const t = l.tarjetas
  return (
    <Seccion titulo="Costo total contra el bien" id={`costo-${l.contrato.id}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="cifra text-[22px]">
          <MontoTrazado calc={t.costo.total.ars} moneda="ARS" titulo="Costo total del leasing, nominal" />
        </span>
        <span className="num text-[13px]">
          <MontoTrazado calc={t.costo.total.usd} moneda="USD" titulo="Costo total del leasing, en dólares al CCL de hoy" decimales={0} />
        </span>
        <ChipEtiqueta calc={t.costo.total.ars} />
      </div>
      <p className="mt-1 text-[13px] text-muted">Pagado + falta + opción + cargos, en pesos nominales.</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex min-w-0 flex-wrap items-center gap-x-1">
          <Veces calc={t.costo.vs_valor} titulo="Costo total ÷ valor del bien del contrato" /> el valor del bien del contrato
        </li>
        {t.costo.vs_valuacion ? (
          <li className="flex min-w-0 flex-wrap items-center gap-x-1">
            <Veces calc={t.costo.vs_valuacion} titulo={`Costo total ÷ valuación de ${l.bien?.nombre ?? 'el bien'}`} /> lo que vale hoy
            {l.bien?.fecha ? <span className="text-muted">(valuación del {fechaLarga(l.bien.fecha)})</span> : null}
          </li>
        ) : null}
      </ul>
    </Seccion>
  )
}

function Apertura({ l }: { l: VistaLeasing }) {
  return (
    <Seccion titulo="Cada cuota, abierta" id={`apertura-${l.contrato.id}`}>
      <p className="mb-3 text-[13px] text-muted">
        De cada cuota, solo la amortización baja la deuda y cuenta para tu patrimonio. El interés, el IVA, el seguro, la percepción y los cargos son gasto. La
        amortización y el interés salen de la tasa del contrato: llevan el chip «estimado».
      </p>
      <GraficoApertura leasing={{ cuotas: l.cuotas, opcion: l.opcion, tea: l.tea, hoy: l.hoy }} />
      <div className="mt-4">
        <TablaApertura l={l} />
      </div>
    </Seccion>
  )
}

function Totales({ l }: { l: VistaLeasing }) {
  const f = l.totales.falta_por_fuente
  const fuente = (c: Par, nombre: string) =>
    c.ars.valor !== null && c.ars.valor !== '0' ? (
      <span className="inline-flex flex-wrap items-baseline gap-x-1">
        {nombre} <ParMonto par={c} titulo={`Lo que falta pagar que sale de ${nombre}`} />
      </span>
    ) : null
  return (
    <Seccion titulo="Totales" id={`totales-${l.contrato.id}`}>
      <dl>
        <Renglon
          nombre="Pagado"
          par={l.totales.pagado}
          detalle={l.totales.pagado.usd.valor === null ? 'en dólares, al CCL de cada pago: cargá los CCL de los pagos en Datos › Leasing' : 'en dólares, al CCL de cada pago'}
        />
        <Renglon nombre="Falta pagar" par={l.totales.falta} detalle="en dólares, al CCL de hoy: una referencia" />
        <Renglon nombre="De lo que falta: canon según contrato" par={l.tarjetas.falta.canon} />
        <Renglon nombre="De lo que falta: IVA, seguro y percepción" par={l.tarjetas.falta.resto} />
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border py-2">
          <dt className="text-sm text-muted">Falta pagar, en pesos de hoy</dt>
          <dd className="min-w-0 text-right">
            <MontoTrazado calc={l.falta_pesos_hoy} moneda="ARS" titulo="Lo que falta pagar, en pesos de hoy" />
            <span className="block text-xs text-muted">{l.falta_pesos_hoy.motivo}</span>
          </dd>
        </div>
        <div className="pb-2">
          <dt className="sr-only">Lo que falta pagar, por de dónde sale cada monto</dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {fuente(f.comprobante, 'comprobante')}
            {fuente(f.contrato, 'contrato')}
            {fuente(f.a_confirmar, 'a confirmar')}
            {fuente(f.supuesto, 'supuesto')}
          </dd>
        </div>
        <Renglon nombre="IVA y percepción pagados" par={l.totales.iva_percepcion_pagado} />
        <Renglon nombre="IVA y percepción por pagar (con la opción)" par={l.totales.iva_percepcion_por_pagar} />
        {l.totales.hay_cargos ? (
          <Renglon nombre="Cargos extra" par={l.totales.cargos} />
        ) : (
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 border-t border-border py-2">
            <dt className="text-sm text-muted">Cargos extra</dt>
            <dd className="text-sm text-muted">ninguno</dd>
          </div>
        )}
        <Renglon
          nombre="Opción de compra con IVA"
          par={l.opcion.total}
          detalle={
            <>
              {l.opcion.fecha ? `el ${fechaLarga(l.opcion.fecha)} · ` : ''}IVA a la alícuota observada en tus facturas:{' '}
              <Porcentaje calc={l.opcion.alicuota} titulo="Alícuota de IVA observada" signo={false} />
            </>
          }
        />
      </dl>
      <p className="mt-2 text-xs text-muted">
        El IVA y la percepción son crédito fiscal de quien toma el leasing (la sociedad): para vos son gasto mientras no te los reintegre.{' '}
        {l.contrato.reintegra_iva === null ? 'Todavía no declaraste si te los reintegra.' : l.contrato.reintegra_iva ? 'Declaraste que te los reintegra.' : 'Declaraste que no te los reintegra.'}
      </p>
    </Seccion>
  )
}

function Fiscal({ l }: { l: VistaLeasing }) {
  return (
    <Seccion titulo="Recupero fiscal y dólar" id={`fiscal-${l.contrato.id}`}>
      <dl>
        <Renglon nombre="IVA computable (de la sociedad)" par={l.recupero.iva} detalle="IVA y percepción de las cuotas pagadas" />
        <Renglon nombre="Ganancias (de la empresa)" par={l.recupero.ganancias} />
        <Renglon nombre="Cuánto menos pagaste en dólares" par={l.licuacion_pagadas} detalle="por la suba del CCL desde la primera cuota con su CCL" />
        <Renglon nombre="Licuación de la deuda" par={l.licuacion_deuda} detalle="cuántos dólares bajó la deuda solo por la suba del CCL, entre tus cargas" />
      </dl>
      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-text">La cuota en pesos contra la cuota en dólares, índice 100</p>
        {l.indexado.length ? <GraficoIndexado filas={l.indexado} /> : <p className="text-sm text-muted">{l.indexado_motivo}</p>}
      </div>
    </Seccion>
  )
}

function Contrato({ l }: { l: VistaLeasing }) {
  const c = l.contrato
  return (
    <Seccion
      titulo="El contrato y quién paga"
      id={`contrato-${c.id}`}
      accion={
        <Link href="/datos/leasing" className={ENLACE}>
          Datos › Leasing <ArrowRight aria-hidden className="size-4" />
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ElegirDato
          pasivoId={c.id}
          campo="pagador_habitual"
          pregunta="¿Quién paga la cuota?"
          actual={c.pagador_habitual}
          opciones={[
            { valor: 'titular', nombre: 'Vos' },
            { valor: 'empresa', nombre: 'La empresa' },
          ]}
        />
        <ElegirDato
          pasivoId={c.id}
          campo="reintegra_iva"
          pregunta="¿La empresa te reintegra el IVA y la percepción?"
          actual={c.reintegra_iva === null ? null : c.reintegra_iva ? 'si' : 'no'}
          opciones={[
            { valor: 'si', nombre: 'Sí' },
            { valor: 'no', nombre: 'No' },
          ]}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
        {(
          [
            ['Inicio', fechaLarga(c.fecha_inicio)],
            ['Desembolso (entrega)', c.fecha_desembolso ? fechaLarga(c.fecha_desembolso) : null],
            ['Cuotas', String(c.cuotas_totales)],
            ['Opción de compra', c.opcion_compra_fecha ? fechaLarga(c.opcion_compra_fecha) : null],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={v === null ? 'italic text-muted' : 'num text-text'}>{v ?? 'sin dato'}</dd>
          </div>
        ))}
      </dl>
      {l.bien ? (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
          Financia: <span className="text-text">{l.bien.nombre}</span>
          {l.bien.valuacion ? (
            <>
              · vale <ParMonto par={l.bien.valuacion} titulo={`Valuación de ${l.bien.nombre}`} /> ({l.bien.fuente}, {fechaLarga(l.bien.fecha as string)})
            </>
          ) : (
            '· sin valuación'
          )}
        </p>
      ) : null}
      {l.cargos.length ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-text">Cargos extra</p>
          <ul className="mt-1 space-y-1 text-sm">
            {l.cargos.map((k) => (
              <li key={k.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="text-muted">{fechaLarga(k.fecha)}</span>
                <span>{k.detalle ?? k.concepto}</span>
                {k.cuota_nro ? <span className="text-muted">· cuota {k.cuota_nro}</span> : null}
                <ParMonto par={k.importe} titulo={k.detalle ?? k.concepto} />
                <ChipEtiqueta calc={k.importe.ars} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Seccion>
  )
}

/** Sin cuadro de marcha, el gráfico y las próximas no tienen de dónde salir: el bloque queda y dice qué falta. */
function SinCuadro({ titulo, id }: { titulo: string; id: string }) {
  return (
    <Seccion titulo={titulo} id={id}>
      <p className="text-sm text-muted">
        <span className="italic">sin dato</span> · falta el cuadro de marcha.{' '}
        <Link href="/datos/leasing#cuadro-de-marcha" className={ENLACE}>
          Importá el cuadro de marcha (CSV) <ArrowRight aria-hidden className="size-4" />
        </Link>
      </p>
    </Seccion>
  )
}

const DETALLE_DE: Record<VistaLeasing['contrato']['tipo'], string> = { leasing: 'tu leasing', prestamo: 'tu préstamo', tarjeta: 'tu tarjeta' }

function Leasing({ l, v }: { l: VistaLeasing; v: VistaPasivos }) {
  const sinCuadro = l.cuotas.length === 0
  const cclFecha = v.ccl_fecha ? fechaLarga(v.ccl_fecha) : null
  const idDetalle = `detalle-${l.contrato.id}`
  return (
    <article className="flex min-w-0 flex-col gap-5" aria-label={l.contrato.nombre}>
      <Resumen l={l} />
      {/* El gráfico principal y las próximas (handoff: 1,4fr y 1fr desde 1280 px, las dos tarjetas del mismo alto). */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {sinCuadro ? (
          <>
            <SinCuadro titulo="La cuota en pesos y en dólares" id={`cuota-sin-${l.contrato.id}`} />
            <SinCuadro titulo="Cuadro de marcha · próximas" id={`proximas-sin-${l.contrato.id}`} />
          </>
        ) : (
          <>
            <GraficoCuota l={l} />
            <Proximas l={l} ccl={v.ccl} cclFecha={cclFecha} />
          </>
        )}
      </div>

      {/* El detalle: todo lo que la pantalla tenía, con el estilo nuevo (como "El detalle: tu exposición"). */}
      <section aria-labelledby={idDetalle} className="flex min-w-0 flex-col gap-5">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-5">
          <h2 id={idDetalle} className="text-[15px] font-medium">
            El detalle: {DETALLE_DE[l.contrato.tipo]}
          </h2>
          <p className="flex flex-wrap items-center gap-x-1 text-[13px] text-muted">
            {cclFecha ? `En dólares, al CCL del ${cclFecha}:` : 'En dólares, al último CCL:'}{' '}
            <Traza calc={v.ccl} titulo={cclFecha ? `CCL del ${cclFecha}` : 'Último CCL cargado'}>
              <span className="num">{v.ccl.valor === null ? 'sin dato' : numero(v.ccl.valor, 2)}</span>
            </Traza>
            <ChipEtiqueta calc={v.ccl} />
          </p>
        </div>
        {sinCuadro ? (
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
            <Deuda l={l} />
            <Contrato l={l} />
          </div>
        ) : (
          <>
            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
              <Deuda l={l} />
              <div className="flex min-w-0 flex-col gap-5">
                <Tasa l={l} />
                <Costo l={l} />
              </div>
            </div>
            <Seccion titulo="Cuadro de marcha" id={`cuadro-${l.contrato.id}`}>
              <CuadroMarcha leasing={{ cuotas: l.cuotas, opcion: l.opcion, tea: l.tea }} />
            </Seccion>
            <Apertura l={l} />
            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
              <Totales l={l} />
              <Fiscal l={l} />
            </div>
            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
              <Seccion titulo="El leasing en palabras" id={`palabras-${l.contrato.id}`}>
                <FrasePasivos partes={l.frase} detalle={l.frase_detalle} titulo={l.contrato.nombre} />
                <p className="mt-2 text-xs text-muted">
                  En dólares, lo que falta va al CCL {cclFecha ? `del ${cclFecha}` : 'de tu última carga'} (el de arriba): una referencia, no lo que va a costar.
                </p>
              </Seccion>
              <Contrato l={l} />
            </div>
          </>
        )}
      </section>
    </article>
  )
}

export default async function PaginaPasivos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  let v: VistaPasivos
  try {
    v = await vistaPasivos(sp.demo)
  } catch (e) {
    return (
      <>
        <h1 className="sr-only">Pasivos</h1>
        <ErrorVista error={e} que="tus pasivos" />
      </>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Encabezado pregunta="Compromisos · ¿Cuánto me falta pagar?" lectura={lecturaPasivos(v)} />
      {v.leasings.length === 0 ? (
        <Tarjeta className="p-5">
          <p className="text-sm text-muted">{v.aviso}</p>
          <Link href="/datos/leasing" className={`${ENLACE} mt-2`}>
            Ir a Datos › Leasing <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Tarjeta>
      ) : (
        v.leasings.map((l) => <Leasing key={l.contrato.id} l={l} v={v} />)
      )}
    </div>
  )
}
