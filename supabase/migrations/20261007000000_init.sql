-- Schema inicial. Una sola persona, un solo entorno.
--
-- Principios:
--   * Se guardan hechos (operaciones, precios, tipos de cambio, saldos, cuotas),
--     nunca estado derivado. Posiciones, PPC, excedente y montos de vencimiento
--     se calculan en funciones puras de TypeScript con tests y trazabilidad.
--   * Sin defaults en precios ni tipos de cambio: mejor que falle el insert a
--     que grabe un número inventado. Un dato faltante es NULL = "sin dato".
--   * Precios de bonos y letras NORMALIZADOS POR 1 VN. Cada bróker cotiza en
--     su escala (IEB cada 100 VN, Galicia por 1 VN); el parser lo convierte al
--     cargar. Así ningún cálculo tiene que saber de qué bróker vino el precio.
--   * Todo dato cargado apunta a la carga (archivo o captura) de la que salió.
--   * RLS prendido en todo y sin políticas: anon y authenticated no ven nada.
--     El servidor usa service_role, que bypassea RLS.
--   * Fechas = día calendario en America/Argentina/Cordoba.

-- ───────────────────────── Catálogos ─────────────────────────

create table cuentas (
  id      smallint generated always as identity primary key,
  nombre  text not null unique,
  tipo    text not null check (tipo in ('broker','banco','billetera')),
  -- Cómo llega la info de esta cuenta a la pantalla de carga.
  formato_carga text not null check (formato_carga in ('excel_ieb','captura','manual')),
  activa  boolean not null default true
);

create table activos (
  id                 smallint generated always as identity primary key,
  ticker             text not null unique,
  nombre             text not null,
  -- Sin 'liquidez': el efectivo y las cuentas remuneradas van en saldos_liquidez.
  tipo               text not null check (tipo in ('cedear','accion_local','bono','lecap','fci')),
  -- Moneda a la que el activo te expone, no la de cotización. Un CEDEAR cotiza
  -- en pesos pero es 'USD'. Es lo que usa Exposición. Editable por activo.
  moneda_riesgo      text not null check (moneda_riesgo in ('ARS','USD')),
  geografia          text not null check (geografia in ('AR','US','BR','GLOBAL')),
  -- Sólo bonos y letras: cómo se ajusta el capital. Alimenta TEM y proyecciones.
  indexacion         text check (indexacion in ('fija','cer','tamar','dual_cer_tamar','dolar_linked','hard_dollar')),
  mercado            text,
  ticker_subyacente  text,
  fecha_vencimiento  date,
  color              text,            -- mismo color en todos los gráficos
  activo_bool        boolean not null default true,
  check (tipo <> 'cedear' or ticker_subyacente is not null),
  check ((tipo in ('bono','lecap')) = (indexacion is not null))
);

-- Ratio con historial. ratio = CEDEARs por 1 acción subyacente.
-- Un cambio de ratio cambia también tu cantidad: eso entra como operación
-- 'ajuste_ratio', no editando este número.
create table ratios_cedear (
  activo_id      smallint not null references activos(id),
  vigente_desde  date not null,
  ratio          numeric not null check (ratio > 0),
  primary key (activo_id, vigente_desde)
);

-- Flujos contractuales por 1 VN. Una LECAP/BONCAP tiene un solo flujo: el pago
-- final. En bonos CER los montos son sobre capital sin ajustar; el ajuste sale
-- de `indices`. Alimenta TIR/TEM y los montos de los vencimientos.
create table flujos_bono (
  activo_id     smallint not null references activos(id),
  fecha         date not null,
  interes       numeric not null default 0 check (interes >= 0),
  amortizacion  numeric not null default 0 check (amortizacion >= 0),
  primary key (activo_id, fecha)
);

-- Series de índices cargadas a mano (CER, TAMAR). Sin serie, el valor técnico
-- de un bono indexado es "sin dato".
create table indices (
  indice  text not null check (indice in ('cer','tamar')),
  fecha   date not null,
  valor   numeric not null check (valor > 0),
  primary key (indice, fecha)
);

-- ───────────────────────── Cargas (trazabilidad del origen) ─────────────────────────

-- Cada vez que se confirma algo en la pantalla de carga queda una fila acá.
-- Cotizaciones, saldos y operaciones apuntan a su carga, así cualquier precio
-- se puede rastrear hasta el Excel o la captura de la que salió.
create table cargas (
  id            bigint generated always as identity primary key,
  fecha         date not null,
  cuenta_id     smallint references cuentas(id),    -- null = carga de tipo de cambio sola
  origen        text not null check (origen in ('excel','captura','manual')),
  archivo_path  text,                               -- Storage, bucket privado 'cargas'
  -- Lo que leyó el parser o el modelo, tal cual, antes de que lo confirmaras.
  lectura_cruda jsonb,
  creado_en     timestamptz not null default now(),
  check ((origen = 'manual') = (archivo_path is null))
);

