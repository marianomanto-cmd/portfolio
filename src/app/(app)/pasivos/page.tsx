import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { numero } from '@/lib/domain/dinero'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import type { CalcVista } from '@/lib/domain/calc'
import type { Par, TotalesApertura, VistaLeasing, VistaPasivos } from '@/lib/vistas/contratos-pasivos'
import { vistaPasivos } from '@/lib/vistas/pasivos'
import { ErrorVista } from '@/components/error-vista'
import { MontoTrazado, Porcentaje, SinDato } from '@/components/monto'
import { Traza } from '@/components/traza'
import { Chip, ChipEtiqueta, ParMonto, Rotulo, Tarjeta } from '@/components/ui'
import { CuadroMarcha } from './_componentes/cuadro'
import { FrasePasivos } from './_componentes/frase'
import { GraficoApertura, GraficoIndexado } from './_componentes/graficos'
import { ElegirDato } from './_componentes/pagador'
import { COLOR_PARTE } from './_lib/graficos'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pasivos' }

// Pasivos (plan de la entrega 4, §5): el leasing entero. Cuánto pagaste,
// cuánto falta y cuánto es en dólares; cada cuota abierta en amortización (lo
// único que baja la deuda) y gasto; la deuda en tres valores con su origen; la
// tasa del contrato; la opción de compra. Toda cifra en pesos y en dólares, con
// su traza; lo que no es un hecho, con su chip.

const ENLACE = 'tocable inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-accent hover:underline lg:min-h-9'

function Seccion({ titulo, id, children, className = '', accion }: { titulo: string; id: string; children: ReactNode; className?: string; accion?: ReactNode }) {
  return (
    <Tarjeta className={`min-w-0 p-4 md:p-5 ${className}`} aria-labelledby={id}>
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
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border py-1.5 first:border-t-0">
      <dt className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted">
        {punto ? <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: punto }} /> : null}
        <span>{nombre}</span>
        {par.ars.valor === null ? null : <ChipEtiqueta calc={par.ars} />}
        {cuenta ? <Chip>la que cuenta</Chip> : null}
      </dt>
      <dd className="min-w-0 text-right">
        <ParMonto par={par} titulo={typeof nombre === 'string' ? nombre : 'Monto'} />
        {/* Un "sin dato" dice por qué (nunca un cero). */}
        {par.ars.valor === null && par.ars.motivo ? <span className="block text-xs text-muted">{par.ars.motivo}</span> : detalle ? <span className="block text-xs text-muted">{detalle}</span> : null}
      </dd>
    </div>
  )
}

