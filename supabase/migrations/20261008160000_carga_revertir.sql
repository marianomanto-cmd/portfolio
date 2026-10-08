-- revertir_lote: deshace un lote y restaura desde la auditoría.
-- Parte de la carga transaccional (ver 20261008133914_carga_transaccional.sql).

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
  v_n           integer;
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

  -- Precios que este lote completó (D-19): la compra vuelve a quedar pendiente.
  update operaciones set precio = null, precio_carga_id = null
   where precio_carga_id = any(v_cargas);
  get diagnostics v_n = row_count;
  v_restauradas := v_restauradas + v_n;

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

comment on function revertir_lote(uuid, text) is 'Revierte un lote: borra sus hechos, restaura desde la auditoría lo pisado, deja pendientes las compras cuyo precio completó y marca sus cargas como revertidas, con motivo';

-- Permisos (D-20, D-33): una función nueva es ejecutable por PUBLIC por defecto
-- (el default global no se revoca por esquema): se revoca explícitamente.
revoke all on function
  revertir_lote(uuid, text)
  from public, anon, authenticated;

grant execute on function
  revertir_lote(uuid, text)
  to service_role;
