-- confirmar_carga, segunda versión (revisión de la fase 1a). Reemplaza la
-- función de 20261008142244_carga_confirmar.sql (que no se edita) con tres
-- cambios; el resto es igual:
--
-- 1. Recargar el mismo día tipeando un solo tipo de cambio ya no borra los
--    otros: lo vacío conserva lo que el día tenía (coalesce), y la referencia
--    sigue a su CCL.
-- 2. "Un precio por activo y por día: si dos cuentas traen el mismo activo,
--    vale el del Excel" (D-106) también entre lotes: una captura posterior no
--    pisa el precio que grabó un Excel ese día.
-- 3. Huella del pedido: un reintento del mismo Enter sigue siendo "ya estaba
--    guardado"; el mismo lote con otro contenido se rechaza con un mensaje
--    claro, en vez de descartar en silencio lo cambiado.

create or replace function confirmar_carga(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_lote      uuid;
  v_fecha     date;
  v_tiempo    integer;
  v_nota      text;
  v_tc        jsonb;
  v_cuentas   jsonb;
  v_c         jsonb;
  v_x         jsonb;
  v_n         bigint;
  v_cuenta    bigint;
  v_nombre    text;
  v_activo    bigint;
  v_ctx       text;
  v_prev      bigint;
  v_carga     bigint;
  v_primera   bigint;
  v_res       jsonb := '[]'::jsonb;
  v_estado    text;
  v_mensaje   text;
  v_restr     text;
  v_ref       text;
  v_op        bigint;
  v_precio    numeric;
  v_huella    text;
  v_previa    text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'La confirmación llegó vacía o con otra forma';
  end if;

  -- ── Validación de la forma (antes de tomar el lock) ──
  if coalesce(p->>'lote', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'El lote no es un identificador válido: %', coalesce(p->>'lote', '(vacío)');
  end if;
  v_lote := (p->>'lote')::uuid;
  v_fecha := leer_fecha(p->'fecha', 'la fecha de la carga');
  if v_fecha is null then
    raise exception 'Falta la fecha de la carga';
  end if;

  v_cuentas := coalesce(nullif(p->'cuentas', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_cuentas) <> 'array' then
    raise exception 'Las cuentas de la carga tienen que ser una lista';
  end if;
  for v_c in select e from jsonb_array_elements(v_cuentas) e loop
    if jsonb_typeof(v_c) <> 'object' then
      raise exception 'Cada cuenta de la carga tiene que ser un objeto';
    end if;
    if leer_id(v_c->'cuenta_id', 'la cuenta') is null then
      raise exception 'Falta la cuenta en una de las cargas';
    end if;
  end loop;
  if (select count(*) <> count(distinct leer_id(e->'cuenta_id', 'la cuenta'))
        from jsonb_array_elements(v_cuentas) e) then
    raise exception 'Una cuenta aparece dos veces en la misma carga';
  end if;

  v_tc := nullif(p->'tipo_cambio', 'null'::jsonb);
  if v_tc is not null then
    if jsonb_typeof(v_tc) <> 'object' then
      raise exception 'El tipo de cambio llegó con otra forma';
    end if;
    if coalesce(jsonb_typeof(v_tc->'referencia'), 'null') not in ('string','null') then
      raise exception 'La referencia del CCL tiene que ser texto';
    end if;
    v_ref := nullif(btrim(v_tc->>'referencia'), '');
    if char_length(v_ref) > 200 then
      raise exception 'La referencia del CCL tiene más de 200 caracteres';
    end if;
    -- Un tipo de cambio sin ningún valor no es un dato: no se graba ni pisa nada.
    if leer_monto(v_tc->'ccl', 'el CCL') is null
       and leer_monto(v_tc->'mep', 'el MEP') is null
       and leer_monto(v_tc->'cripto_venta', 'el dólar cripto') is null
       and leer_monto(v_tc->'oficial', 'el dólar oficial') is null then
      v_tc := null;
    end if;
  end if;

  if jsonb_typeof(p->'tiempo_activo_ms') = 'number' then
    v_tiempo := round((p->>'tiempo_activo_ms')::numeric)::integer;
    if v_tiempo < 0 then
      raise exception 'El tiempo activo no puede ser negativo';
    end if;
  elsif coalesce(jsonb_typeof(p->'tiempo_activo_ms'), 'null') <> 'null' then
    raise exception 'El tiempo activo tiene que ser un número de milisegundos';
  end if;

  v_nota := nullif(btrim(p->>'nota'), '');

  -- Huella del pedido (lo que el dueño eligió en la bandeja), para reconocer un
  -- reintento del mismo Enter y distinguirlo de un lote reusado con otro contenido.
  v_huella := nullif(btrim(p->>'huella'), '');
  if v_huella is not null and v_huella !~ '^[0-9a-f]{64}$' then
    raise exception 'La huella de la carga no es válida';
  end if;

  if v_tc is null and jsonb_array_length(v_cuentas) = 0 then
    raise exception 'No hay nada para grabar: no hay tipo de cambio ni ninguna cuenta';
  end if;

  -- ── Un lote a la vez ──
  -- Serializa toda escritura de cargas (las tres funciones usan la misma
  -- llave). Un doble Enter espera a que termine el primero y lo encuentra.
  perform pg_advisory_xact_lock(2026100801);

  -- ── Idempotencia: el mismo lote no se graba dos veces ──
  if exists (select 1 from cargas where lote = v_lote) then
    if exists (select 1 from cargas where lote = v_lote and lector = 'manual') then
      raise exception 'El lote % ya se usó para un alta manual', v_lote;
    end if;
    if not exists (select 1 from cargas where lote = v_lote and estado <> 'revertida') then
      raise exception 'Esa carga se confirmó y después se revirtió. Para volver a grabarla, empezá una carga nueva.';
    end if;
    if exists (select 1 from cargas where lote = v_lote and fecha <> v_fecha)
       or array(select cuenta_id::bigint from cargas
                 where lote = v_lote and cuenta_id is not null order by 1)
          is distinct from
          array(select distinct leer_id(e->'cuenta_id', 'la cuenta')
                  from jsonb_array_elements(v_cuentas) e order by 1)
       or exists (select 1 from cargas where lote = v_lote and cuenta_id is null) <> (v_tc is not null)
    then
      raise exception 'El lote % ya se usó para otra carga (otra fecha u otras cuentas)', v_lote;
    end if;
    -- Mismo lote, otro contenido (después de un corte cambiaste algo en la bandeja):
    -- no se dice "ya estaba guardado" como si fuera lo mismo.
    select grabado->>'huella' into v_previa
      from cargas where lote = v_lote and estado <> 'revertida' and grabado ? 'huella'
     order by id limit 1;
    if v_huella is not null and v_previa is not null and v_huella <> v_previa then
      raise exception 'Ese lote ya se guardó con otro contenido: lo que cambiaste después no se grabó. Tocá «Nueva carga» y volvé a armarla.';
    end if;
    return jsonb_build_object(
      'lote', v_lote,
      'cargas', (select jsonb_agg(jsonb_build_object('carga_id', id, 'cuenta_id', cuenta_id) order by id)
                   from cargas where lote = v_lote),
      'repetido', true);
  end if;

  -- ── Tipo de cambio tipeado: su propia carga ──
  if v_tc is not null then
    select id into v_prev from cargas
     where fecha = v_fecha and cuenta_id is null and lector = 'tipeado' and estado = 'vigente'
     order by id desc limit 1;
    update cargas set estado = 'reemplazada'
     where fecha = v_fecha and cuenta_id is null and lector = 'tipeado' and estado = 'vigente';

    insert into cargas (fecha, cuenta_id, origen, lector, lote, tiempo_activo_ms, reemplaza_a, grabado)
    values (v_fecha, null, 'manual', 'tipeado', v_lote, v_tiempo, v_prev,
            jsonb_build_object('tipo_cambio', v_tc)
              || case when v_huella is null then '{}'::jsonb else jsonb_build_object('huella', v_huella) end)
    returning id into v_carga;

    begin
      -- Lo tipeado ahora pisa; lo que no se tipeó (vacío) conserva lo que el día
      -- ya tenía ("lo que no cambió no se vuelve a cargar"). La referencia va con
      -- su CCL: sin CCL nuevo, queda la del CCL que sigue. La fila pasa a esta
      -- carga; revertirla restaura la anterior desde la auditoría.
      insert into tipo_cambio (fecha, ccl, mep, cripto_venta, oficial, referencia, carga_id)
      values (v_fecha,
              leer_monto(v_tc->'ccl', 'el CCL'),
              leer_monto(v_tc->'mep', 'el MEP'),
              leer_monto(v_tc->'cripto_venta', 'el dólar cripto'),
              leer_monto(v_tc->'oficial', 'el dólar oficial'),
              v_ref,
              v_carga)
      on conflict (fecha) do update
        set ccl = coalesce(excluded.ccl, tipo_cambio.ccl),
            mep = coalesce(excluded.mep, tipo_cambio.mep),
            cripto_venta = coalesce(excluded.cripto_venta, tipo_cambio.cripto_venta),
            oficial = coalesce(excluded.oficial, tipo_cambio.oficial),
            referencia = case when excluded.ccl is not null then excluded.referencia else tipo_cambio.referencia end,
            carga_id = excluded.carga_id;
    exception when others then
      get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                              v_restr = constraint_name;
      if v_estado = 'P0001' then raise; end if;
      raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr,
        detail = 'tipo de cambio del ' || to_char(v_fecha, 'DD/MM/YYYY');
    end;

    v_res := v_res || jsonb_build_array(jsonb_build_object('carga_id', v_carga, 'cuenta_id', null));
    v_primera := v_carga;
  end if;

  -- ── Una carga por cuenta ──
  for v_c in select e.x from jsonb_array_elements(v_cuentas) with ordinality as e(x, n) order by e.n loop
    v_cuenta := leer_id(v_c->'cuenta_id', 'la cuenta');
    select nombre into v_nombre from cuentas where id = v_cuenta;
    if not found then
      raise exception 'La cuenta % no existe', v_cuenta;
    end if;

    -- Volver a cargar el mismo día reemplaza la carga anterior de esa cuenta
    -- (docs/carga-diaria.md, idempotencia). La anterior queda en el registro.
    select id into v_prev from cargas
     where fecha = v_fecha and cuenta_id = v_cuenta and estado = 'vigente'
     order by id desc limit 1;
    update cargas set estado = 'reemplazada'
     where fecha = v_fecha and cuenta_id = v_cuenta and estado = 'vigente';

    begin
      insert into cargas (fecha, cuenta_id, origen, archivo_path, archivo_sha256, lector,
                          lectura_cruda, grabado, listado_completo, lote, tiempo_activo_ms, reemplaza_a)
      values (v_fecha, v_cuenta, v_c->>'origen',
              nullif(btrim(v_c->>'archivo_path'), ''),
              nullif(btrim(v_c->>'archivo_sha256'), ''),
              nullif(btrim(v_c->>'lector'), ''),
              nullif(v_c->'lectura_cruda', 'null'::jsonb),
              case when v_huella is not null and jsonb_typeof(v_c->'grabado') = 'object'
                   then (v_c->'grabado') || jsonb_build_object('huella', v_huella)
                   else nullif(v_c->'grabado', 'null'::jsonb) end,
              coalesce((v_c->>'listado_completo')::boolean, true),
              v_lote, v_tiempo, v_prev)
      returning id into v_carga;
    exception when others then
      get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                              v_restr = constraint_name;
      if v_estado = 'P0001' then raise; end if;
      raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr,
        detail = 'carga de ' || v_nombre;
    end;

    -- Cotizaciones: una por activo y día; la última carga del día manda, salvo
    -- que el precio del día venga de un Excel y esta carga no lo sea: vale el
    -- del Excel, también entre lotes (D-106; la bandeja ya lo anota en lo grabado).
    if jsonb_typeof(coalesce(v_c->'cotizaciones', '[]'::jsonb)) not in ('array','null') then
      raise exception 'Las cotizaciones de % tienen que ser una lista', v_nombre;
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(nullif(v_c->'cotizaciones', 'null'::jsonb), '[]'::jsonb)) e
                group by leer_id(e->'activo_id', 'el activo de una cotización') having count(*) > 1) then
      raise exception 'Un activo tiene dos cotizaciones en la carga de %', v_nombre;
    end if;
    for v_x, v_n in
      select e.x, e.n from jsonb_array_elements(coalesce(nullif(v_c->'cotizaciones', 'null'::jsonb), '[]'::jsonb))
             with ordinality as e(x, n) order by e.n
    loop
      v_activo := leer_id(v_x->'activo_id', format('el activo de la cotización %s de %s', v_n, v_nombre));
      v_ctx := format('%s · cotización de %s', v_nombre,
                      coalesce((select ticker from activos where id = v_activo),
                               format('activo #%s (no está en el catálogo)', coalesce(v_activo::text, '?'))));
      begin
        insert into cotizaciones (fecha, activo_id, precio_pesos, precio_usd_subyacente, carga_id)
        values (v_fecha, v_activo,
                leer_monto(v_x->'precio_pesos', v_ctx || ', precio en pesos'),
                leer_monto(v_x->'precio_usd_subyacente', v_ctx || ', precio del subyacente'),
                v_carga)
        on conflict (fecha, activo_id) do update
          set precio_pesos = excluded.precio_pesos,
              precio_usd_subyacente = excluded.precio_usd_subyacente,
              carga_id = excluded.carga_id
          where v_c->>'origen' = 'excel'
             or not exists (select 1 from cargas k
                             where k.id = cotizaciones.carga_id and k.origen = 'excel' and k.estado <> 'revertida');
      exception when others then
        get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                                v_restr = constraint_name;
        if v_estado = 'P0001' then raise; end if;
        raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
      end;
    end loop;

    -- Saldos: uno por cuenta, moneda y día (D-13). Pueden ser negativos.
    if jsonb_typeof(coalesce(v_c->'saldos', '[]'::jsonb)) not in ('array','null') then
      raise exception 'Los saldos de % tienen que ser una lista', v_nombre;
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(nullif(v_c->'saldos', 'null'::jsonb), '[]'::jsonb)) e
                group by e->>'moneda' having count(*) > 1) then
      raise exception 'La carga de % tiene dos saldos en la misma moneda', v_nombre;
    end if;
    for v_x, v_n in
      select e.x, e.n from jsonb_array_elements(coalesce(nullif(v_c->'saldos', 'null'::jsonb), '[]'::jsonb))
             with ordinality as e(x, n) order by e.n
    loop
      v_ctx := format('%s · saldo en %s', v_nombre, coalesce(v_x->>'moneda', '(sin moneda)'));
      begin
        insert into saldos_liquidez (fecha, cuenta_id, moneda, monto, carga_id)
        values (v_fecha, v_cuenta, v_x->>'moneda', leer_monto(v_x->'monto', v_ctx), v_carga)
        on conflict (fecha, cuenta_id, moneda) do update
          set monto = excluded.monto, carga_id = excluded.carga_id;
      exception when others then
        get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                                v_restr = constraint_name;
        if v_estado = 'P0001' then raise; end if;
        raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
      end;
    end loop;

    -- Operaciones: hechos nuevos, con la fecha de la carga.
    if jsonb_typeof(coalesce(v_c->'operaciones', '[]'::jsonb)) not in ('array','null') then
      raise exception 'Las operaciones de % tienen que ser una lista', v_nombre;
    end if;
    for v_x, v_n in
      select e.x, e.n from jsonb_array_elements(coalesce(nullif(v_c->'operaciones', 'null'::jsonb), '[]'::jsonb))
             with ordinality as e(x, n) order by e.n
    loop
      v_activo := leer_id(v_x->'activo_id', format('el activo de la operación %s de %s', v_n, v_nombre));
      v_ctx := format('%s · %s de %s', v_nombre, coalesce(v_x->>'tipo', 'operación'),
                      coalesce((select ticker from activos where id = v_activo),
                               format('activo #%s (no está en el catálogo)', coalesce(v_activo::text, '?'))));
      begin
        insert into operaciones (fecha, fecha_origen, cuenta_id, activo_id, tipo, cantidad, moneda,
                                 precio, importe, comisiones, ccl_del_dia, carga_id, notas)
        values (v_fecha,
                leer_fecha(v_x->'fecha_origen', v_ctx || ', fecha de origen'),
                v_cuenta, v_activo, v_x->>'tipo',
                leer_monto(v_x->'cantidad', v_ctx || ', cantidad'),
                coalesce(nullif(btrim(v_x->>'moneda'), ''), 'ARS'),
                leer_monto(v_x->'precio', v_ctx || ', precio'),
                leer_monto(v_x->'importe', v_ctx || ', importe'),
                coalesce(leer_monto(v_x->'comisiones', v_ctx || ', comisiones'), 0),
                leer_monto(v_x->'ccl_del_dia', v_ctx || ', CCL del día'),
                v_carga,
                nullif(btrim(v_x->>'notas'), ''));
      exception when others then
        get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                                v_restr = constraint_name;
        if v_estado = 'P0001' then raise; end if;
        raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
      end;
    end loop;

    -- Precios que completan compras pendientes de esta cuenta (D-19). Solo una
    -- compra que sigue pendiente (precio e importe vacíos), de esta cuenta y de
    -- una fecha que no sea posterior a la carga: nunca se pisa un precio.
    if jsonb_typeof(coalesce(v_c->'completar_precios', '[]'::jsonb)) not in ('array','null') then
      raise exception 'Los precios a completar de % tienen que ser una lista', v_nombre;
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(nullif(v_c->'completar_precios', 'null'::jsonb), '[]'::jsonb)) e
                group by leer_id(e->'operacion_id', 'la compra a completar') having count(*) > 1) then
      raise exception 'Una compra aparece dos veces entre los precios a completar de %', v_nombre;
    end if;
    for v_x, v_n in
      select e.x, e.n from jsonb_array_elements(coalesce(nullif(v_c->'completar_precios', 'null'::jsonb), '[]'::jsonb))
             with ordinality as e(x, n) order by e.n
    loop
      v_op := leer_id(v_x->'operacion_id', format('la compra a completar %s de %s', v_n, v_nombre));
      if v_op is null then
        raise exception 'Falta la compra a completar % de %', v_n, v_nombre;
      end if;
      v_ctx := format('%s · precio de la compra #%s', v_nombre, v_op);
      v_precio := leer_monto(v_x->'precio', v_ctx);
      if v_precio is null then
        raise exception 'Falta el precio para completar la compra #% de %', v_op, v_nombre;
      end if;
      begin
        update operaciones
           set precio = v_precio, precio_carga_id = v_carga
         where id = v_op and cuenta_id = v_cuenta and tipo = 'compra'
           and precio is null and importe is null and fecha <= v_fecha;
        if not found then
          raise exception 'La compra #% ya no está pendiente en % (tiene precio, no es una compra de esa cuenta o es posterior a la carga): volvé a armar la bandeja',
            v_op, v_nombre;
        end if;
      exception when others then
        get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                                v_restr = constraint_name;
        if v_estado = 'P0001' then raise; end if;
        raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
      end;
    end loop;

    v_res := v_res || jsonb_build_array(jsonb_build_object('carga_id', v_carga, 'cuenta_id', v_cuenta));
    v_primera := coalesce(v_primera, v_carga);
  end loop;

  -- ── Nota del día (va con la primera carga del lote) ──
  if v_nota is not null then
    insert into eventos (fecha, tipo, titulo, carga_id) values (v_fecha, 'nota', v_nota, v_primera);
  end if;

  return jsonb_build_object('lote', v_lote, 'cargas', v_res, 'repetido', false);
end $$;

comment on function confirmar_carga(jsonb) is 'Confirma un lote de la carga diaria en una transacción: tipo de cambio (lo no tipeado conserva lo del día; la referencia sigue a su CCL), cargas por cuenta, cotizaciones (el precio de un Excel no lo pisa una captura), saldos, operaciones, precios que completan compras pendientes (D-19) y nota. Idempotente por lote, con huella del pedido';

-- Permisos (D-20, D-33): create or replace conserva los de la función, pero se
-- repiten por si esta migración se aplica sobre una base sin la anterior.
revoke all on function
  confirmar_carga(jsonb)
  from public, anon, authenticated;

grant execute on function
  confirmar_carga(jsonb)
  to service_role;
