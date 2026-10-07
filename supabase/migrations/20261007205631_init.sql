-- Schema inicial. Una sola persona, un solo entorno.
--
-- Principios (detalle en docs/decisiones.md y docs/datos.md):
--   * Se guardan hechos (operaciones, precios, tipos de cambio, saldos, cuotas,
--     valuaciones), nunca estado derivado. Posiciones, PPC, resultados,
--     excedente y montos de vencimiento se calculan en TypeScript (D-22, D-23).
--   * Sin defaults en precios ni tipos de cambio. Un dato faltante es NULL =
--     "sin dato", nunca cero ni un estimado.
--   * Todo hecho cargado apunta a la carga de la que salió (carga_id NOT NULL).
--     Una carga se revierte como unidad y queda en el registro (D-17).
--   * Precios de bonos y letras normalizados por 1 VN original (D-12).
--   * Montos: numeric sin precisión fija, con checks que además excluyen NaN e
--     Infinity (en Postgres NaN es mayor que todo y Infinity > 0) (D-32).
--   * RLS en todo y sin políticas. anon y authenticated sin privilegios. El
--     servidor usa service_role con grants explícitos (D-20).
--   * Fechas = día calendario en America/Argentina/Cordoba.

-- ═════════════════════════ Catálogos ═════════════════════════

create table cuentas (
  id             smallint generated always as identity primary key,
  nombre         text not null unique,
  tipo           text not null check (tipo in ('broker','banco','billetera')),
  -- Cómo llega la info de esta cuenta a la pantalla de carga (D-10).
  formato_carga  text not null check (formato_carga in ('excel_ieb','captura','manual')),
  activa         boolean not null default true
);

create table activos (
  id                 smallint generated always as identity primary key,
  ticker             text not null unique,
  nombre             text not null,
  -- Sin 'liquidez': el efectivo y las cuentas remuneradas van en saldos_liquidez (D-13).
  tipo               text not null check (tipo in ('cedear','accion_local','bono','lecap','fci')),
  -- Moneda a la que el activo expone, no la de cotización: un CEDEAR cotiza en
  -- pesos y es 'USD'. Es lo que usa Exposición.
  moneda_riesgo      text not null check (moneda_riesgo in ('ARS','USD')),
  geografia          text not null check (geografia in ('AR','US','BR','GLOBAL')),
  -- Sólo bonos y letras.
  indexacion         text check (indexacion in ('fija','cer','tamar','dual_cer_tamar','dolar_linked','hard_dollar')),
  mercado            text,
  ticker_subyacente  text,
  fecha_vencimiento  date,
  color              text check (color ~ '^#[0-9a-fA-F]{6}$'),  -- mismo color en todos los gráficos
  activo_bool        boolean not null default true,
  check (tipo <> 'cedear' or ticker_subyacente is not null),
  check ((tipo in ('bono','lecap')) = (indexacion is not null))
);

-- Condiciones de emisión que no son flujos: base del índice, rezago, spread.
-- Sólo bonos indexados o duales. Sin estos datos, valor técnico = "sin dato".
create table condiciones_bono (
  activo_id         smallint primary key references activos(id),
  fecha_emision     date,
  cer_base          numeric check (cer_base > 0 and cer_base < 'Infinity'),
  lag_dias_habiles  smallint not null default 10 check (lag_dias_habiles >= 0),
  tasa_real         numeric check (tasa_real > '-Infinity' and tasa_real < 'Infinity'),
  tamar_spread      numeric check (tamar_spread > '-Infinity' and tamar_spread < 'Infinity'),
  regla_dual        text check (regla_dual in ('max_cer_tamar')),
  detalle           jsonb
);

-- ratio = CEDEARs por 1 acción subyacente. Un cambio de ratio cambia también la
-- cantidad: eso entra como operación 'ajuste_ratio'.
create table ratios_cedear (
  activo_id      smallint not null references activos(id),
  vigente_desde  date not null,
  ratio          numeric not null check (ratio > 0 and ratio < 'Infinity'),
  primary key (activo_id, vigente_desde)
);

