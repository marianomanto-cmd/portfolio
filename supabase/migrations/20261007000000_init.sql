-- BORRADOR para revisar. No aplicado.
--
-- Principios:
--   * Se guardan hechos (operaciones, precios, tipos de cambio, cuotas), nunca
--     estado derivado. Posiciones, PPC, excedente y vencimientos se calculan.
--   * Sin defaults en precios ni tipos de cambio: mejor que falle el insert a
--     que grabe un número inventado. Un dato faltante es NULL = "sin dato".
--   * RLS prendido en todo y sin políticas: anon y authenticated no ven nada.
--     El servidor usa service_role, que bypassea RLS.
--   * Fechas = día calendario en America/Argentina/Cordoba.

-- ───────────────────────── Catálogos ─────────────────────────

create table cuentas (
  id        smallint generated always as identity primary key,
  nombre    text not null unique,                    -- "Bróker X", "Banco A remunerada"
  tipo      text not null check (tipo in ('broker','banco','billetera','fci')),
  activa    boolean not null default true
);

create table activos (
  id                  smallint generated always as identity primary key,
  ticker              text not null unique,
  nombre              text not null,
  tipo                text not null check (tipo in ('cedear','accion_local','bono','lecap','fci','liquidez')),
  -- Moneda a la que el activo te expone, no la de cotización. Un CEDEAR cotiza
  -- en pesos pero es 'USD'. Es lo que usa Exposición.
  moneda_riesgo       text not null check (moneda_riesgo in ('ARS','USD')),
  geografia           text not null check (geografia in ('AR','US','BR','GLOBAL')),
  mercado             text,
  ticker_subyacente   text,
  -- Bonos y letras cotizan cada 100 VN. El precio guardado es el del bróker
  -- tal cual; el valor de la posición es cantidad * precio / unidad_cotizacion.
  unidad_cotizacion   numeric not null default 1 check (unidad_cotizacion > 0),
  fecha_vencimiento   date,
  color               text,                          -- mismo color en todos los gráficos
  activo_bool         boolean not null default true,
  check ((tipo = 'cedear') = (ticker_subyacente is not null))
);

-- Ratio con historial. "ratio" = CEDEARs por 1 acción subyacente.
-- Un cambio de ratio también cambia tu cantidad: eso entra como operación
-- 'ajuste_ratio', no como edición de este número.
create table ratios_cedear (
  activo_id      smallint not null references activos(id),
  vigente_desde  date not null,
  ratio          numeric not null check (ratio > 0),
  primary key (activo_id, vigente_desde)
);

-- Flujos contractuales de bonos y letras, por unidad_cotizacion de VN.
-- Una LECAP tiene un solo flujo: el valor final al vencimiento.
-- Alimenta TIR/TEM y los vencimientos del calendario.
create table flujos_bono (
  activo_id     smallint not null references activos(id),
  fecha         date not null,
  interes       numeric not null default 0 check (interes >= 0),
  amortizacion  numeric not null default 0 check (amortizacion >= 0),
  primary key (activo_id, fecha)
);

-- ───────────────────────── Mercado (carga diaria) ─────────────────────────

create table tipo_cambio (
  fecha         date primary key,
  ccl           numeric check (ccl > 0),
  mep           numeric check (mep > 0),
  cripto_venta  numeric check (cripto_venta > 0),    -- al que vos vendés: manda para ingresos
  oficial       numeric check (oficial > 0)
);

create table cotizaciones (
  fecha                  date not null,
  activo_id              smallint not null references activos(id),
  precio_pesos           numeric not null check (precio_pesos > 0),  -- por unidad_cotizacion
  precio_usd_subyacente  numeric check (precio_usd_subyacente > 0),
  fuente                 text not null check (fuente in ('pegado','manual')),
  primary key (fecha, activo_id)
);
create index cotizaciones_activo_fecha on cotizaciones (activo_id, fecha desc);

-- ───────────────────────── Cartera ─────────────────────────

create table operaciones (
  id            bigint generated always as identity primary key,
  fecha         date not null,
  cuenta_id     smallint not null references cuentas(id),
  activo_id     smallint not null references activos(id),
  tipo          text not null check (tipo in (
                  'apertura',       -- saldo inicial con costo declarado
                  'compra','venta',
                  'vencimiento',    -- cantidad sale, entra importe
                  'renta','amortizacion',  -- entra importe, cantidad no cambia
                  'ajuste_ratio')), -- split/cambio de ratio: cantidad con signo, sin precio
  cantidad      numeric not null,
  precio_pesos  numeric check (precio_pesos > 0),     -- por unidad_cotizacion
  importe_pesos numeric,                              -- cobrado en renta/amortizacion/vencimiento
  comisiones    numeric not null default 0 check (comisiones >= 0),
  ccl_del_dia   numeric not null check (ccl_del_dia > 0),  -- sin esto no hay PPC en USD
  notas         text,
  creado_en     timestamptz not null default now(),
  check (case tipo
    when 'ajuste_ratio' then cantidad <> 0 and precio_pesos is null
    when 'renta'        then importe_pesos > 0
    when 'amortizacion' then importe_pesos > 0
    when 'vencimiento'  then cantidad > 0 and importe_pesos > 0
    else cantidad > 0 and precio_pesos is not null
  end)
);
create index operaciones_activo_fecha on operaciones (activo_id, fecha);