-- ───────────────────────── Mercado ─────────────────────────

create table tipo_cambio (
  fecha         date primary key,
  ccl           numeric check (ccl > 0),
  mep           numeric check (mep > 0),
  cripto_venta  numeric check (cripto_venta > 0),  -- al que vendés: manda para ingresos
  oficial       numeric check (oficial > 0)
);

create table cotizaciones (
  fecha                  date not null,
  activo_id              smallint not null references activos(id),
  precio_pesos           numeric not null check (precio_pesos > 0),  -- por 1 VN / 1 unidad
  precio_usd_subyacente  numeric check (precio_usd_subyacente > 0),
  fuente                 text not null check (fuente in ('excel','captura','manual')),
  carga_id               bigint references cargas(id),
  primary key (fecha, activo_id)
);
create index cotizaciones_activo_fecha on cotizaciones (activo_id, fecha desc);

-- ───────────────────────── Cartera ─────────────────────────

create table operaciones (
  id             bigint generated always as identity primary key,
  fecha          date not null,
  cuenta_id      smallint not null references cuentas(id),
  activo_id      smallint not null references activos(id),
  tipo           text not null check (tipo in (
                   'apertura',                -- saldo inicial con costo declarado (PPP del bróker)
                   'compra','venta',
                   'vencimiento',             -- sale la cantidad, entra importe
                   'renta','amortizacion',    -- entra importe, la cantidad no cambia
                   'ajuste_ratio')),          -- split / cambio de ratio: cantidad con signo
  cantidad       numeric not null,
  precio_pesos   numeric check (precio_pesos > 0),   -- por 1 VN / 1 unidad
  importe_pesos  numeric check (importe_pesos > 0),  -- cobrado en renta/amortizacion/vencimiento
  comisiones     numeric not null default 0 check (comisiones >= 0),
  -- Obligatorio salvo en 'apertura': de una tenencia vieja muchas veces no
  -- sabés a qué CCL compraste. Ahí el PPC en USD es "sin dato", no un invento.
  ccl_del_dia    numeric check (ccl_del_dia > 0),
  carga_id       bigint references cargas(id),
  notas          text,
  creado_en      timestamptz not null default now(),
  check (tipo = 'apertura' or ccl_del_dia is not null),
  check (case tipo
    when 'ajuste_ratio' then cantidad <> 0 and precio_pesos is null and importe_pesos is null
    when 'renta'        then cantidad = 0 and precio_pesos is null and importe_pesos is not null
    when 'amortizacion' then cantidad = 0 and precio_pesos is null and importe_pesos is not null
    when 'vencimiento'  then cantidad > 0 and precio_pesos is null and importe_pesos is not null
    else                     cantidad > 0 and precio_pesos is not null and importe_pesos is null
  end)
);
create index operaciones_activo_fecha on operaciones (activo_id, fecha);

-- Excepción explícita a "derivá todo": una cuenta remunerada o el efectivo del
-- bróker cambian por intereses y liquidaciones sin que haya una operación. Su
-- verdad es el saldo que muestra la cuenta. Último saldo conocido = vigente.
-- En IEB se toma el saldo "Total" (ya neto de lo que falta liquidar), no "Hoy".
create table saldos_liquidez (
  fecha      date not null,
  cuenta_id  smallint not null references cuentas(id),
  moneda     text not null check (moneda in ('ARS','USD')),
  monto      numeric not null check (monto >= 0),
  carga_id   bigint references cargas(id),
  primary key (fecha, cuenta_id, moneda)
);

-- ───────────────────────── Disciplina (fase 4) ─────────────────────────

create table niveles (
  id                      bigint generated always as identity primary key,
  activo_id               smallint not null references activos(id),
  fecha_definicion        date not null,
  nivel_entrada_decidido  numeric not null check (nivel_entrada_decidido > 0),
  tramo                   smallint not null default 1 check (tramo > 0),
  nivel_invalidacion      numeric check (nivel_invalidacion > 0),
  tesis_texto             text not null,
  estado                  text not null default 'pendiente'
                          check (estado in ('pendiente','ejecutado','invalidado','abandonado')),
  -- Precio y fecha reales salen de la operación: no se cargan dos veces.
  operacion_id            bigint unique references operaciones(id),
  check ((estado = 'ejecutado') = (operacion_id is not null))
);

-- ───────────────────────── Pasivos (fase 2) ─────────────────────────

create table pasivos (
  id                   smallint generated always as identity primary key,
  nombre               text not null unique,
  tipo                 text not null check (tipo in ('leasing','tarjeta','prestamo')),
  moneda               text not null check (moneda in ('ARS','USD')),
  fecha_inicio         date not null,
  cuotas_totales       smallint not null check (cuotas_totales > 0),
  -- cuotas_pagadas no existe: se cuenta en pasivo_cuotas.
  -- Con monto_financiado + cuotas sale la tasa implícita, y con ella el capital
  -- pendiente, que es lo que netea en Exposición (la suma nominal de cuotas
  -- incluye intereses futuros e infla la deuda).
  monto_financiado     numeric check (monto_financiado > 0),
  valor_bien           numeric check (valor_bien > 0),
  opcion_compra_monto  numeric check (opcion_compra_monto >= 0),
  opcion_compra_fecha  date
);

