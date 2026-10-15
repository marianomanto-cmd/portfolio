-- Cargar ingreso y Cargar gasto (entrega 4, plan §6 D.9; D-149).
--
-- Lo que entró o salió de verdad, por evento: un ingreso mensual o
-- extraordinario, un gasto fijo del mes o uno extraordinario. Es un hecho con
-- su carga manual, como un movimiento de Datos. Si la plata entró a una cuenta
-- seguida, la misma transacción graba el aporte en movimientos_capital (y si
-- salió de una, el retiro): así la carga siguiente no lee ese ingreso como
-- ganancia de tus inversiones (D-06).
--
-- carga_id no lleva clave foránea a cargas, a propósito: revertir_lote se
-- niega a revertir un lote que tiene filas en una tabla con clave foránea a
-- cargas que no está en su lista, y sumarla a la lista pide reescribir esa
-- función con un borrado (D-116). Sin la clave foránea, "Deshacer" es revertir
-- el lote como siempre: se va el aporte, la carga queda revertida y esta fila
-- deja de leerse (el lector ignora las de una carga revertida). La integridad
-- la cuida el trigger carga_valida: la carga tiene que existir y ser manual.

create table flujos_reales (
  id               bigint generated always as identity primary key,
  fecha            date not null,
  sentido          text not null check (sentido in ('ingreso','gasto')),
  concepto         text not null check (concepto in ('mensual','extraordinario')),
  moneda           text not null check (moneda in ('ARS','USD')),
  monto            numeric not null check (monto > 0 and monto < 'Infinity'),
  cuenta_id        smallint references cuentas(id),
  cripto_usado     numeric check (cripto_usado > 0 and cripto_usado < 'Infinity'),
  pesos_recibidos  numeric check (pesos_recibidos > 0 and pesos_recibidos < 'Infinity'),
  anulado_en       timestamptz,
  carga_id         bigint not null,
  notas            text check (notas is null or char_length(btrim(notas)) between 1 and 500),
  constraint flujos_reales_cripto_con_pesos check ((cripto_usado is null) = (pesos_recibidos is null)),
  constraint flujos_reales_cripto_de_dolares check (cripto_usado is null or (sentido = 'ingreso' and moneda = 'USD')),
  constraint flujos_reales_anula_afuera check (anulado_en is null or cuenta_id is null),
  constraint flujos_reales_una_por_carga unique (carga_id)
);
create index flujos_reales_fecha on flujos_reales (fecha);

alter table flujos_reales enable row level security;
revoke all on table flujos_reales from public, anon, authenticated;
grant select, insert, update on table flujos_reales to service_role;
create trigger auditar after insert or update on flujos_reales
  for each row execute function registrar_auditoria();

comment on table flujos_reales is
  'Lo que entró o salió de verdad (Cargar ingreso / Cargar gasto): un hecho por evento, con su carga manual. Con esto un mes proyectado se vuelve real';
comment on column flujos_reales.id is 'Identificador';
comment on column flujos_reales.fecha is 'El día en que entró o salió la plata';
comment on column flujos_reales.sentido is 'ingreso o gasto';
comment on column flujos_reales.concepto is
  'mensual (el ingreso del mes o un gasto fijo del mes: se compara con lo declarado) o extraordinario (va aparte y no cambia la proyección)';
comment on column flujos_reales.moneda is 'Moneda en que entró o salió (ARS o USD)';
comment on column flujos_reales.monto is 'Cuánto, en su moneda';
comment on column flujos_reales.cuenta_id is
  'A qué cuenta seguida entró (o de cuál salió); null = afuera. Con cuenta, la misma carga tiene el aporte o el retiro en movimientos_capital';
comment on column flujos_reales.cripto_usado is
  'Si eran dólares vendidos al dólar cripto: el cripto al que los vendiste (va con pesos_recibidos)';
comment on column flujos_reales.pesos_recibidos is
  'Si eran dólares vendidos al cripto: los pesos que recibiste. Tienen que cerrar con monto × cripto dentro de la precisión mostrada (D-37)';
comment on column flujos_reales.anulado_en is
  'Cuándo lo anulaste por error (solo lo que entró o salió afuera: lo que tocó una cuenta se deshace revirtiendo su carga)';
comment on column flujos_reales.carga_id is
  'La carga manual que lo grabó (sin clave foránea, ver el encabezado de la migración). Si esa carga está revertida, la fila no cuenta';