-- Excepción explícita a "derivá todo": la liquidez remunerada cambia todos los
-- días por intereses sin que haya una operación. Su verdad es el saldo que
-- muestra el banco, así que se carga el saldo. Último saldo conocido = vigente.
create table saldos_liquidez (
  fecha      date not null,
  cuenta_id  smallint not null references cuentas(id),
  moneda     text not null check (moneda in ('ARS','USD')),
  monto      numeric not null check (monto >= 0),
  primary key (fecha, cuenta_id, moneda)
);

-- ───────────────────────── Disciplina (fase 4, schema ya) ─────────────────────────

create table niveles (
  id                      bigint generated always as identity primary key,
  activo_id               smallint not null references activos(id),
  fecha_definicion        date not null,
  nivel_entrada_decidido  numeric not null check (nivel_entrada_decidido > 0),
  tramo                   smallint not null default 1,
  nivel_invalidacion      numeric check (nivel_invalidacion > 0),
  tesis_texto             text not null,
  estado                  text not null default 'pendiente'
                          check (estado in ('pendiente','ejecutado','invalidado','abandonado')),
  -- Precio y fecha reales salen de la operación: no se cargan dos veces.
  operacion_id            bigint references operaciones(id),
  check ((estado = 'ejecutado') = (operacion_id is not null))
);

-- ───────────────────────── Pasivos ─────────────────────────

create table pasivos (
  id                   smallint generated always as identity primary key,
  nombre               text not null unique,
  tipo                 text not null check (tipo in ('leasing','tarjeta','prestamo')),
  moneda               text not null check (moneda in ('ARS','USD')),
  cuotas_totales       smallint not null check (cuotas_totales > 0),
  -- cuotas_pagadas no existe: se cuenta en pasivo_cuotas.
  opcion_compra_monto  numeric check (opcion_compra_monto >= 0),
  opcion_compra_fecha  date,
  valor_bien           numeric check (valor_bien > 0),
  valor_bien_fecha     date
);

create table pasivo_cuotas (
  pasivo_id          smallint not null references pasivos(id),
  nro                smallint not null check (nro > 0),
  fecha_vencimiento  date not null,
  capital_o_canon    numeric not null check (capital_o_canon >= 0),
  seguro             numeric not null default 0,
  otros_conceptos    numeric not null default 0,
  total_pesos        numeric generated always as (capital_o_canon + seguro + otros_conceptos) stored,
  iva_contenido      numeric not null default 0,
  base_ganancias     numeric not null default 0,
  fecha_pago         date,                            -- null = no pagada
  ccl_del_dia_pago   numeric check (ccl_del_dia_pago > 0),
  primary key (pasivo_id, nro),
  check ((fecha_pago is null) = (ccl_del_dia_pago is null))
);

-- ───────────────────────── Flujo de caja ─────────────────────────

-- Ingresos y gastos recurrentes: definen el flujo PROYECTADO.
create table ingresos_fijos (
  id             smallint generated always as identity primary key,
  concepto       text not null,
  moneda         text not null check (moneda in ('ARS','USD')),
  monto          numeric not null check (monto > 0),
  vigente_desde  date not null,
  vigente_hasta  date
);

create table gastos_fijos (
  id             smallint generated always as identity primary key,
  concepto       text not null,
  categoria      text not null,
  monto_pesos    numeric not null check (monto_pesos > 0),
  vigente_desde  date not null,
  vigente_hasta  date
);

-- Lo que REALMENTE pasó en el mes. Sólo insumos: total de gastos, cuotas y
-- excedente se derivan (vista/función), no se guardan.
create table flujo_mensual (
  mes                 date primary key check (extract(day from mes) = 1),
  ingreso_usd         numeric check (ingreso_usd >= 0),
  cripto_venta_usado  numeric check (cripto_venta_usado > 0),
  ingreso_pesos       numeric check (ingreso_pesos >= 0),
  gastos_variables    numeric check (gastos_variables >= 0),
  notas               text
);

-- ───────────────────────── Proyecciones y calendario ─────────────────────────

create table escenarios (
  id              smallint generated always as identity primary key,
  nombre          text not null unique,
  supuestos       jsonb not null,    -- validado con zod en el server, con "version"
  notas           text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- El monto de un vencimiento se calcula (flujos_bono × cantidad a esa fecha).
-- Acá vive sólo lo que no se puede derivar: tu decisión.
create table vencimientos (
  activo_id         smallint not null references activos(id),
  fecha             date not null,
  destino_decidido  text,
  notas             text,
  primary key (activo_id, fecha)
);

create table eventos (
  id         bigint generated always as identity primary key,
  fecha      date not null,
  tipo       text not null check (tipo in ('balance','macro','otro')),
  titulo     text not null,
  activo_id  smallint references activos(id)
);

-- ───────────────────────── Vistas (sólo agregación simple) ─────────────────────────
-- PPC, resultados y desglose activo/TC NO van en SQL: van en funciones puras de
-- TypeScript con tests y trazabilidad. Duplicar la lógica en dos lugares es
-- garantizar que en algún momento difieran.

create view v_tenencias with (security_invoker = true) as
select cuenta_id, activo_id,
       sum(case when tipo in ('apertura','compra') then cantidad
                when tipo in ('venta','vencimiento') then -cantidad
                when tipo = 'ajuste_ratio' then cantidad
                else 0 end) as cantidad
from operaciones
group by cuenta_id, activo_id;

create view v_ultima_cotizacion with (security_invoker = true) as
select distinct on (activo_id) activo_id, fecha, precio_pesos, precio_usd_subyacente
from cotizaciones
order by activo_id, fecha desc;

-- ───────────────────────── Seguridad ─────────────────────────

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