create table pasivo_cuotas (
  pasivo_id          smallint not null references pasivos(id),
  nro                smallint not null check (nro > 0),
  fecha_vencimiento  date not null,
  capital_o_canon    numeric not null check (capital_o_canon >= 0),
  seguro             numeric not null default 0 check (seguro >= 0),
  otros_conceptos    numeric not null default 0 check (otros_conceptos >= 0),
  total_pesos        numeric generated always as (capital_o_canon + seguro + otros_conceptos) stored,
  iva_contenido      numeric not null default 0 check (iva_contenido >= 0),
  base_ganancias     numeric not null default 0 check (base_ganancias >= 0),
  fecha_pago         date,                          -- null = impaga
  ccl_del_dia_pago   numeric check (ccl_del_dia_pago > 0),
  primary key (pasivo_id, nro),
  check ((fecha_pago is null) = (ccl_del_dia_pago is null))
);

-- ───────────────────────── Flujo de caja (fase 2) ─────────────────────────

-- Recurrentes: definen el flujo PROYECTADO.
create table ingresos_fijos (
  id             smallint generated always as identity primary key,
  concepto       text not null,
  moneda         text not null check (moneda in ('ARS','USD')),
  monto          numeric not null check (monto > 0),
  vigente_desde  date not null,
  vigente_hasta  date,
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create table gastos_fijos (
  id             smallint generated always as identity primary key,
  concepto       text not null,
  categoria      text not null,
  monto_pesos    numeric not null check (monto_pesos > 0),
  vigente_desde  date not null,
  vigente_hasta  date,
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

-- Lo que REALMENTE pasó. Sólo insumos: total de gastos, cuotas y excedente se
-- derivan, no se guardan.
create table flujo_mensual (
  mes                 date primary key check (extract(day from mes) = 1),
  ingreso_usd         numeric check (ingreso_usd >= 0),
  cripto_venta_usado  numeric check (cripto_venta_usado > 0),
  ingreso_pesos       numeric check (ingreso_pesos >= 0),
  gastos_variables    numeric check (gastos_variables >= 0),
  notas               text
);

-- ───────────────────────── Proyecciones y calendario (fases 2-3) ─────────────────────────

create table escenarios (
  id              smallint generated always as identity primary key,
  nombre          text not null unique,
  supuestos       jsonb not null,   -- validado con zod en el server; lleva "version"
  notas           text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- El monto se calcula (flujos_bono × cantidad a esa fecha). Acá vive sólo lo
-- que no se puede derivar: tu decisión.
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
-- PPC, resultados y desglose activo/TC NO van en SQL: van en TypeScript con
-- tests y trazabilidad. La misma lógica en dos lugares termina difiriendo.

create view v_tenencias with (security_invoker = true) as
select cuenta_id, activo_id,
       sum(case when tipo in ('apertura','compra') then cantidad
                when tipo in ('venta','vencimiento') then -cantidad
                when tipo = 'ajuste_ratio' then cantidad
                else 0 end) as cantidad
from operaciones
group by cuenta_id, activo_id;

create view v_ultima_cotizacion with (security_invoker = true) as
select distinct on (activo_id) activo_id, fecha, precio_pesos, precio_usd_subyacente, fuente
from cotizaciones
order by activo_id, fecha desc;

create view v_ultimo_saldo with (security_invoker = true) as
select distinct on (cuenta_id, moneda) cuenta_id, moneda, fecha, monto
from saldos_liquidez
order by cuenta_id, moneda, fecha desc;

-- ───────────────────────── Storage ─────────────────────────

insert into storage.buckets (id, name, public)
values ('cargas', 'cargas', false)
on conflict (id) do nothing;

-- ───────────────────────── Seguridad ─────────────────────────

alter table cuentas          enable row level security;
alter table activos          enable row level security;
alter table ratios_cedear    enable row level security;
alter table flujos_bono      enable row level security;
alter table indices          enable row level security;
alter table cargas           enable row level security;
alter table tipo_cambio      enable row level security;
alter table cotizaciones     enable row level security;
alter table operaciones      enable row level security;
alter table saldos_liquidez  enable row level security;
alter table niveles          enable row level security;
alter table pasivos          enable row level security;
alter table pasivo_cuotas    enable row level security;
alter table ingresos_fijos   enable row level security;
alter table gastos_fijos     enable row level security;
alter table flujo_mensual    enable row level security;
alter table escenarios       enable row level security;
alter table vencimientos     enable row level security;
alter table eventos          enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