-- Flujos contractuales por 1 VN original, sin ajustar. LECAP/BONCAP: un solo
-- flujo (el pago final). interes NULL = "a determinar" (cupones TAMAR, duales).
create table flujos_bono (
  activo_id     smallint not null references activos(id),
  fecha         date not null,
  interes       numeric check (interes >= 0 and interes < 'Infinity'),
  amortizacion  numeric not null default 0 check (amortizacion >= 0 and amortizacion < 'Infinity'),
  primary key (activo_id, fecha)
);

-- Días no hábiles. Se siembra una vez por año y se corrige con el calendario
-- de BYMA (D-16). 'US' para lo que dependa del mercado de EE.UU.
create table feriados (
  mercado      text not null check (mercado in ('AR','US')),
  fecha        date not null,
  descripcion  text not null,
  primary key (mercado, fecha)
);

-- ═════════════════════════ Cargas (origen de todo dato) ═════════════════════════

create table cargas (
  id                bigint generated always as identity primary key,
  fecha             date not null,
  cuenta_id         smallint references cuentas(id),   -- null = carga sin cuenta (tipo de cambio, bienes, pasivos)
  origen            text not null check (origen in ('excel','captura','manual')),
  archivo_path      text,                              -- Storage, bucket privado 'cargas'
  lectura_cruda     jsonb,                             -- lo que leyó el parser o el modelo, antes de confirmar
  grabado           jsonb,                             -- lo confirmado por posición + diferencias de conciliación y su resolución
  listado_completo  boolean not null default true,     -- la fuente lista TODAS las tenencias de la cuenta
  estado            text not null default 'vigente' check (estado in ('vigente','reemplazada','revertida')),
  reemplaza_a       bigint references cargas(id),
  confirm_token     uuid unique,                       -- idempotencia: un doble Enter no duplica
  creado_en         timestamptz not null default now(),
  revertida_en      timestamptz,
  check ((origen = 'manual') = (archivo_path is null)),
  check ((estado = 'revertida') = (revertida_en is not null))
);

-- ═════════════════════════ Mercado ═════════════════════════

create table tipo_cambio (
  fecha         date primary key,
  ccl           numeric check (ccl > 0 and ccl < 'Infinity'),
  mep           numeric check (mep > 0 and mep < 'Infinity'),
  cripto_venta  numeric check (cripto_venta > 0 and cripto_venta < 'Infinity'),  -- al que vendés: manda para ingresos
  oficial       numeric check (oficial > 0 and oficial < 'Infinity'),
  carga_id      bigint not null references cargas(id)
);

create table cotizaciones (
  fecha                  date not null,
  activo_id              smallint not null references activos(id),
  precio_pesos           numeric not null check (precio_pesos > 0 and precio_pesos < 'Infinity'),  -- por 1 VN / 1 unidad
  precio_usd_subyacente  numeric check (precio_usd_subyacente > 0 and precio_usd_subyacente < 'Infinity'),
  carga_id               bigint not null references cargas(id),
  primary key (fecha, activo_id)
);
create index cotizaciones_activo_fecha on cotizaciones (activo_id, fecha desc);
create index cotizaciones_carga on cotizaciones (carga_id);

create table indices (
  indice    text not null check (indice in ('cer','tamar')),
  fecha     date not null,
  valor     numeric not null check (valor > 0 and valor < 'Infinity'),
  carga_id  bigint not null references cargas(id),
  primary key (indice, fecha)
);

-- ═════════════════════════ Cartera ═════════════════════════

