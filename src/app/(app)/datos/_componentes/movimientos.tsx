'use client'

// Movimientos de capital (D-06): plata que entra, sale o se mueve entre tus
// cuentas. Sin registrarlos, un depósito se leería como ganancia. Formulario
// arriba, los últimos movimientos abajo (tabla en desktop, tarjetas debajo de
// 768 px). Cada monto está en su moneda y en la otra, al CCL de su fecha.

import { useEffect, useId, useState } from 'react'
import { MontoTrazado } from '@/components/monto'
import { monto, numero } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Fecha, Moneda } from '@/lib/domain/tipos'
import { Boton, Campo, Chip, Entrada, Selector } from '../../carga/_componentes/ui'
import { nuevoMovimiento } from '../acciones'
import { cclAl, describirMovimiento, enDosMonedas, type CCL, type PrecargaMovimiento, type TipoMovimiento } from '../_lib/calculos'
import type { MovimientoFila } from '../_lib/servidor'
import { ElegirMoneda, Mensaje, Panel, useFormulario } from './formulario'

type CuentaCorta = { id: number; nombre: string }

const esCero = (v: string) => /^-?0+(\.0+)?$/.test(v)

const TIPOS: { valor: TipoMovimiento; nombre: string; ayuda: string }[] = [
  { valor: 'aporte', nombre: 'Aporte', ayuda: 'Plata de afuera que entra a una cuenta (sueldo, dólares vendidos a cripto).' },
  { valor: 'retiro', nombre: 'Retiro', ayuda: 'Plata que sale de una cuenta hacia afuera (gastos, pagos).' },
  { valor: 'transferencia', nombre: 'Transferencia', ayuda: 'Entre dos cuentas tuyas, con el impuesto si lo hubo.' },
]

function ElegirTipo({ valor, onCambio }: { valor: TipoMovimiento; onCambio: (t: TipoMovimiento) => void }) {
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-sm font-medium text-text">¿Qué fue?</legend>
      <input type="hidden" name="tipo" value={valor} />
      <div className="grid grid-cols-3 gap-2">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            aria-pressed={valor === t.valor}
            onClick={() => onCambio(t.valor)}
            className={`tocable min-h-11 min-w-0 rounded-lg border px-2 text-sm font-medium lg:min-h-10 ${
              valor === t.valor ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text hover:bg-surface-2'
            }`}
          >
            {t.nombre}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{TIPOS.find((t) => t.valor === valor)?.ayuda}</p>
    </fieldset>
  )
}

function SelectorCuenta({ id, nombre, etiqueta, cuentas, inicial, error }: { id: string; nombre: string; etiqueta: string; cuentas: CuentaCorta[]; inicial: number | null; error?: string }) {
  return (
    <Campo etiqueta={etiqueta} htmlFor={id} error={error}>
      <Selector id={id} name={nombre} defaultValue={inicial ?? ''} invalido={Boolean(error)}>
        <option value="">Elegí la cuenta</option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </Selector>
    </Campo>
  )
}

