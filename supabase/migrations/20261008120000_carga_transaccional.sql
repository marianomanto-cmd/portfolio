-- Carga transaccional: confirmar, revertir y altas manuales, cada una en una
-- sola transacción (docs/datos.md, reglas 3 y 4; D-17, D-19, D-32, D-33).
--
-- Con supabase-js cada insert es un pedido HTTP separado, sin atomicidad. Por
-- eso toda escritura que toca más de una fila pasa por una función de Postgres:
--   * confirmar_carga(p): un Enter de la pantalla de carga = un lote, con una
--     carga por cuenta y otra para el tipo de cambio tipeado.
--   * revertir_lote(lote, motivo): deshace un lote entero y restaura, desde la
--     auditoría, lo que había pisado. Las cargas quedan en el registro.
--   * guardar_manual(p): valuaciones de bienes, capital pendiente de pasivos y
--     movimientos de capital, con su propia carga.
--   * alta_activo(p) y editar_activo(id, p): el activo y su ratio juntos.
-- Todas son security invoker: corren con los permisos de service_role, y el
-- trigger de auditoría registra cada fila que tocan. Los montos llegan como
-- texto JSON y se convierten con leer_monto(), nunca a través de un float (D-32).

-- La migración agrega checks que las cargas existentes tendrían que cumplir.
-- Hoy no hay cargas con archivo ni revertidas (no existía la capa de escritura).
do $$ begin
  if exists (select 1 from cargas where archivo_path is not null or estado = 'revertida') then
    raise exception 'Hay cargas con archivo o revertidas: completar archivo_sha256 y motivo_reversion antes de aplicar esta migración';
  end if;
end $$;

-- ═════════════════════════ cargas ═════════════════════════

alter table cargas
  -- Un Enter = un lote. Un lote abarca varias cargas (una por cuenta y otra
  -- para el tipo de cambio), así que no es único. Es la llave de idempotencia.
  add column lote              uuid,
  -- Quién leyó: 'ieb-excel@1', 'captura-claude@1', 'tipeado', 'manual'.
  add column lector            text check (lector is null or btrim(lector) <> ''),
  -- El archivo se guarda en el bucket privado 'cargas' con su sha256 en la ruta.
  add column archivo_sha256    text check (archivo_sha256 ~ '^[0-9a-f]{64}$'),
  -- Tiempo activo del lote (D-62). Se repite en cada carga del lote: es del lote.
  add column tiempo_activo_ms  integer check (tiempo_activo_ms >= 0),
  add column motivo_reversion  text;

alter table cargas
  add constraint cargas_archivo_sha256 check (
    (archivo_path is null) = (archivo_sha256 is null)
    and (archivo_path is null or strpos(archivo_path, archivo_sha256) > 0)),
  add constraint cargas_motivo_reversion check (
    (estado = 'revertida') = (motivo_reversion is not null)
    and (motivo_reversion is null or btrim(motivo_reversion) <> ''));

create index cargas_lote on cargas (lote);
create index cargas_fecha_cuenta on cargas (fecha, cuenta_id);

comment on column cargas.lote is 'Un Enter = un lote: varias cargas (una por cuenta + el tipo de cambio). Llave de idempotencia de confirmar_carga';
comment on column cargas.lector is 'Quién leyó la fuente y con qué versión (ieb-excel@1, captura-claude@1, tipeado, manual)';
comment on column cargas.archivo_sha256 is 'sha256 del archivo original; la ruta en Storage lo contiene';
comment on column cargas.tiempo_activo_ms is 'Tiempo activo del lote (D-62); se repite en cada carga del lote';
comment on column cargas.motivo_reversion is 'Por qué se revirtió (obligatorio si estado = revertida)';

-- ═════════════════════════ eventos: la nota del día ═════════════════════════

alter table eventos drop constraint eventos_tipo_check;
alter table eventos
  add constraint eventos_tipo_check check (tipo in ('balance','macro','otro','nota'));