create table operaciones (
  id            bigint generated always as identity primary key,
  fecha         date not null,
  -- Sólo 'apertura': fecha real de compra, si se conoce. Días en posición y
  -- TIR la usan; si falta, se muestran "desde apertura".
  fecha_origen  date,
  cuenta_id     smallint not null references cuentas(id),
  activo_id     smallint not null references activos(id),
  tipo          text not null check (tipo in (
                  'apertura',               -- tenencia inicial; costo = PPP del bróker o "sin dato"
                  'compra','venta',
                  'vencimiento',            -- sale la cantidad, entra importe
                  'renta','amortizacion',   -- entra importe, la cantidad no cambia
                  'ajuste_ratio')),         -- split / cambio de ratio: cantidad con signo
  cantidad      numeric not null check (cantidad > '-Infinity' and cantidad < 'Infinity'),
  -- Moneda de precio, importe y comisiones (dividendos de CEDEAR y bonos
  -- hard dollar se cobran en USD).
  moneda        text not null default 'ARS' check (moneda in ('ARS','USD')),
  precio        numeric check (precio > 0 and precio < 'Infinity'),       -- por 1 VN / 1 unidad
  -- compra/venta: total liquidado con comisiones, si se conoce.
  -- renta/amortizacion/vencimiento: lo cobrado, neto.
  importe       numeric check (importe > 0 and importe < 'Infinity'),
  comisiones    numeric not null default 0 check (comisiones >= 0 and comisiones < 'Infinity'),
  -- Obligatorio salvo en 'apertura': de una tenencia vieja muchas veces no se
  -- sabe el CCL. Ahí el PPC en USD es "sin dato" (D-14).
  ccl_del_dia   numeric check (ccl_del_dia > 0 and ccl_del_dia < 'Infinity'),
  carga_id      bigint not null references cargas(id),
  notas         text,
  creado_en     timestamptz not null default now(),
  constraint operaciones_ccl check (tipo = 'apertura' or ccl_del_dia is not null),
  constraint operaciones_fecha_origen check (
    (tipo = 'apertura' or fecha_origen is null)
    and (fecha_origen is null or fecha_origen <= fecha)
    and (tipo <> 'apertura' or ccl_del_dia is null or fecha_origen is not null)),
  constraint operaciones_forma check (case tipo
    -- precio NULL = costo "sin dato" (tenencia vieja sin PPP)
    when 'apertura'     then cantidad > 0 and importe is null
    -- precio e importe NULL = costo pendiente (compra del día: el bróker muestra PPP '-')
    when 'compra'       then cantidad > 0
    when 'venta'        then cantidad > 0 and num_nonnulls(precio, importe) >= 1
    when 'vencimiento'  then cantidad > 0 and precio is null and importe is not null
    when 'renta'        then cantidad = 0 and precio is null and importe is not null
    when 'amortizacion' then cantidad = 0 and precio is null and importe is not null
    when 'ajuste_ratio' then cantidad <> 0 and precio is null and importe is null
  end)
);
create index operaciones_activo_fecha on operaciones (activo_id, fecha);
create index operaciones_carga on operaciones (carga_id);
-- Una sola apertura por tenencia: una recarga no puede duplicarla.
create unique index operaciones_una_apertura on operaciones (cuenta_id, activo_id) where tipo = 'apertura';

-- Excepción explícita a "derivá todo" (D-13): el efectivo y las cuentas
-- remuneradas cambian sin operaciones. La verdad es el saldo de la cuenta.
-- Puede ser negativo: el "Total" de IEB (neto de lo que falta liquidar) queda
-- en rojo cuando una compra a liquidar supera el efectivo. Eso es deuda en
-- pesos y Exposición lo toma así.
create table saldos_liquidez (
  fecha      date not null,
  cuenta_id  smallint not null references cuentas(id),
  moneda     text not null check (moneda in ('ARS','USD')),
  monto      numeric not null check (monto > '-Infinity' and monto < 'Infinity'),
  carga_id   bigint not null references cargas(id),
  primary key (fecha, cuenta_id, moneda)
);
create index saldos_carga on saldos_liquidez (carga_id);

-- Plata que entra, sale o se mueve entre cuentas propias (D-06). Sin esto un
-- depósito se leería como ganancia.
--   aporte:        de afuera hacia una cuenta (ej. USD vendidos a cripto que llegan en pesos)
--   retiro:        de una cuenta hacia afuera
--   transferencia: entre cuentas propias (la rutina de liquidez), con su impuesto
create table movimientos_capital (
  id                  bigint generated always as identity primary key,
  fecha               date not null,
  fecha_acreditacion  date,
  tipo                text not null check (tipo in ('aporte','retiro','transferencia')),
  cuenta_origen_id    smallint references cuentas(id),
  cuenta_destino_id   smallint references cuentas(id),
  moneda_origen       text check (moneda_origen in ('ARS','USD')),
  monto_origen        numeric check (monto_origen > 0 and monto_origen < 'Infinity'),
  moneda_destino      text check (moneda_destino in ('ARS','USD')),
  monto_destino       numeric check (monto_destino > 0 and monto_destino < 'Infinity'),
  tc_aplicado         numeric check (tc_aplicado > 0 and tc_aplicado < 'Infinity'),
  impuesto            numeric not null default 0 check (impuesto >= 0 and impuesto < 'Infinity'),  -- en moneda_origen
  carga_id            bigint not null references cargas(id),
  notas               text,
  check (fecha_acreditacion is null or fecha_acreditacion >= fecha),
  check ((moneda_origen is null) = (monto_origen is null)),
  check ((moneda_destino is null) = (monto_destino is null)),
  check (case tipo
    when 'aporte'        then cuenta_origen_id is null and cuenta_destino_id is not null and monto_destino is not null
    when 'retiro'        then cuenta_origen_id is not null and cuenta_destino_id is null and monto_origen is not null
    when 'transferencia' then cuenta_origen_id is not null and cuenta_destino_id is not null
                              and cuenta_origen_id <> cuenta_destino_id
                              and monto_origen is not null and monto_destino is not null
  end)
);
create index movimientos_fecha on movimientos_capital (fecha);