function FormMovimiento({ cuentas, hoy, precarga }: { cuentas: CuentaCorta[]; hoy: Fecha; precarga: PrecargaMovimiento | null }) {
  const id = useId()
  const [estado, enviar, enviando] = useFormulario(nuevoMovimiento)
  const [tipo, setTipo] = useState<TipoMovimiento>(precarga?.tipo ?? 'aporte')
  // Aporte y retiro tocan una sola cuenta; la otra punta (afuera) es opcional:
  // sirve cuando hubo conversión (USD vendidos que llegan en pesos).
  const [conversion, setConversion] = useState(false)
  const [monedaSale, setMonedaSale] = useState<Moneda | ''>(precarga?.tipo === 'retiro' ? (precarga.moneda ?? '') : '')
  const [monedaEntra, setMonedaEntra] = useState<Moneda | ''>(precarga?.tipo !== 'retiro' ? (precarga?.moneda ?? '') : '')
  const e = estado.errores
  useEffect(() => {
    if (estado.ok && estado.vez > 0) {
      setMonedaSale('')
      setMonedaEntra('')
      setConversion(false)
    }
  }, [estado.ok, estado.vez])

  const sale = tipo !== 'aporte' || conversion
  const entra = tipo !== 'retiro' || conversion
  const montoInicial = (lado: 'sale' | 'entra') =>
    estado.vez === 0 && precarga?.monto && ((lado === 'entra' && precarga.tipo !== 'retiro') || (lado === 'sale' && precarga.tipo === 'retiro')) ? precarga.monto : undefined

  return (
    <form key={estado.vez} onSubmit={enviar} noValidate className="space-y-4" aria-label="Nuevo movimiento de capital">
      <div className="max-w-xl">
        <ElegirTipo
          valor={tipo}
          onCambio={(t) => {
            setTipo(t)
            setConversion(false)
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Campo etiqueta="Fecha" htmlFor={`${id}-f`} error={e.fecha}>
          <Entrada id={`${id}-f`} type="date" name="fecha" defaultValue={(estado.vez === 0 && precarga?.fecha) || hoy} max={hoy} invalido={Boolean(e.fecha)} />
        </Campo>
        <Campo etiqueta="Acreditación (si fue otro día)" htmlFor={`${id}-fa`} error={e.fecha_acreditacion}>
          <Entrada id={`${id}-fa`} type="date" name="fecha_acreditacion" invalido={Boolean(e.fecha_acreditacion)} />
        </Campo>
        {tipo !== 'aporte' ? (
          <SelectorCuenta
            id={`${id}-co`}
            nombre="cuenta_origen_id"
            etiqueta="Sale de"
            cuentas={cuentas}
            inicial={estado.vez === 0 && precarga?.tipo !== 'aporte' ? (precarga?.cuenta_id ?? null) : null}
            error={e.cuenta_origen_id}
          />
        ) : null}
        {tipo !== 'retiro' ? (
          <SelectorCuenta
            id={`${id}-cd`}
            nombre="cuenta_destino_id"
            etiqueta="Entra a"
            cuentas={cuentas}
            inicial={estado.vez === 0 && precarga?.tipo !== 'retiro' ? (precarga?.cuenta_id ?? null) : null}
            error={e.cuenta_destino_id}
          />
        ) : null}
      </div>

      {tipo !== 'transferencia' ? (
        <button
          type="button"
          aria-pressed={conversion}
          onClick={() => setConversion((c) => !c)}
          className={`tocable inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm lg:min-h-9 ${
            conversion ? 'border-accent bg-accent-soft text-text' : 'border-border bg-surface text-text hover:bg-surface-2'
          }`}
        >
          <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded border ${conversion ? 'border-accent bg-accent text-on-accent' : 'border-border-strong'}`}>
            {conversion ? '✓' : ''}
          </span>
          <span className="min-w-0">{tipo === 'aporte' ? 'Vino de otra moneda (por ejemplo, dólares vendidos a cripto)' : 'Se convirtió a otra moneda al salir'}</span>
        </button>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {sale ? (
          <div className="min-w-0 space-y-3 rounded-xl border border-border p-3">
            <ElegirMoneda nombre="moneda_origen" valor={monedaSale} onCambio={setMonedaSale} leyenda={tipo === 'aporte' ? 'Moneda de origen' : 'Moneda que salió'} error={e.moneda_origen} />
            <Campo etiqueta={tipo === 'aporte' ? 'Monto de origen' : 'Cuánto salió'} htmlFor={`${id}-mo`} error={e.monto_origen}>
              <Entrada id={`${id}-mo`} name="monto_origen" inputMode="decimal" className="num" defaultValue={montoInicial('sale')} invalido={Boolean(e.monto_origen)} placeholder="1.234,56" />
            </Campo>
          </div>
        ) : null}
        {entra ? (
          <div className="min-w-0 space-y-3 rounded-xl border border-border p-3">
            <ElegirMoneda nombre="moneda_destino" valor={monedaEntra} onCambio={setMonedaEntra} leyenda={tipo === 'retiro' ? 'Moneda de destino' : 'Moneda que entró'} error={e.moneda_destino} />
            <Campo etiqueta={tipo === 'retiro' ? 'Monto de destino' : 'Cuánto entró'} htmlFor={`${id}-md`} error={e.monto_destino}>
              <Entrada id={`${id}-md`} name="monto_destino" inputMode="decimal" className="num" defaultValue={montoInicial('entra')} invalido={Boolean(e.monto_destino)} placeholder="1.234,56" />
            </Campo>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[12rem_12rem_1fr]">
        {sale && entra ? (
          <Campo etiqueta="Tipo de cambio aplicado" htmlFor={`${id}-tc`} error={e.tc_aplicado} ayuda="Si hubo conversión entre monedas.">
            <Entrada id={`${id}-tc`} name="tc_aplicado" inputMode="decimal" className="num" invalido={Boolean(e.tc_aplicado)} />
          </Campo>
        ) : null}
        {tipo === 'transferencia' ? (
          <Campo etiqueta="Impuesto (en la moneda de origen)" htmlFor={`${id}-i`} error={e.impuesto}>
            <Entrada id={`${id}-i`} name="impuesto" inputMode="decimal" className="num" invalido={Boolean(e.impuesto)} placeholder="0" />
          </Campo>
        ) : null}
        <Campo etiqueta="Notas" htmlFor={`${id}-n`} error={e.notas} className="sm:col-span-2 xl:col-span-1">
          <Entrada id={`${id}-n`} name="notas" maxLength={500} invalido={Boolean(e.notas)} placeholder="sueldo, a IEB para comprar LECAP…" />
        </Campo>
      </div>
      <Mensaje estado={estado} />
      <Boton type="submit" variante="primario" disabled={enviando} className="max-sm:w-full">
        {enviando ? 'Guardando…' : 'Registrar movimiento'}
      </Boton>
    </form>
  )
}

/** Un monto del movimiento en su moneda y en la otra, al CCL de su fecha. */
function MontoMovimiento({ valor, moneda, m, ccls, que }: { valor: string | null; moneda: Moneda | null; m: MovimientoFila; ccls: readonly CCL[]; que: string }) {
  if (valor === null || moneda === null) return <span className="text-muted">—</span>
  const par = enDosMonedas(valor, moneda, cclAl(ccls, m.fecha), {
    nombre: que,
    fecha: m.fecha,
    origen: m.carga_id ? { carga_id: m.carga_id } : undefined,
  })
  const [primero, segundo] = moneda === 'ARS' ? (['ARS', 'USD'] as const) : (['USD', 'ARS'] as const)
  return (
    <span className="flex min-w-0 flex-col">
      <MontoTrazado calc={primero === 'ARS' ? par.ars : par.usd} moneda={primero} titulo={`${que} en ${primero === 'ARS' ? 'pesos' : 'dólares'}`} />
      <span className="text-xs text-muted">
        <MontoTrazado calc={segundo === 'ARS' ? par.ars : par.usd} moneda={segundo} titulo={`${que} en ${segundo === 'ARS' ? 'pesos' : 'dólares'}`} />
      </span>
    </span>
  )
}

export function Movimientos({
  movimientos,
  cuentas,
  ccls,
  hoy,
  precarga,
}: {
  movimientos: MovimientoFila[]
  cuentas: CuentaCorta[]
  ccls: CCL[]
  hoy: Fecha
  precarga: PrecargaMovimiento | null
}) {
  const recientes = movimientos.slice(0, 30)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Plata que entra, sale o se mueve entre tus cuentas (D-06). Sin registrarla, un depósito se lee como ganancia y un retiro como pérdida.
      </p>
      {precarga?.monto ? (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-text" role="status">
          Vengo de Cargar: precargué {precarga.tipo === 'retiro' ? 'el retiro' : 'el aporte'} con lo que no explicó la TNA. Revisá el monto: es una ayuda, no un dato.
        </p>
      ) : null}
      <Panel titulo="Nuevo movimiento de capital">
        <FormMovimiento cuentas={cuentas} hoy={hoy} precarga={precarga} />
      </Panel>

      <section aria-labelledby="titulo-recientes" className="space-y-2">
        <h2 id="titulo-recientes" className="text-sm font-semibold tracking-wide text-muted uppercase">
          Últimos movimientos
        </h2>
        {recientes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted">Todavía no registraste movimientos.</p>
        ) : (
          <>
            {/* Desktop: tabla. */}
            <div className="hidden min-w-0 rounded-2xl border border-border bg-surface md:block">
              <table className="w-full table-fixed text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="w-24 px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Movimiento</th>
                    <th className="px-3 py-2 text-right font-medium">Salió</th>
                    <th className="px-3 py-2 text-right font-medium">Entró</th>
                    <th className="hidden px-3 py-2 font-medium lg:table-cell">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {recientes.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 align-top">
                      <td className="num px-3 py-2 text-text">
                        {fechaCorta(m.fecha)}
                        {m.fecha_acreditacion && m.fecha_acreditacion !== m.fecha ? (
                          <span className="block text-xs text-muted">acreditado {fechaCorta(m.fecha_acreditacion)}</span>
                        ) : null}
                      </td>
                      <td className="min-w-0 px-3 py-2 break-words text-text">
                        {describirMovimiento(m, cuentas)}
                        {!esCero(m.impuesto) ? <span className="num block text-xs text-muted">impuesto {monto(m.impuesto, m.moneda_origen ?? 'ARS', { decimales: 2 })}</span> : null}
                        {m.tc_aplicado ? <span className="num block text-xs text-muted">TC {numero(m.tc_aplicado, 2)}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <MontoMovimiento valor={m.monto_origen} moneda={m.moneda_origen} m={m} ccls={ccls} que="lo que salió" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <MontoMovimiento valor={m.monto_destino} moneda={m.moneda_destino} m={m} ccls={ccls} que="lo que entró" />
                      </td>
                      <td className="hidden min-w-0 px-3 py-2 break-words text-muted lg:table-cell">{m.notas ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Teléfono: tarjetas. */}
            <ul className="space-y-2 md:hidden">
              {recientes.map((m) => (
                <li key={m.id} className="min-w-0 rounded-2xl border border-border bg-surface p-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Chip>{fechaCorta(m.fecha)}</Chip>
                    <span className="min-w-0 font-medium break-words text-text">{describirMovimiento(m, cuentas)}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">Salió</dt>
                      <dd className="min-w-0">
                        <MontoMovimiento valor={m.monto_origen} moneda={m.moneda_origen} m={m} ccls={ccls} que="lo que salió" />
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">Entró</dt>
                      <dd className="min-w-0">
                        <MontoMovimiento valor={m.monto_destino} moneda={m.moneda_destino} m={m} ccls={ccls} que="lo que entró" />
                      </dd>
                    </div>
                  </dl>
                  {m.fecha_acreditacion && m.fecha_acreditacion !== m.fecha ? <p className="mt-1 text-xs text-muted">Acreditado el {fechaCorta(m.fecha_acreditacion)}.</p> : null}
                  {!esCero(m.impuesto) || m.tc_aplicado ? (
                    <p className="num mt-1 text-xs text-muted">
                      {!esCero(m.impuesto) ? `Impuesto ${monto(m.impuesto, m.moneda_origen ?? 'ARS', { decimales: 2 })}` : ''}
                      {!esCero(m.impuesto) && m.tc_aplicado ? ' · ' : ''}
                      {m.tc_aplicado ? `TC ${numero(m.tc_aplicado, 2)}` : ''}
                    </p>
                  ) : null}
                  {m.notas ? <p className="mt-1 text-sm break-words text-muted">{m.notas}</p> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