comment on column flujos_reales.notas is 'Nota libre del dueño';

-- La carga de una fila tiene que existir y ser una carga manual sin cuenta.
create function flujos_reales_carga_valida() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from cargas where id = new.carga_id and origen = 'manual' and cuenta_id is null) then
    raise exception 'La carga #% no existe o no es una carga manual: un ingreso o un gasto se graba con guardar_flujo_real', new.carga_id;
  end if;
  return new;
end $$;
comment on function flujos_reales_carga_valida() is
  'Trigger: la carga de un ingreso o gasto cargado existe y es manual (flujos_reales no tiene clave foránea a cargas)';
revoke all on function flujos_reales_carga_valida() from public, anon, authenticated;
grant execute on function flujos_reales_carga_valida() to service_role;
create trigger carga_valida before insert or update of carga_id on flujos_reales
  for each row execute function flujos_reales_carga_valida();

-- ═════════════════════════ guardar_flujo_real ═════════════════════════
-- En UNA transacción: la carga manual (lote idempotente, mismo candado que las
-- demás cargas), la fila de flujos_reales y, si la plata entró a una cuenta
-- seguida, el aporte (o, si salió de una, el retiro) en movimientos_capital.
-- Entrada: {"lote", "fecha", "sentido", "concepto", "moneda", "monto", "cuenta_id" (null = afuera),
--           "cripto_usado", "pesos_recibidos", "notas"}.
-- Devuelve {"carga_id", "flujo_id", "movimiento": "aporte"|"retiro"|null, "repetido"}.
create function guardar_flujo_real(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_lote      uuid;
  v_fecha     date;
  v_sentido   text;
  v_concepto  text;
  v_moneda    text;
  v_monto     numeric;
  v_cuenta    bigint;
  v_cripto    numeric;
  v_pesos     numeric;
  v_notas     text;
  v_carga     bigint;
  v_flujo     bigint;
  v_esperado  numeric;
  v_tol       numeric;
  v_mov       text;
  v_que       text;
  v_estado    text;
  v_mensaje   text;
  v_restr     text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'El ingreso o gasto llegó vacío o con otra forma';
  end if;
  if coalesce(p->>'lote', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'El lote no es un identificador válido: %', coalesce(p->>'lote', '(vacío)');
  end if;
  v_lote := (p->>'lote')::uuid;
  v_fecha := leer_fecha(p->'fecha', 'la fecha');
  if v_fecha is null then
    raise exception 'Falta la fecha';
  end if;
  v_sentido := nullif(btrim(p->>'sentido'), '');
  if v_sentido is null or v_sentido not in ('ingreso','gasto') then
    raise exception 'Falta decir si es un ingreso o un gasto';
  end if;
  v_concepto := nullif(btrim(p->>'concepto'), '');
  if v_concepto is null or v_concepto not in ('mensual','extraordinario') then
    raise exception 'Falta el concepto: % mensual o extraordinario', case v_sentido when 'ingreso' then 'ingreso' else 'gasto' end;
  end if;
  v_moneda := nullif(btrim(p->>'moneda'), '');
  if v_moneda is null or v_moneda not in ('ARS','USD') then
    raise exception 'Falta la moneda (US$ o $)';
  end if;
  v_monto := leer_monto(p->'monto', 'el monto');
  if v_monto is null or v_monto <= 0 then
    raise exception 'El monto tiene que ser mayor que cero';
  end if;
  v_cuenta := leer_id(p->'cuenta_id', 'la cuenta');
  v_cripto := leer_monto(p->'cripto_usado', 'el dólar cripto');
  v_pesos := leer_monto(p->'pesos_recibidos', 'los pesos recibidos');
  v_notas := nullif(btrim(p->>'notas'), '');
  if (v_cripto is null) <> (v_pesos is null) then
    raise exception 'El cripto y los pesos que recibiste van juntos: completá los dos o ninguno';
  end if;
  if v_cripto is not null then
    if v_sentido <> 'ingreso' or v_moneda <> 'USD' then
      raise exception 'El cripto va solo con dólares que vendiste (un ingreso en US$)';
    end if;
    -- Control (D-37): pesos ≈ US$ × cripto, con la tolerancia de los decimales que tipeaste.
    v_esperado := v_monto * v_cripto;
    v_tol := v_monto * power(10::numeric, -scale(v_cripto)) / 2 + power(10::numeric, -scale(v_pesos)) / 2;
    if abs(v_pesos - v_esperado) > v_tol then
      raise exception 'Los pesos no cierran: US$ % × cripto % = $ %, y cargaste $ % (diferencia $ %). Revisá el cripto o los pesos',
        v_monto, v_cripto, round(v_esperado, 2), v_pesos, round(v_pesos - v_esperado, 2);
    end if;
  end if;
  if v_cuenta is not null and not exists (select 1 from cuentas where id = v_cuenta) then
    raise exception 'La cuenta #% no existe', v_cuenta;
  end if;

  perform pg_advisory_xact_lock(2026100801);

  if exists (select 1 from cargas where lote = v_lote) then
    select c.id, f.id into v_carga, v_flujo
      from cargas c join flujos_reales f on f.carga_id = c.id
     where c.lote = v_lote and c.lector = 'flujo_real' and c.estado <> 'revertida';
    if v_carga is not null and (select count(*) from cargas where lote = v_lote) = 1 then
      select tipo into v_mov from movimientos_capital where carga_id = v_carga limit 1;
      return jsonb_build_object('carga_id', v_carga, 'flujo_id', v_flujo, 'movimiento', v_mov, 'repetido', true);
    end if;
    if exists (select 1 from cargas where lote = v_lote and lector = 'flujo_real' and estado = 'revertida') then
      raise exception 'Eso se grabó y después se deshizo. Para volver a cargarlo, guardalo de nuevo.';
    end if;
    raise exception 'El lote % ya se usó para otra carga', v_lote;
  end if;

  v_que := format('%s %s', case v_sentido when 'ingreso' then 'ingreso' else 'gasto' end, v_concepto);
  v_mov := case when v_cuenta is null then null when v_sentido = 'ingreso' then 'aporte' else 'retiro' end;

  insert into cargas (fecha, cuenta_id, origen, lote, lector, grabado)
  values (v_fecha, null, 'manual', v_lote, 'flujo_real',
          jsonb_strip_nulls(jsonb_build_object(
            'flujos_reales', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
              'fecha', v_fecha, 'sentido', v_sentido, 'concepto', v_concepto, 'moneda', v_moneda,
              'monto', v_monto::text, 'cuenta_id', v_cuenta, 'cripto_usado', v_cripto::text,
              'pesos_recibidos', v_pesos::text, 'notas', v_notas))),
            'movimiento', v_mov)))
  returning id into v_carga;

  begin
    insert into flujos_reales (fecha, sentido, concepto, moneda, monto, cuenta_id, cripto_usado, pesos_recibidos, carga_id, notas)
    values (v_fecha, v_sentido, v_concepto, v_moneda, v_monto, v_cuenta, v_cripto, v_pesos, v_carga, v_notas)
    returning id into v_flujo;

    if v_mov = 'aporte' then
      -- Plata de afuera que entra a una cuenta: si eran dólares vendidos al cripto, entran pesos.
      insert into movimientos_capital (fecha, tipo, cuenta_destino_id, moneda_origen, monto_origen,
                                       moneda_destino, monto_destino, tc_aplicado, carga_id, notas)
      values (v_fecha, 'aporte', v_cuenta,
              case when v_cripto is not null then 'USD' end,
              case when v_cripto is not null then v_monto end,
              case when v_cripto is not null then 'ARS' else v_moneda end,
              coalesce(v_pesos, v_monto),
              v_cripto, v_carga,
              format('%s (Cargar ingreso)', initcap(v_que)));
    elsif v_mov = 'retiro' then
      insert into movimientos_capital (fecha, tipo, cuenta_origen_id, moneda_origen, monto_origen, carga_id, notas)
      values (v_fecha, 'retiro', v_cuenta, v_moneda, v_monto, v_carga, format('%s (Cargar gasto)', initcap(v_que)));
    end if;
  exception when others then
    get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text, v_restr = constraint_name;
    if v_estado = 'P0001' then raise; end if;
    raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_que;
  end;

  return jsonb_build_object('carga_id', v_carga, 'flujo_id', v_flujo, 'movimiento', v_mov, 'repetido', false);
end $$;

comment on function guardar_flujo_real(jsonb) is
  'Graba un ingreso o un gasto real con su carga manual y, si tocó una cuenta seguida, su aporte o retiro, en una transacción. Idempotente por lote';

revoke all on function guardar_flujo_real(jsonb) from public, anon, authenticated;
grant execute on function guardar_flujo_real(jsonb) to service_role;
