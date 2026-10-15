-- Ingresos y gastos fijos de Flujo y escenarios (entrega 4, plan §6 D.4; D-147).
--
-- Las dos tablas ya tienen filas desde el 14/10 (el ingreso en dólares, el fijo
-- en pesos y el total de gastos que declaró el dueño): esta migración no lleva
-- guarda de tabla vacía. Toda columna nueva es opcional o tiene un valor que ya
-- vale para las filas que hay ('mensual'). Un error no se borra: se anula
-- (anulado_en) y queda en la auditoría (D-116). Las dos tablas ya tienen RLS,
-- permisos y su trigger de auditoría desde el init.

alter table ingresos_fijos
  add column naturaleza text
    check (naturaleza is null or naturaleza in ('sueldo','honorarios','dividendo','retiro_a_cuenta','otro')),
  add column cuenta_destino_id smallint references cuentas(id),
  add column anulado_en timestamptz,
  add column notas text
    check (notas is null or char_length(btrim(notas)) between 1 and 500);

alter table gastos_fijos
  add column frecuencia text not null default 'mensual'
    check (frecuencia in ('mensual','bimestral','trimestral','semestral','anual')),
  add column primer_mes date
    check (primer_mes is null or extract(day from primer_mes) = 1),
  add column pagador text
    check (pagador is null or pagador in ('titular','empresa')),
  add column anulado_en timestamptz,
  add column notas text
    check (notas is null or char_length(btrim(notas)) between 1 and 500),
  add constraint gastos_fijos_frecuencia_con_mes
    check (frecuencia = 'mensual' or primer_mes is not null),
  alter column categoria drop not null;

comment on table ingresos_fijos is
  'Ingresos que declaraste, con su vigencia: el flujo proyectado de cada mes sale de acá. Un cambio de monto cierra la fila vigente y abre otra; un error se anula, no se borra';
comment on column ingresos_fijos.naturaleza is
  'Qué es el ingreso: sueldo, honorarios, dividendo, retiro a cuenta u otro (D-82). null = sin declarar';
comment on column ingresos_fijos.cuenta_destino_id is
  'A qué cuenta seguida suele entrar; null = afuera o sin declarar';
comment on column ingresos_fijos.anulado_en is
  'Cuándo lo anulaste por error. Una fila anulada no cuenta en ningún mes';
comment on column ingresos_fijos.notas is
  'Nota libre del dueño';

comment on table gastos_fijos is
  'Gastos fijos que declaraste, con su vigencia y su frecuencia. Son declarados, no gastos reales: el gasto real de un mes es el que cargás';
comment on column gastos_fijos.frecuencia is
  'Cada cuánto se paga: mensual, bimestral, trimestral, semestral o anual';
comment on column gastos_fijos.primer_mes is
  'Primer mes en que se paga (día 1), obligatorio si no es mensual: de ahí salen los meses que le tocan';
comment on column gastos_fijos.pagador is
  'Quién lo paga: titular (vos) o empresa. null = vos';
comment on column gastos_fijos.anulado_en is
  'Cuándo lo anulaste por error. Una fila anulada no cuenta en ningún mes';
comment on column gastos_fijos.notas is
  'Nota libre del dueño';
comment on column gastos_fijos.categoria is
  'Categoría opcional (vivienda, servicios…); el total del mes no la necesita';

