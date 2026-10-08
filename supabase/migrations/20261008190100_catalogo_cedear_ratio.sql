-- alta_activo y editar_activo, segunda versión (revisión de la fase 1a).
-- Reemplaza las de 20261008151942_catalogo_activos.sql (que no se edita) con un
-- solo cambio: D-104 ("nunca queda un CEDEAR sin ratio") lo controla la base,
-- también al editar un activo y cambiarle el tipo a CEDEAR. El resto es igual.

create or replace function alta_activo(p jsonb) returns integer
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_id     integer;
  v_ratio  numeric;
  v_desde  date;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'El activo llegó vacío o con otra forma';
  end if;
  v_ratio := leer_monto(p->'ratio', 'el ratio');
  if v_ratio is not null and p->>'tipo' is distinct from 'cedear' then
    raise exception 'El ratio solo va en un CEDEAR';
  end if;
  if v_ratio is null and p->>'tipo' = 'cedear' then
    raise exception 'Un CEDEAR necesita su ratio (CEDEARs por acción)';
  end if;
  v_desde := coalesce(leer_fecha(p->'ratio_vigente_desde', 'la vigencia del ratio'),
                      (now() at time zone 'America/Argentina/Cordoba')::date);

  insert into activos (ticker, nombre, tipo, moneda_riesgo, geografia, indexacion,
                       ticker_subyacente, fecha_vencimiento, color)
  values (nullif(btrim(p->>'ticker'), ''),
          nullif(btrim(p->>'nombre'), ''),
          p->>'tipo', p->>'moneda_riesgo', p->>'geografia',
          nullif(btrim(p->>'indexacion'), ''),
          nullif(btrim(p->>'ticker_subyacente'), ''),
          leer_fecha(p->'fecha_vencimiento', 'la fecha de vencimiento'),
          nullif(btrim(p->>'color'), ''))
  returning id into v_id;

  if v_ratio is not null then
    insert into ratios_cedear (activo_id, vigente_desde, ratio) values (v_id, v_desde, v_ratio);
  end if;
  return v_id;
end $$;

create or replace function editar_activo(p_id integer, p jsonb) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_tipo text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Los cambios del activo llegaron vacíos o con otra forma';
  end if;

  update activos set
    nombre            = case when p ? 'nombre' then nullif(btrim(p->>'nombre'), '') else nombre end,
    tipo              = case when p ? 'tipo' then p->>'tipo' else tipo end,
    moneda_riesgo     = case when p ? 'moneda_riesgo' then p->>'moneda_riesgo' else moneda_riesgo end,
    geografia         = case when p ? 'geografia' then p->>'geografia' else geografia end,
    indexacion        = case when p ? 'indexacion' then nullif(btrim(p->>'indexacion'), '') else indexacion end,
    ticker_subyacente = case when p ? 'ticker_subyacente' then nullif(btrim(p->>'ticker_subyacente'), '') else ticker_subyacente end,
    fecha_vencimiento = case when p ? 'fecha_vencimiento' then leer_fecha(p->'fecha_vencimiento', 'la fecha de vencimiento') else fecha_vencimiento end,
    color             = case when p ? 'color' then nullif(btrim(p->>'color'), '') else color end,
    activo_bool       = case when p ? 'activo_bool' then (p->>'activo_bool')::boolean else activo_bool end
  where id = p_id
  returning tipo into v_tipo;
  if not found then
    raise exception 'No existe el activo %', p_id;
  end if;

  if jsonb_typeof(p->'ratio') = 'object' then
    if v_tipo <> 'cedear' then
      raise exception 'El ratio solo va en un CEDEAR';
    end if;
    insert into ratios_cedear (activo_id, vigente_desde, ratio)
    values (p_id,
            leer_fecha(p->'ratio'->'vigente_desde', 'la vigencia del ratio'),
            leer_monto(p->'ratio'->'ratio', 'el ratio'))
    on conflict (activo_id, vigente_desde) do update set ratio = excluded.ratio;
  elsif coalesce(jsonb_typeof(p->'ratio'), 'null') <> 'null' then
    raise exception 'El ratio llegó con otra forma';
  end if;

  -- D-104: un CEDEAR sin ningún ratio no se guarda (la transacción vuelve atrás).
  if v_tipo = 'cedear' and not exists (select 1 from ratios_cedear where activo_id = p_id) then
    raise exception 'Un CEDEAR necesita su ratio (CEDEARs por acción): cargalo con su fecha';
  end if;
end $$;

comment on function alta_activo(jsonb) is 'Da de alta un activo y, si es CEDEAR, su ratio (obligatorio, D-104), en una transacción';
comment on function editar_activo(integer, jsonb) is 'Cambia los campos presentes de un activo y, opcionalmente, agrega o corrige un ratio; un CEDEAR nunca queda sin ratio (D-104)';

-- Permisos (D-20, D-33): create or replace conserva los de la función, pero se
-- repiten por si esta migración se aplica sobre una base sin la anterior.
revoke all on function
  alta_activo(jsonb),
  editar_activo(integer, jsonb)
  from public, anon, authenticated;

grant execute on function
  alta_activo(jsonb),
  editar_activo(integer, jsonb)
  to service_role;
