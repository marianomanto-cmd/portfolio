-- El pago al vencimiento de tus bonos y letras, con su fuente (entrega 4, plan §6 D.4; D-146).
--
-- flujos_bono guarda los flujos contractuales por 1 VN original (init). Lo que
-- cobrás en cada fecha = flujo × VN en tenencia: se calcula, no se guarda. La
-- tabla llega vacía a esta entrega y su trigger de auditoría ya existe. Un
-- flujo mal cargado se corrige grabándolo de nuevo (la auditoría guarda el
-- antes y el después).

alter table flujos_bono
  add column fuente text
    check (fuente is null or char_length(btrim(fuente)) between 1 and 200);

comment on column flujos_bono.fuente is
  'De dónde sale el flujo: el aviso de licitación, el prospecto o la página del emisor. Obligatoria al grabar desde la app';

-- ═════════════════════════ guardar_flujos_bono ═════════════════════════
-- Graba (o corrige) el cronograma de un bono o una letra, por 1 VN, en una
-- transacción. Upsert por (activo_id, fecha). Rechaza un activo que no sea bono
-- ni letra y una fecha posterior a su vencimiento.
-- Entrada: {"activo_id", "fuente", "flujos": [{"fecha", "interes" (null = a determinar), "amortizacion"}]}.
-- Devuelve cuántos flujos grabó.
create function guardar_flujos_bono(p jsonb) returns integer
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_activo   record;
  v_id       bigint;
  v_fuente   text;
  v_flujos   jsonb;
  v_x        jsonb;
  v_n        integer := 0;
  v_fecha    date;
  v_ctx      text;
  v_estado   text;
  v_mensaje  text;
  v_restr    text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'El cronograma llegó vacío o con otra forma';
  end if;
  v_id := leer_id(p->'activo_id', 'el activo');
  if v_id is null then
    raise exception 'Falta el bono o la letra';
  end if;
  select id, ticker, tipo, fecha_vencimiento into v_activo from activos where id = v_id;
  if v_activo.id is null then
    raise exception 'El activo #% no está en el catálogo', v_id;
  end if;
  if v_activo.tipo not in ('bono','lecap') then
    raise exception '% no es un bono ni una letra: no tiene pago al vencimiento', v_activo.ticker;
  end if;
  v_fuente := nullif(btrim(p->>'fuente'), '');
  if v_fuente is null then
    raise exception 'Falta la fuente del pago de %: de dónde lo sacaste (el aviso de licitación, por ejemplo)', v_activo.ticker;
  end if;
  v_flujos := coalesce(nullif(p->'flujos', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_flujos) <> 'array' or jsonb_array_length(v_flujos) = 0 then
    raise exception 'Falta al menos un pago de %', v_activo.ticker;
  end if;

  perform pg_advisory_xact_lock(2026100801);

  for v_x in select e from jsonb_array_elements(v_flujos) as e loop
    v_fecha := leer_fecha(v_x->'fecha', 'la fecha del pago');
    v_ctx := format('pago de %s del %s', v_activo.ticker, coalesce(to_char(v_fecha, 'DD/MM/YYYY'), '?'));
    if v_fecha is null then
      raise exception 'Falta la fecha de un pago de %', v_activo.ticker;
    end if;
    if v_activo.fecha_vencimiento is not null and v_fecha > v_activo.fecha_vencimiento then
      raise exception 'El % es posterior al vencimiento de % (%)', v_ctx, v_activo.ticker, to_char(v_activo.fecha_vencimiento, 'DD/MM/YYYY');
    end if;
    begin
      insert into flujos_bono (activo_id, fecha, interes, amortizacion, fuente)
      values (v_id, v_fecha,
              leer_monto(v_x->'interes', v_ctx || ', interés'),
              coalesce(leer_monto(v_x->'amortizacion', v_ctx || ', amortización'), 0),
              v_fuente)
      on conflict (activo_id, fecha) do update
        set interes = excluded.interes, amortizacion = excluded.amortizacion, fuente = excluded.fuente;
    exception when others then
      get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text, v_restr = constraint_name;
      if v_estado = 'P0001' then raise; end if;
      raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
    end;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

comment on function guardar_flujos_bono(jsonb) is
  'Graba o corrige el cronograma de pagos por 1 VN de un bono o una letra, con su fuente, en una transacción';

revoke all on function guardar_flujos_bono(jsonb) from public, anon, authenticated;
grant execute on function guardar_flujos_bono(jsonb) to service_role;