alter table eventos
  add column carga_id bigint references cargas(id);
alter table eventos
  add constraint eventos_nota check (tipo <> 'nota' or (carga_id is not null and btrim(titulo) <> ''));
create index eventos_carga on eventos (carga_id);

comment on column eventos.carga_id is 'Carga de la que salió el evento (la nota del día va con la primera carga del lote)';

-- ═════════════════════════ auditoria: buscar la historia de una fila ═════════════════════════
-- revertir_lote recorre la historia de cada fila que deshace (por su clave
-- primaria, con @>). Sin índice, cada búsqueda lee toda la auditoría de la
-- tabla: con cinco años de cotizaciones, revertir un lote tardaba ~0,7 s; con
-- el índice, milisegundos. Se excluyen las cargas: su lectura cruda es grande y
-- la reversión no la busca.
create index auditoria_despues_hechos on auditoria using gin (despues jsonb_path_ops)
  where tabla <> 'cargas';
create index auditoria_antes_borrados on auditoria using gin (antes jsonb_path_ops)
  where tabla <> 'cargas' and operacion = 'DELETE';

-- ═════════════════════════ Lectura de la entrada ═════════════════════════

-- Monto: texto decimal ("1234.56", "-50000", "0.0123"). Falla con un número
-- JSON (ya pasó por un float de JavaScript, D-32), con NaN, Infinity,
-- notación científica o formato es-AR sin normalizar. Vacío o null = sin dato.
create function leer_monto(j jsonb, campo text) returns numeric
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  t text;
begin
  if j is null or jsonb_typeof(j) = 'null' then
    return null;
  end if;
  if jsonb_typeof(j) <> 'string' then
    raise exception 'Monto inválido en %: llegó como %, y los montos viajan como texto (D-32)',
      campo, case jsonb_typeof(j) when 'number' then 'número' when 'boolean' then 'booleano'
                                  when 'array' then 'lista' else 'objeto' end;
  end if;
  t := btrim(j #>> '{}');
  if t = '' then
    return null;
  end if;
  if t !~ '^-?[0-9]+(\.[0-9]+)?$' then
    raise exception 'Monto inválido en %: "%"', campo, t;
  end if;
  return t::numeric;
end $$;

-- Fecha 'AAAA-MM-DD' que exista en el calendario. Vacío o null = sin dato.
create function leer_fecha(j jsonb, campo text) returns date
language plpgsql stable set search_path = public, pg_temp as $$
declare
  t text;
begin
  if j is null or jsonb_typeof(j) = 'null' then
    return null;
  end if;
  t := btrim(j #>> '{}');
  if t = '' then
    return null;
  end if;
  if jsonb_typeof(j) <> 'string' or t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Fecha inválida en %: % (se espera AAAA-MM-DD)', campo, j::text;
  end if;
  begin
    return t::date;
  exception when others then
    raise exception 'Fecha inválida en %: % no existe', campo, t;
  end;
end $$;

-- Identificador entero positivo (número JSON o texto de dígitos). null = falta.
create function leer_id(j jsonb, campo text) returns bigint
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  t text;
begin
  if j is null or jsonb_typeof(j) = 'null' then
    return null;
  end if;
  t := btrim(j #>> '{}');
  if jsonb_typeof(j) not in ('number','string') or t !~ '^[0-9]{1,18}$' then
    raise exception 'Identificador inválido en %: %', campo, j::text;
  end if;
  if t::bigint = 0 then
    raise exception 'Identificador inválido en %: 0', campo;
  end if;
  return t::bigint;
end $$;

-- ═════════════════════════ confirmar_carga ═════════════════════════

-- Entrada: ConfirmacionCarga (src/lib/carga/contratos.ts).
-- Salida: {"lote", "cargas": [{"carga_id", "cuenta_id"}], "repetido"}.
create function confirmar_carga(p jsonb) returns jsonb
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
            jsonb_build_object('tipo_cambio', v_tc))
    returning id into v_carga;

    begin
      -- El día queda con lo tipeado ahora: la fila entera pasa a esta carga.
      insert into tipo_cambio (fecha, ccl, mep, cripto_venta, oficial, carga_id)
      values (v_fecha,
              leer_monto(v_tc->'ccl', 'el CCL'),
              leer_monto(v_tc->'mep', 'el MEP'),
              leer_monto(v_tc->'cripto_venta', 'el dólar cripto'),
              leer_monto(v_tc->'oficial', 'el dólar oficial'),
              v_carga)
      on conflict (fecha) do update
        set ccl = excluded.ccl, mep = excluded.mep, cripto_venta = excluded.cripto_venta,
            oficial = excluded.oficial, carga_id = excluded.carga_id;
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
              nullif(v_c->'grabado', 'null'::jsonb),
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

    -- Cotizaciones: una por activo y día; la última carga del día manda.
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
              carga_id = excluded.carga_id;
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

    v_res := v_res || jsonb_build_array(jsonb_build_object('carga_id', v_carga, 'cuenta_id', v_cuenta));
    v_primera := coalesce(v_primera, v_carga);
  end loop;

  -- ── Nota del día (va con la primera carga del lote) ──
  if v_nota is not null then
    insert into eventos (fecha, tipo, titulo, carga_id) values (v_fecha, 'nota', v_nota, v_primera);
  end if;

  return jsonb_build_object('lote', v_lote, 'cargas', v_res, 'repetido', false);
end $$;

-- ═════════════════════════ revertir_lote ═════════════════════════

-- Revertir = borrar las filas de las cargas del lote, restaurar desde la
-- auditoría lo que habían pisado y marcar las cargas como revertidas, que
-- quedan en el registro (docs/datos.md, regla 4; D-17).
--
-- Para cada fila cuya carga es del lote, recorre su historia en la auditoría
-- de la más nueva a la más vieja y se queda con la última versión que no sea
-- de una carga revertida (ni del lote). Si la encuentra, la restaura; si no
-- hay, o si antes hubo un borrado, borra la fila. Así funciona también cuando
-- en el medio hubo otras reversiones.
create function revertir_lote(p_lote uuid, p_motivo text) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  -- Tablas de hechos con carga_id que la reversión sabe deshacer.
  c_tablas constant text[] := array[
    'operaciones','movimientos_capital','eventos','cotizaciones','saldos_liquidez',
    'tipo_cambio','bienes_valuaciones','pasivo_saldos','pasivo_cuotas','indices'];
  v_motivo      text := nullif(btrim(p_motivo), '');
  v_cargas      bigint[];
  v_bloqueo     record;
  v_ref         record;
  v_hay         boolean;
  v_tabla       text;
  v_pk          text[];
  v_set         text;
  v_join        text;
  v_filas       jsonb[];
  v_fila        jsonb;
  v_clave       jsonb;
  v_version     jsonb;
  v_aud         record;
  v_carga_ver   bigint;
  v_borradas    integer := 0;
  v_restauradas integer := 0;
begin
  if p_lote is null then
    raise exception 'Falta el lote a revertir';
  end if;
  if v_motivo is null then
    raise exception 'Falta el motivo de la reversión';
  end if;

  perform pg_advisory_xact_lock(2026100801);

  if not exists (select 1 from cargas where lote = p_lote) then
    raise exception 'No existe ninguna carga con el lote %', p_lote;
  end if;
  select array_agg(id order by id) into v_cargas
    from cargas where lote = p_lote and estado <> 'revertida';
  if v_cargas is null then
    raise exception 'Ese lote ya está revertido';
  end if;

  -- Solo se revierte la última carga de cada cuenta: una posterior se concilió
  -- contra esta y puede depender de ella (D-15, D-19).
  select cu.nombre as cuenta, c.fecha, x.fecha as fecha_posterior, x.creado_en as creada_posterior
    into v_bloqueo
    from cargas c
    join cuentas cu on cu.id = c.cuenta_id
    join cargas x on x.cuenta_id = c.cuenta_id
                 and x.lote is distinct from c.lote
                 and x.estado <> 'revertida'
                 and (x.creado_en > c.creado_en or x.id > c.id)
   where c.id = any(v_cargas)
   order by x.id desc
   limit 1;
  if found then
    raise exception 'No se puede revertir: después de la carga de % del % se confirmó otra de esa cuenta (la del %, confirmada el %). Solo se revierte la última carga de cada cuenta: revertí primero esa.',
      v_bloqueo.cuenta, to_char(v_bloqueo.fecha, 'DD/MM/YYYY'), to_char(v_bloqueo.fecha_posterior, 'DD/MM/YYYY'),
      to_char(v_bloqueo.creada_posterior at time zone 'America/Argentina/Cordoba', 'DD/MM/YYYY "a las" HH24:MI');
  end if;

  if exists (select 1 from nivel_operaciones n join operaciones o on o.id = n.operacion_id
              where o.carga_id = any(v_cargas)) then
    raise exception 'No se puede revertir: hay niveles que apuntan a operaciones de este lote';
  end if;

  -- Un hecho en una tabla que esta función no conoce no queda huérfano.
  for v_ref in
    select r.conrelid::regclass::text as tabla, a.attname::text as columna
      from pg_constraint r
      join pg_attribute a on a.attrelid = r.conrelid and a.attnum = r.conkey[1]
     where r.contype = 'f' and r.confrelid = 'public.cargas'::regclass
       and r.conrelid <> 'public.cargas'::regclass
       and r.conrelid::regclass::text <> all(c_tablas)
  loop
    execute format('select exists (select 1 from %s where %I = any($1))', v_ref.tabla, v_ref.columna)
      into v_hay using v_cargas;
    if v_hay then
      raise exception 'No se puede revertir: el lote tiene filas en % y la reversión no sabe deshacerlas', v_ref.tabla;
    end if;
  end loop;

  foreach v_tabla in array c_tablas loop
    select array_agg(a.attname::text order by k.n) into v_pk
      from pg_index i
      cross join lateral unnest(i.indkey::int2[]) with ordinality as k(attnum, n)
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
     where i.indrelid = format('public.%I', v_tabla)::regclass and i.indisprimary;

    select string_agg(format('%I = r.%I', a.attname, a.attname), ', ' order by a.attnum) into v_set
      from pg_attribute a
     where a.attrelid = format('public.%I', v_tabla)::regclass
       and a.attnum > 0 and not a.attisdropped
       and a.attgenerated = '' and a.attidentity = ''
       and a.attname::text <> all(v_pk);

    select string_agg(format('t.%I = r.%I', k, k), ' and ') into v_join from unnest(v_pk) k;

    execute format('select coalesce(array_agg(to_jsonb(t)), ''{}'') from %I t where carga_id = any($1)', v_tabla)
      into v_filas using v_cargas;

    foreach v_fila in array v_filas loop
      select jsonb_object_agg(k, v_fila -> k) into v_clave from unnest(v_pk) k;

      v_version := null;
      for v_aud in
        select a.operacion, a.despues
          from auditoria a
         where a.tabla = v_tabla and a.tabla <> 'cargas'
           and ((a.operacion <> 'DELETE' and a.despues @> v_clave)
                or (a.operacion = 'DELETE' and a.antes @> v_clave))
         order by a.id desc
      loop
        exit when v_aud.operacion = 'DELETE';
        v_carga_ver := (v_aud.despues ->> 'carga_id')::bigint;
        continue when v_carga_ver = any(v_cargas)
                   or exists (select 1 from cargas where id = v_carga_ver and estado = 'revertida');
        v_version := v_aud.despues;
        exit;
      end loop;

      if v_version is null then
        execute format('delete from %I t using jsonb_populate_record(null::%I, $1) r where %s',
                       v_tabla, v_tabla, v_join)
          using v_clave;
        v_borradas := v_borradas + 1;
      else
        execute format('update %I t set %s from jsonb_populate_record(null::%I, $1) r where %s',
                       v_tabla, v_set, v_tabla, v_join)
          using v_version;
        v_restauradas := v_restauradas + 1;
      end if;
    end loop;
  end loop;

  update cargas
     set estado = 'revertida', revertida_en = now(), motivo_reversion = v_motivo
   where id = any(v_cargas);

  -- La carga que había sido reemplazada vuelve a ser la vigente de su día:
  -- en cada grupo (día + cuenta, o día del tipo de cambio tipeado), la última
  -- carga no revertida.
  update cargas c set estado = 'vigente'
   where c.estado = 'reemplazada'
     and c.id in (
       select (select max(x.id) from cargas x
                where x.fecha = g.fecha and x.estado <> 'revertida'
                  and (case when g.cuenta_id is not null then x.cuenta_id = g.cuenta_id
                            else x.cuenta_id is null and x.lector = 'tipeado' end))
         from (select distinct fecha, cuenta_id from cargas
                where id = any(v_cargas) and (cuenta_id is not null or lector = 'tipeado')) g);

  return jsonb_build_object('lote', p_lote, 'cargas', to_jsonb(v_cargas),
                            'borradas', v_borradas, 'restauradas', v_restauradas);
end $$;

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

-- ═════════════════════════ Catálogo de activos ═════════════════════════

-- El activo y su ratio (CEDEAR) en una sola transacción: si el ratio falla,
-- no queda un activo a medias. Devuelve el id.
create function alta_activo(p jsonb) returns integer
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

-- Cambia solo las claves presentes en p (una clave con null borra el valor).
-- p.ratio = {ratio, vigente_desde} agrega o corrige un ratio con su vigencia.
create function editar_activo(p_id integer, p jsonb) returns void
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
end $$;

comment on function leer_monto(jsonb, text) is 'Monto de la entrada JSON: texto decimal; falla con número JSON, NaN, Infinity o formato no normalizado (D-32)';
comment on function leer_fecha(jsonb, text) is 'Fecha AAAA-MM-DD de la entrada JSON';
comment on function leer_id(jsonb, text) is 'Identificador entero positivo de la entrada JSON';
comment on function confirmar_carga(jsonb) is 'Confirma un lote de la carga diaria en una transacción: tipo de cambio, cargas por cuenta, cotizaciones, saldos, operaciones y nota. Idempotente por lote';
comment on function revertir_lote(uuid, text) is 'Revierte un lote: borra sus hechos, restaura desde la auditoría lo pisado y marca sus cargas como revertidas, con motivo';
comment on function guardar_manual(jsonb) is 'Graba valuaciones de bienes, capital pendiente de pasivos y movimientos de capital con una carga manual. Idempotente por lote';
comment on function alta_activo(jsonb) is 'Da de alta un activo y, si es CEDEAR con ratio, su ratio, en una transacción';
comment on function editar_activo(integer, jsonb) is 'Cambia los campos presentes de un activo y, opcionalmente, agrega o corrige un ratio';

-- ═════════════════════════ Permisos (D-20, D-33) ═════════════════════════
-- Una función nueva es ejecutable por PUBLIC por defecto (el default global no
-- se revoca por esquema): se revoca explícitamente.

revoke all on function
  leer_monto(jsonb, text), leer_fecha(jsonb, text), leer_id(jsonb, text),
  confirmar_carga(jsonb), revertir_lote(uuid, text), guardar_manual(jsonb),
  alta_activo(jsonb), editar_activo(integer, jsonb)
  from public, anon, authenticated;

grant execute on function
  leer_monto(jsonb, text), leer_fecha(jsonb, text), leer_id(jsonb, text),
  confirmar_carga(jsonb), revertir_lote(uuid, text), guardar_manual(jsonb),
  alta_activo(jsonb), editar_activo(integer, jsonb)
  to service_role;