-- ═════════════════════════ guardar_recurrente ═════════════════════════
-- Una sola transacción por acción, con el mismo candado que las cargas:
--   alta           → una fila nueva;
--   cambiar_desde  → cierra la fila vigente el día anterior a "desde" y abre otra con el monto nuevo;
--   cerrar         → le pone fecha de fin ("hasta");
--   anular         → la marca anulada (un error; queda en la auditoría).
-- Entrada: {"accion", "sentido": "ingreso"|"gasto", "id"?, "concepto", "moneda", "monto",
--           "desde", "hasta"?, "naturaleza"?, "cuenta_destino_id"?, "frecuencia"?,
--           "primer_mes"?, "pagador"?, "categoria"?, "notas"?}.
-- Devuelve {"id": la fila nueva o la tocada, "cerrada": la que cerró cambiar_desde}.
create function guardar_recurrente(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_accion    text;
  v_sentido   text;
  v_tabla     text;
  v_id        bigint;
  v_nuevo     bigint;
  v_desde     date;
  v_hasta     date;
  v_monto     numeric;
  v_moneda    text;
  v_concepto  text;
  v_fila      record;
  v_x         jsonb := '{}'::jsonb;
  v_hay       boolean;
  v_estado    text;
  v_mensaje   text;
  v_restr     text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'El ingreso o gasto llegó vacío o con otra forma';
  end if;
  v_accion := coalesce(nullif(btrim(p->>'accion'), ''), 'alta');
  if v_accion not in ('alta','cambiar_desde','cerrar','anular') then
    raise exception 'Acción inválida: % (alta, cambiar_desde, cerrar o anular)', v_accion;
  end if;
  v_sentido := nullif(btrim(p->>'sentido'), '');
  if v_sentido is null or v_sentido not in ('ingreso','gasto') then
    raise exception 'Falta decir si es un ingreso o un gasto';
  end if;
  v_tabla := case v_sentido when 'ingreso' then 'ingresos_fijos' else 'gastos_fijos' end;

  perform pg_advisory_xact_lock(2026100801);

  if v_accion <> 'alta' then
    v_id := leer_id(p->'id', 'la fila');
    if v_id is null then
      raise exception 'Falta qué % cambiar', v_sentido;
    end if;
    execute format('select id, concepto, moneda, monto, vigente_desde, vigente_hasta, anulado_en from %I where id = $1 for update', v_tabla)
      into v_fila using v_id;
    if v_fila.id is null then
      raise exception 'No existe ese % (#%)', v_sentido, v_id;
    end if;
    if v_fila.anulado_en is not null then
      raise exception 'Ese % ya está anulado', v_sentido;
    end if;
  end if;

  if v_accion = 'anular' then
    execute format('update %I set anulado_en = now() where id = $1', v_tabla) using v_id;
    return jsonb_build_object('id', v_id);
  end if;

  if v_accion = 'cerrar' then
    v_hasta := leer_fecha(p->'hasta', 'la fecha de fin');
    if v_hasta is null then
      raise exception 'Falta hasta cuándo vale';
    end if;
    if v_hasta < v_fila.vigente_desde then
      raise exception 'La fecha de fin (%) es anterior a la vigencia (desde el %)',
        to_char(v_hasta, 'DD/MM/YYYY'), to_char(v_fila.vigente_desde, 'DD/MM/YYYY');
    end if;
    execute format('update %I set vigente_hasta = $2 where id = $1', v_tabla) using v_id, v_hasta;
    return jsonb_build_object('id', v_id);
  end if;

  v_desde := leer_fecha(p->'desde', 'la fecha desde');
  if v_desde is null then
    raise exception 'Falta desde cuándo vale';
  end if;
  v_hasta := leer_fecha(p->'hasta', 'la fecha de fin');
  v_monto := leer_monto(p->'monto', 'el monto');
  if v_monto is null then
    raise exception 'Falta el monto';
  end if;

  if v_accion = 'cambiar_desde' then
    if v_desde <= v_fila.vigente_desde then
      raise exception 'El cambio tiene que ser después del %: antes de esa fecha la fila no valía. Si el monto estaba mal desde el principio, anulala y cargala de nuevo',
        to_char(v_fila.vigente_desde, 'DD/MM/YYYY');
    end if;
    if v_fila.vigente_hasta is not null and v_desde > v_fila.vigente_hasta then
      raise exception 'Esa fila ya terminó el %: cargá un ingreso o gasto nuevo', to_char(v_fila.vigente_hasta, 'DD/MM/YYYY');
    end if;
    -- La fila nueva hereda lo que no cambia (concepto, moneda, frecuencia, quién paga, fin de vigencia).
    execute format('select to_jsonb(t) from %I t where id = $1', v_tabla) into v_x using v_id;
    if v_hasta is null and v_fila.vigente_hasta is not null then
      v_hasta := v_fila.vigente_hasta;
    end if;
    execute format('update %I set vigente_hasta = $2 where id = $1', v_tabla) using v_id, v_desde - 1;
  end if;
  v_x := v_x || jsonb_strip_nulls(p);
  v_concepto := nullif(btrim(v_x->>'concepto'), '');
  v_moneda := nullif(btrim(v_x->>'moneda'), '');
  if v_concepto is null then
    raise exception 'Falta el concepto';
  end if;
  if v_accion = 'alta' then
    -- Un doble envío no duplica: la misma fila vigente ya cargada se rechaza.
    execute format('select exists (select 1 from %I where anulado_en is null and concepto = $1 and moneda = $2 and monto = $3 and vigente_desde = $4)', v_tabla)
      into v_hay using v_concepto, v_moneda, v_monto, v_desde;
    if v_hay then
      raise exception 'Ya tenés cargado "%" por ese monto desde esa fecha', v_concepto;
    end if;
  end if;

  begin
    if v_sentido = 'ingreso' then
      insert into ingresos_fijos (concepto, moneda, monto, vigente_desde, vigente_hasta, naturaleza, cuenta_destino_id, notas)
      values (v_concepto, v_moneda, v_monto, v_desde, v_hasta,
              nullif(btrim(v_x->>'naturaleza'), ''),
              leer_id(v_x->'cuenta_destino_id', 'la cuenta de destino'),
              nullif(btrim(v_x->>'notas'), ''))
      returning id into v_nuevo;
    else
      insert into gastos_fijos (concepto, categoria, moneda, monto, vigente_desde, vigente_hasta, frecuencia, primer_mes, pagador, notas)
      values (v_concepto, nullif(btrim(v_x->>'categoria'), ''), v_moneda, v_monto, v_desde, v_hasta,
              coalesce(nullif(btrim(v_x->>'frecuencia'), ''), 'mensual'),
              leer_fecha(v_x->'primer_mes', 'el primer mes'),
              nullif(btrim(v_x->>'pagador'), ''),
              nullif(btrim(v_x->>'notas'), ''))
      returning id into v_nuevo;
    end if;
  exception when others then
    get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text, v_restr = constraint_name;
    if v_estado = 'P0001' then raise; end if;
    raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_concepto;
  end;

  return jsonb_strip_nulls(jsonb_build_object('id', v_nuevo, 'cerrada', case when v_accion = 'cambiar_desde' then v_id end));
end $$;

comment on function guardar_recurrente(jsonb) is
  'Alta, cambio desde una fecha (cierra la fila vigente y abre otra), cierre o anulación de un ingreso o gasto fijo, en una transacción';

revoke all on function guardar_recurrente(jsonb) from public, anon, authenticated;
grant execute on function guardar_recurrente(jsonb) to service_role;
