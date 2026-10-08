-- guardar_manual: valuaciones, capital de pasivos y movimientos de capital.
-- Parte de la carga transaccional (ver 20261008120000_carga_transaccional.sql).

-- ═════════════════════════ guardar_manual ═════════════════════════

-- Entrada: {"lote", "fecha", "bienes_valuaciones": [{bien_id, fecha, valor, fuente}],
--           "pasivo_saldos": [{pasivo_id, fecha, capital_pendiente}],
--           "movimientos_capital": [{fecha, tipo, cuenta_origen_id, ...}]}.
-- La fecha de cada hecho es la suya, o la de la carga si falta.
-- Devuelve el id de la carga (la misma si el lote se repite).
create function guardar_manual(p jsonb) returns bigint
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_lote     uuid;
  v_fecha    date;
  v_bv       jsonb;
  v_ps       jsonb;
  v_mc       jsonb;
  v_x        jsonb;
  v_n        bigint;
  v_carga    bigint;
  v_ctx      text;
  v_estado   text;
  v_mensaje  text;
  v_restr    text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'El alta manual llegó vacía o con otra forma';
  end if;
  if coalesce(p->>'lote', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'El lote no es un identificador válido: %', coalesce(p->>'lote', '(vacío)');
  end if;
  v_lote := (p->>'lote')::uuid;
  v_fecha := leer_fecha(p->'fecha', 'la fecha del alta');
  if v_fecha is null then
    raise exception 'Falta la fecha del alta';
  end if;

  v_bv := coalesce(nullif(p->'bienes_valuaciones', 'null'::jsonb), '[]'::jsonb);
  v_ps := coalesce(nullif(p->'pasivo_saldos', 'null'::jsonb), '[]'::jsonb);
  v_mc := coalesce(nullif(p->'movimientos_capital', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_bv) <> 'array' or jsonb_typeof(v_ps) <> 'array' or jsonb_typeof(v_mc) <> 'array' then
    raise exception 'Valuaciones, saldos de pasivos y movimientos tienen que ser listas';
  end if;
  if jsonb_array_length(v_bv) + jsonb_array_length(v_ps) + jsonb_array_length(v_mc) = 0 then
    raise exception 'No hay nada para grabar';
  end if;

  perform pg_advisory_xact_lock(2026100801);

  if exists (select 1 from cargas where lote = v_lote) then
    select id into v_carga from cargas
     where lote = v_lote and cuenta_id is null and lector = 'manual' and estado <> 'revertida';
    if found and (select count(*) from cargas where lote = v_lote) = 1 then
      return v_carga;
    end if;
    if exists (select 1 from cargas where lote = v_lote and lector = 'manual' and estado = 'revertida') then
      raise exception 'Ese dato se grabó y después se revirtió. Para volver a grabarlo, guardalo de nuevo.';
    end if;
    raise exception 'El lote % ya se usó para otra carga', v_lote;
  end if;

  insert into cargas (fecha, cuenta_id, origen, lote, lector, grabado)
  values (v_fecha, null, 'manual', v_lote, 'manual',
          jsonb_strip_nulls(jsonb_build_object(
            'bienes_valuaciones', nullif(v_bv, '[]'::jsonb),
            'pasivo_saldos', nullif(v_ps, '[]'::jsonb),
            'movimientos_capital', nullif(v_mc, '[]'::jsonb))))
  returning id into v_carga;

  -- Valuaciones de bienes (D-04): una por bien y día; la última manda.
  for v_x, v_n in select e.x, e.n from jsonb_array_elements(v_bv) with ordinality as e(x, n) order by e.n loop
    v_ctx := format('valuación de %s',
                    coalesce((select nombre from bienes where id = leer_id(v_x->'bien_id', 'el bien')),
                             'el bien #' || coalesce(v_x->>'bien_id', '?')));
    begin
      insert into bienes_valuaciones (bien_id, fecha, valor, fuente, carga_id)
      values (leer_id(v_x->'bien_id', v_ctx),
              coalesce(leer_fecha(v_x->'fecha', v_ctx || ', fecha'), v_fecha),
              leer_monto(v_x->'valor', v_ctx || ', valor'),
              nullif(btrim(v_x->>'fuente'), ''),
              v_carga)
      on conflict (bien_id, fecha) do update
        set valor = excluded.valor, fuente = excluded.fuente, carga_id = excluded.carga_id;
    exception when others then
      get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                              v_restr = constraint_name;
      if v_estado = 'P0001' then raise; end if;
      raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
    end;
  end loop;

  -- Capital pendiente informado por el acreedor: uno por pasivo y día.
  for v_x, v_n in select e.x, e.n from jsonb_array_elements(v_ps) with ordinality as e(x, n) order by e.n loop
    v_ctx := format('capital pendiente de %s',
                    coalesce((select nombre from pasivos where id = leer_id(v_x->'pasivo_id', 'el pasivo')),
                             'el pasivo #' || coalesce(v_x->>'pasivo_id', '?')));
    begin
      insert into pasivo_saldos (pasivo_id, fecha, capital_pendiente, carga_id)
      values (leer_id(v_x->'pasivo_id', v_ctx),
              coalesce(leer_fecha(v_x->'fecha', v_ctx || ', fecha'), v_fecha),
              leer_monto(v_x->'capital_pendiente', v_ctx),
              v_carga)
      on conflict (pasivo_id, fecha) do update
        set capital_pendiente = excluded.capital_pendiente, carga_id = excluded.carga_id;
    exception when others then
      get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                              v_restr = constraint_name;
      if v_estado = 'P0001' then raise; end if;
      raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
    end;
  end loop;

  -- Movimientos de capital (D-06): hechos nuevos.
  for v_x, v_n in select e.x, e.n from jsonb_array_elements(v_mc) with ordinality as e(x, n) order by e.n loop
    v_ctx := format('movimiento %s (%s)', v_n, coalesce(v_x->>'tipo', 'sin tipo'));
    begin
      insert into movimientos_capital (fecha, fecha_acreditacion, tipo, cuenta_origen_id, cuenta_destino_id,
                                       moneda_origen, monto_origen, moneda_destino, monto_destino,
                                       tc_aplicado, impuesto, carga_id, notas)
      values (coalesce(leer_fecha(v_x->'fecha', v_ctx || ', fecha'), v_fecha),
              leer_fecha(v_x->'fecha_acreditacion', v_ctx || ', fecha de acreditación'),
              v_x->>'tipo',
              leer_id(v_x->'cuenta_origen_id', v_ctx || ', cuenta de origen'),
              leer_id(v_x->'cuenta_destino_id', v_ctx || ', cuenta de destino'),
              nullif(btrim(v_x->>'moneda_origen'), ''),
              leer_monto(v_x->'monto_origen', v_ctx || ', monto de origen'),
              nullif(btrim(v_x->>'moneda_destino'), ''),
              leer_monto(v_x->'monto_destino', v_ctx || ', monto de destino'),
              leer_monto(v_x->'tc_aplicado', v_ctx || ', tipo de cambio aplicado'),
              coalesce(leer_monto(v_x->'impuesto', v_ctx || ', impuesto'), 0),
              v_carga,
              nullif(btrim(v_x->>'notas'), ''));
    exception when others then
      get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                              v_restr = constraint_name;
      if v_estado = 'P0001' then raise; end if;
      raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
    end;
  end loop;

  return v_carga;
end $$;

comment on function guardar_manual(jsonb) is 'Graba valuaciones de bienes, capital pendiente de pasivos y movimientos de capital con una carga manual. Idempotente por lote';

-- Permisos (D-20, D-33): una función nueva es ejecutable por PUBLIC por defecto
-- (el default global no se revoca por esquema): se revoca explícitamente.
revoke all on function
  guardar_manual(jsonb)
  from public, anon, authenticated;

grant execute on function
  guardar_manual(jsonb)
  to service_role;