-- ═════════════════════════ Pasivos ═════════════════════════

create table pasivos (
  id                     smallint generated always as identity primary key,
  nombre                 text not null unique,
  tipo                   text not null check (tipo in ('leasing','tarjeta','prestamo')),
  moneda                 text not null check (moneda in ('ARS','USD')),
  fecha_inicio           date not null,
  cuotas_totales         smallint not null check (cuotas_totales > 0),
  -- Montos del contrato NETOS de IVA. Con ellos y las cuotas sale la tasa
  -- implícita, que en la fase 2 contrasta el capital pendiente informado.
  monto_financiado_neto  numeric check (monto_financiado_neto > 0 and monto_financiado_neto < 'Infinity'),
  anticipo_neto          numeric check (anticipo_neto >= 0 and anticipo_neto < 'Infinity'),
  opcion_compra_neto     numeric check (opcion_compra_neto >= 0 and opcion_compra_neto < 'Infinity'),
  opcion_compra_fecha    date,
  valor_bien             numeric check (valor_bien > 0 and valor_bien < 'Infinity'),
  -- Alícuota de Ganancias de quien deduce el canon (la empresa). Parámetro del
  -- dueño, no un dato del contrato.
  alicuota_ganancias     numeric check (alicuota_ganancias >= 0 and alicuota_ganancias <= 1),
  notas                  text
);

create table pasivo_cuotas (
  pasivo_id          smallint not null references pasivos(id),
  nro                smallint not null check (nro > 0),
  fecha_vencimiento  date not null,
  canon_neto         numeric not null check (canon_neto >= 0 and canon_neto < 'Infinity'),       -- sin IVA ni seguro
  iva_canon          numeric not null default 0 check (iva_canon >= 0 and iva_canon < 'Infinity'),
  seguro             numeric not null default 0 check (seguro >= 0 and seguro < 'Infinity'),    -- bruto
  otros_conceptos    numeric not null default 0 check (otros_conceptos >= 0 and otros_conceptos < 'Infinity'),
  total_pesos        numeric generated always as (canon_neto + iva_canon + seguro + otros_conceptos) stored,
  base_ganancias     numeric check (base_ganancias >= 0 and base_ganancias < 'Infinity'),
  fecha_pago         date,                                       -- null = impaga
  monto_pagado       numeric check (monto_pagado > 0 and monto_pagado < 'Infinity'),  -- si difiere del total (punitorios)
  cuenta_pago_id     smallint references cuentas(id),            -- null = pagada por fuera (ej. la empresa)
  ccl_del_dia_pago   numeric check (ccl_del_dia_pago > 0 and ccl_del_dia_pago < 'Infinity'),
  carga_id           bigint not null references cargas(id),
  primary key (pasivo_id, nro),
  check (fecha_pago is not null or (monto_pagado is null and cuenta_pago_id is null and ccl_del_dia_pago is null))
);

-- Capital pendiente informado por el acreedor a una fecha. Es lo que netea
-- Exposición desde la fase 1. En la fase 2 se contrasta con el derivado de las cuotas.
create table pasivo_saldos (
  pasivo_id          smallint not null references pasivos(id),
  fecha              date not null,
  capital_pendiente  numeric not null check (capital_pendiente >= 0 and capital_pendiente < 'Infinity'),
  carga_id           bigint not null references cargas(id),
  primary key (pasivo_id, fecha)
);