function Progreso({ hechas, total, pct }: { hechas: number; total: number; pct: number }) {
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${hechas} de ${total} cuotas pagadas`}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Tarjetas({ l }: { l: VistaLeasing }) {
  const t = l.tarjetas
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      <Tarjeta className="min-w-0 p-4" aria-labelledby={`pagadas-${l.contrato.id}`}>
        <Rotulo as="h3">
          <span id={`pagadas-${l.contrato.id}`}>Cuotas pagadas</span>
        </Rotulo>
        <p className="cifra mt-1 text-2xl font-semibold text-text">
          {t.pagadas}
          <span className="text-base font-normal text-muted"> de {t.total}</span>
        </p>
        <Progreso hechas={t.pagadas} total={t.total} pct={t.progreso} />
        <p className="mt-2 text-xs text-muted">
          {t.cargadas < t.total ? `El cuadro de marcha trae ${t.cargadas} de ${t.total} cuotas.` : 'Según el cuadro de marcha que importaste.'}
        </p>
      </Tarjeta>
      <Tarjeta className="min-w-0 p-4" aria-labelledby={`proxima-${l.contrato.id}`}>
        <Rotulo as="h3">
          <span id={`proxima-${l.contrato.id}`}>Próxima cuota</span>
        </Rotulo>
        {t.proxima ? (
          <>
            <p className="mt-1 text-sm text-muted">
              La {t.proxima.nro}, vence el {fechaCorta(t.proxima.fecha)}
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 text-xl font-semibold">
              <MontoTrazado calc={t.proxima.total.ars} moneda="ARS" titulo="Próxima cuota en pesos" />
              <ChipEtiqueta calc={t.proxima.total.ars} />
            </div>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-sm text-muted">
              hoy <MontoTrazado calc={t.proxima.total.usd} moneda="USD" titulo="Próxima cuota en dólares al CCL de hoy" /> al CCL de hoy
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">No queda ninguna cuota por pagar.</p>
        )}
        {t.vencidas.length ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            <Chip>vencida</Chip>
            {t.vencidas.length === 1
              ? `La ${t.vencidas[0].nro} venció el ${fechaCorta(t.vencidas[0].fecha)} y tu planilla no la marca pagada.`
              : `Las ${t.vencidas.map((v) => v.nro).join(', ')} vencieron y tu planilla no las marca pagadas.`}{' '}
            Si ya se debitó, importá la planilla actualizada.
          </p>
        ) : null}
      </Tarjeta>
      <Tarjeta className="min-w-0 p-4" aria-labelledby={`falta-${l.contrato.id}`}>
        <Rotulo as="h3">
          <span id={`falta-${l.contrato.id}`}>Falta pagar · {t.falta.cuotas} cuotas</span>
        </Rotulo>
        <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 text-xl font-semibold">
          <MontoTrazado calc={t.falta.total.ars} moneda="ARS" titulo="Lo que falta pagar, nominal" />
          <ChipEtiqueta calc={t.falta.total.ars} />
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-sm text-muted">
          hoy <MontoTrazado calc={t.falta.total.usd} moneda="USD" titulo="Lo que falta pagar en dólares al CCL de hoy" /> al CCL de hoy
        </p>
        <dl className="mt-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <dt className="text-muted">canon según contrato</dt>
            <dd className="text-right">
              <ParMonto par={t.falta.canon} titulo="Canon que falta" />
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <dt className="text-muted">IVA, seguro y percepción</dt>
            <dd className="text-right">
              <ParMonto par={t.falta.resto} titulo="IVA, seguro y percepción que faltan" />
            </dd>
          </div>
        </dl>
        <p className="mt-1 text-xs text-muted">Más la opción de compra. No es la deuda: trae intereses e impuestos.</p>
      </Tarjeta>
      <Tarjeta className="min-w-0 p-4" aria-labelledby={`costo-${l.contrato.id}`}>
        <Rotulo as="h3">
          <span id={`costo-${l.contrato.id}`}>Costo total contra el bien</span>
        </Rotulo>
        <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 text-xl font-semibold">
          <MontoTrazado calc={t.costo.total.ars} moneda="ARS" titulo="Costo total del leasing, nominal" />
          <ChipEtiqueta calc={t.costo.total.ars} />
        </div>
        <p className="mt-1 text-sm text-muted">pagado + falta + opción + cargos, en pesos nominales</p>
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
      </Tarjeta>
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
      <p className="mb-2 text-sm text-muted">
        Cuenta una sola, la misma que restan el Balance, Hoy y Flujo, al {fechaLarga(d.al)} (tu última carga): la que informa la leasera; sin ella, la según el cuadro de
        marcha; sin cuadro o sin la tasa del contrato, la estimada que aprobaste. Lo que falta pagar va al lado: nunca se resta, porque trae intereses e impuestos.
      </p>
      <dl>
        {d.informada ? (
          <Renglon nombre="Valor de cancelación (informado)" par={d.informada.par} cuenta={d.vigente === 'informada'} detalle={`al ${fechaLarga(d.informada.fecha)}${d.informada.fuente ? ` · ${d.informada.fuente}` : ''}`} />
        ) : enInformada ? (
          <Renglon nombre="Valor de cancelación (informado)" par={enInformada.par} detalle={`al ${fechaLarga(enInformada.fecha)} · ${cuentaDespues}${enInformada.fuente ? ` · ${enInformada.fuente}` : ''}`} />
        ) : (
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5">
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
          <p className="flex flex-wrap items-baseline gap-x-3 text-xl font-semibold">
            <span>
              TEA <Porcentaje calc={l.tea} titulo="TEA implícita del contrato" signo={false} />
            </span>
            <span className="text-base font-normal">
              TEM <Porcentaje calc={l.tem} titulo="TEM equivalente" signo={false} />
            </span>
            <ChipEtiqueta calc={l.tea} />
          </p>
          <p className="text-sm text-muted">
            Calculada del contrato: lo financiado ({l.contrato.fecha_desembolso ? `desde el ${fechaLarga(l.contrato.fecha_desembolso)}` : 'sin fecha'}) contra cánones y opción, en días/365. No es la
            deuda.
          </p>
        </div>
      )}
    </Seccion>
  )
}

function TablaApertura({ t, titulo, cargos, notaUsd }: { t: TotalesApertura; titulo: string; cargos: boolean; notaUsd: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-sm font-medium text-text">{titulo}</p>
      {/* Un "sin dato" en dólares dice por qué una vez, arriba (no en cada renglón). */}
      {t.total.usd.valor === null ? <p className="mb-1 text-xs text-muted">{notaUsd}</p> : null}
      <dl>
        <Renglon nombre="Amortización (baja la deuda)" par={t.amortizacion} punto={COLOR_PARTE.amortizacion} />
        <Renglon nombre="Interés implícito" par={t.interes} punto={COLOR_PARTE.interes} />
        <Renglon nombre="IVA" par={t.iva} punto={COLOR_PARTE.iva} />
        <Renglon nombre="Seguro" par={t.seguro} punto={COLOR_PARTE.seguro} />
        <Renglon nombre="Percepción RG 3337" par={t.percepcion} punto={COLOR_PARTE.percepcion} />
        {cargos ? <Renglon nombre="Cargos" par={t.cargos} punto={COLOR_PARTE.cargos} /> : null}
        <Renglon nombre="Gasto (todo menos la amortización)" par={t.gasto} />
        <Renglon nombre="Total" par={t.total} />
      </dl>
    </div>
  )
}

function Apertura({ l }: { l: VistaLeasing }) {
  return (
    <Seccion titulo="Cada cuota, abierta" id={`apertura-${l.contrato.id}`}>
      <p className="mb-3 text-sm text-muted">
        De cada cuota, solo la amortización baja la deuda y cuenta para tu patrimonio. El interés, el IVA, el seguro, la percepción y los cargos son gasto. La
        amortización y el interés salen de la tasa del contrato: llevan el chip "estimado".
      </p>
      <GraficoApertura leasing={{ cuotas: l.cuotas, opcion: l.opcion, tea: l.tea, hoy: l.hoy }} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TablaApertura
          t={l.totales.apertura_pagadas}
          titulo={`Lo que pagaste (${l.tarjetas.pagadas} cuotas)`}
          cargos={l.totales.hay_cargos}
          notaUsd="En dólares, lo pagado va al CCL del día de cada pago: sin dato hasta que cargues esos CCL en Datos › Leasing (la planilla no trae la fecha del débito)."
        />
        <TablaApertura
          t={l.totales.apertura_pendientes}
          titulo={`Lo que falta (${l.tarjetas.falta.cuotas} cuotas)`}
          cargos={l.totales.hay_cargos}
          notaUsd="En dólares, sin dato: falta el CCL de hoy o una parte de lo que falta."
        />
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
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border py-1.5">
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
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 border-t border-border py-1.5">
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
        <p className="mb-1 text-sm font-medium text-text">La cuota en pesos contra la cuota en dólares</p>
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

function Leasing({ l, ccl }: { l: VistaLeasing; ccl: CalcVista }) {
  const sinCuadro = l.cuotas.length === 0
  return (
    <article className="flex min-w-0 flex-col gap-3 md:gap-4" aria-labelledby={`leasing-${l.contrato.id}`}>
      <Tarjeta className="min-w-0 p-4 md:p-5">
        <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
          <h2 id={`leasing-${l.contrato.id}`} className="text-base font-semibold text-text md:text-lg">
            {l.contrato.nombre}
          </h2>
          <Chip>{l.contrato.tipo}</Chip>
          {l.deuda.vigente === 'segun_cuadro' || l.deuda.vigente === 'estimada' ? <Chip>deuda estimada</Chip> : l.deuda.vigente === null ? <Chip>deuda sin dato</Chip> : null}
        </div>
        <FrasePasivos partes={l.frase} detalle={l.frase_detalle} titulo={l.contrato.nombre} />
        {sinCuadro ? (
          <Link href="/datos/leasing#cuadro-de-marcha" className={`${ENLACE} mt-2`}>
            Importá el cuadro de marcha (CSV) <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
        {sinCuadro ? null : (
          <p className="mt-2 text-xs text-muted">
            En dólares, lo que falta va al CCL de hoy ({ccl.valor === null ? 'sin dato' : numero(ccl.valor, 2)}): una referencia, no lo que va a costar.
          </p>
        )}
      </Tarjeta>
      {sinCuadro ? (
        <div className="grid items-start gap-3 md:gap-4 xl:grid-cols-2">
          <Deuda l={l} />
          <Contrato l={l} />
        </div>
      ) : (
        <>
          <Tarjetas l={l} />
          <div className="grid items-start gap-3 md:gap-4 xl:grid-cols-2">
            <Deuda l={l} />
            <Tasa l={l} />
          </div>
          <Apertura l={l} />
          <Seccion titulo="Cuadro de marcha" id={`cuadro-${l.contrato.id}`}>
            <CuadroMarcha leasing={{ cuotas: l.cuotas, opcion: l.opcion, tea: l.tea }} />
          </Seccion>
          <div className="grid items-start gap-3 md:gap-4 xl:grid-cols-2">
            <Totales l={l} />
            <Fiscal l={l} />
          </div>
          <Contrato l={l} />
        </>
      )}
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
    <div className="flex min-w-0 flex-col gap-3 md:gap-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold text-text md:text-xl">Pasivos</h1>
        <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
          {/* El último CCL cargado, con su fecha: no siempre es de hoy (y si pasaron más de 2 días hábiles, "viejo"). */}
          {v.ccl_fecha ? `CCL del ${fechaLarga(v.ccl_fecha)}:` : 'CCL:'}{' '}
          <Traza calc={v.ccl} titulo="Último CCL cargado">
            <span className="num">{v.ccl.valor === null ? 'sin dato' : numero(v.ccl.valor, 2)}</span>
          </Traza>
          <ChipEtiqueta calc={v.ccl} />
        </p>
      </div>
      {v.leasings.length === 0 ? (
        <Tarjeta className="p-5">
          <p className="text-sm text-muted">{v.aviso}</p>
          <Link href="/datos/leasing" className={`${ENLACE} mt-2`}>
            Ir a Datos › Leasing <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Tarjeta>
      ) : (
        v.leasings.map((l) => <Leasing key={l.contrato.id} l={l} ccl={v.ccl} />)
      )}
    </div>
  )
}