-- ═════════════════════════ Bienes (D-03, D-04) ═════════════════════════

create table bienes (
  id                smallint generated always as identity primary key,
  nombre            text not null unique,
  tipo              text not null check (tipo in ('inmueble','vehiculo','otro')),
  moneda_valuacion  text not null check (moneda_valuacion in ('ARS','USD')),
  geografia         text not null default 'AR' check (geografia in ('AR','US','BR','GLOBAL')),
  -- Un bien financiado (el auto en leasing): patrimonio = valor − capital
  -- pendiente, y queda "sujeto a opción de compra" hasta ejercerla.
  pasivo_id         smallint unique references pasivos(id),
  activo_bool       boolean not null default true
);

create table bienes_valuaciones (
  bien_id   smallint not null references bienes(id),
  fecha     date not null,
  valor     numeric not null check (valor > 0 and valor < 'Infinity'),   -- en moneda_valuacion del bien
  fuente    text not null,                                               -- tasación, guía de precios, escritura
  carga_id  bigint not null references cargas(id),
  primary key (bien_id, fecha)
);

-- ═════════════════════════ Disciplina (fase 4) ═════════════════════════

create table niveles (
  id                      bigint generated always as identity primary key,
  activo_id               smallint not null references activos(id),
  fecha_definicion        date not null,
  -- Hora de sistema: prueba que el nivel se anotó ANTES de comprar.
  creado_en               timestamptz not null default now(),
  -- En qué unidad está el nivel (un nivel en pesos por CEDEAR deja de ser
  -- comparable después de un cambio de ratio).
  referencia              text not null default 'precio_pesos'
                          check (referencia in ('precio_pesos','precio_usd_subyacente','tem')),
  nivel_entrada_decidido  numeric not null check (nivel_entrada_decidido > 0 and nivel_entrada_decidido < 'Infinity'),
  tramo                   smallint not null default 1 check (tramo > 0),
  nivel_invalidacion      numeric check (nivel_invalidacion > 0 and nivel_invalidacion < 'Infinity'),
  tesis_texto             text not null,
  estado                  text not null default 'pendiente'
                          check (estado in ('pendiente','ejecutado','invalidado','abandonado'))
);

-- Un tramo se puede llenar con varias órdenes, y una orden puede llenar dos
-- tramos. Precio y fecha reales salen de la operación.
create table nivel_operaciones (
  nivel_id      bigint not null references niveles(id),
  operacion_id  bigint not null references operaciones(id),
  cantidad      numeric not null check (cantidad > 0 and cantidad < 'Infinity'),
  primary key (nivel_id, operacion_id)
);

-- ═════════════════════════ Flujo de caja (fase 2) ═════════════════════════

-- Recurrentes: definen el flujo PROYECTADO.
create table ingresos_fijos (
  id             smallint generated always as identity primary key,
  concepto       text not null,
  moneda         text not null check (moneda in ('ARS','USD')),
  monto          numeric not null check (monto > 0 and monto < 'Infinity'),
  vigente_desde  date not null,
  vigente_hasta  date,
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create table gastos_fijos (
  id             smallint generated always as identity primary key,
  concepto       text not null,
  categoria      text not null,
  moneda         text not null default 'ARS' check (moneda in ('ARS','USD')),
  monto          numeric not null check (monto > 0 and monto < 'Infinity'),
  vigente_desde  date not null,
  vigente_hasta  date,
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

-- Lo que REALMENTE pasó en el mes. Sólo insumos: totales y excedente se derivan.
-- gastos_fijos_reales NULL = se asume el proyectado, y se muestra así.
create table flujo_mensual (
  mes                  date primary key check (extract(day from mes) = 1),
  ingreso_usd          numeric check (ingreso_usd >= 0 and ingreso_usd < 'Infinity'),
  cripto_venta_usado   numeric check (cripto_venta_usado > 0 and cripto_venta_usado < 'Infinity'),
  ingreso_pesos        numeric check (ingreso_pesos >= 0 and ingreso_pesos < 'Infinity'),
  gastos_fijos_reales  numeric check (gastos_fijos_reales >= 0 and gastos_fijos_reales < 'Infinity'),
  gastos_variables     numeric check (gastos_variables >= 0 and gastos_variables < 'Infinity'),
  notas                text
);

-- ═════════════════════════ Proyecciones y calendario ═════════════════════════

create table escenarios (
  id              smallint generated always as identity primary key,
  nombre          text not null unique,
  -- Validado con zod en el server; lleva "v" (versión), algoritmo y semilla del PRNG (D-08, D-31).
  supuestos       jsonb not null,
  notas           text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- El monto se calcula (flujos_bono × tenencia). Acá vive sólo la decisión.
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

-- ═════════════════════════ Auditoría (D-17) ═════════════════════════

-- Append-only: el servidor la puede leer, no escribir. La escribe sólo el
-- trigger. Sin FK a cargas para que sobreviva a cualquier borrado.
create table auditoria (
  id         bigint generated always as identity primary key,
  en         timestamptz not null default now(),
  tabla      text not null,
  operacion  text not null check (operacion in ('INSERT','UPDATE','DELETE')),
  antes      jsonb,
  despues    jsonb,
  carga_id   bigint
);
create index auditoria_tabla_en on auditoria (tabla, en desc);
create index auditoria_carga on auditoria (carga_id);

create function registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_antes   jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_antes = v_despues then
    return new;
  end if;
  insert into auditoria (tabla, operacion, antes, despues, carga_id)
  values (tg_table_name, tg_op, v_antes, v_despues,
          (coalesce(v_despues, v_antes) ->> 'carga_id')::bigint);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'cuentas','activos','condiciones_bono','ratios_cedear','flujos_bono','feriados',
    'cargas','tipo_cambio','cotizaciones','indices','operaciones','saldos_liquidez',
    'movimientos_capital','pasivos','pasivo_cuotas','pasivo_saldos','bienes',
    'bienes_valuaciones','niveles','nivel_operaciones','ingresos_fijos','gastos_fijos',
    'flujo_mensual','escenarios','vencimientos','eventos']
  loop
    execute format(
      'create trigger auditar after insert or update or delete on %I
         for each row execute function registrar_auditoria()', t);
  end loop;
end $$;

-- ═════════════════════════ Vistas ═════════════════════════
-- Sólo agregación trivial. Devuelven montos como TEXTO: PostgREST serializa
-- numeric como número JSON y supabase-js lo convertiría a float64 (D-32).

create view v_tenencias with (security_invoker = true) as
select cuenta_id, activo_id,
       sum(case when tipo in ('apertura','compra') then cantidad
                when tipo in ('venta','vencimiento') then -cantidad
                when tipo = 'ajuste_ratio' then cantidad
                else 0 end)::text as cantidad
from operaciones
group by cuenta_id, activo_id;

create view v_ultima_cotizacion with (security_invoker = true) as
select distinct on (activo_id)
       activo_id, fecha, precio_pesos::text as precio_pesos,
       precio_usd_subyacente::text as precio_usd_subyacente, carga_id
from cotizaciones
order by activo_id, fecha desc;

create view v_ultimo_saldo with (security_invoker = true) as
select distinct on (cuenta_id, moneda)
       cuenta_id, moneda, fecha, monto::text as monto, carga_id
from saldos_liquidez
order by cuenta_id, moneda, fecha desc;

-- ═════════════════════════ Storage ═════════════════════════

insert into storage.buckets (id, name, public)
values ('cargas', 'cargas', false)
on conflict (id) do nothing;

-- ═════════════════════════ Seguridad ═════════════════════════

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- Grants explícitos al servidor. Supabase dejó de otorgarlos por defecto en
-- proyectos nuevos (2026): BYPASSRLS saltea RLS pero no los privilegios.
-- Toda migración futura que cree objetos repite sus grants.
grant usage on schema public to service_role;
grant select, insert, update, delete on table
  cuentas, activos, condiciones_bono, ratios_cedear, flujos_bono, feriados,
  cargas, tipo_cambio, cotizaciones, indices, operaciones, saldos_liquidez,
  movimientos_capital, pasivos, pasivo_cuotas, pasivo_saldos, bienes,
  bienes_valuaciones, niveles, nivel_operaciones, ingresos_fijos, gastos_fijos,
  flujo_mensual, escenarios, vencimientos, eventos
  to service_role;
grant select on table auditoria to service_role;
grant select on v_tenencias, v_ultima_cotizacion, v_ultimo_saldo to service_role;
grant usage, select on all sequences in schema public to service_role;
