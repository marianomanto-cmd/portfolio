-- Escenarios guardados y el último valor de cada deslizante (entrega 4, plan §6 D.4 y §7; D-08, D-148).
--
-- Un escenario guarda SUPUESTOS, nunca resultados: la proyección se calcula
-- cada vez (D-22). Un escenario no se borra: se archiva (D-116).

do $$ begin
  if exists (select 1 from escenarios) then
    raise exception 'escenarios tiene filas: esta migración suma un check de versión; reescribirla en tres pasos (visión 7.0)';
  end if;
end $$;

alter table escenarios
  add column archivado_en timestamptz,
  add constraint escenarios_supuestos_con_version
    check (jsonb_typeof(supuestos) = 'object' and jsonb_typeof(supuestos->'v') = 'number'),
  add constraint escenarios_nombre_check
    check (char_length(btrim(nombre)) between 1 and 60);

comment on column escenarios.archivado_en is
  'Cuándo lo archivaste. Un escenario no se borra: se archiva y deja de listarse';
comment on column escenarios.supuestos is
  'Los supuestos del escenario (JSON validado con zod en el servidor, con su versión "v"). Nunca resultados: la proyección se recalcula';

create table valores_recordados (
  variable        text primary key check (variable ~ '^[a-z][a-z0-9_.]{0,79}$'),
  valor           numeric not null check (valor > '-Infinity' and valor < 'Infinity'),
  actualizado_en  timestamptz not null default now()
);
alter table valores_recordados enable row level security;
revoke all on table valores_recordados from public, anon, authenticated;
-- Solo crece y se pisa (visión 7.0): sin permiso de borrado.
grant select, insert, update on table valores_recordados to service_role;
create trigger auditar after insert or update on valores_recordados
  for each row execute function registrar_auditoria();
comment on table valores_recordados is
  'Último valor que elegiste en cada deslizante, para tus próximos escenarios (D-08). No es un supuesto activo: un escenario nuevo arranca sin nada elegido';
comment on column valores_recordados.variable is
  'Clave de la variable del escenario, como en supuestos (ej. devaluacion, retorno.cedear)';
comment on column valores_recordados.valor is
  'El número del deslizante, en la unidad de la variable (%/mes o %/año)';
comment on column valores_recordados.actualizado_en is
  'Cuándo lo elegiste por última vez';

-- ═════════════════════════ guardar_escenario ═════════════════════════
-- Alta o cambio por id, archivo y vuelta del archivo, y el upsert de los
-- valores recordados, en una transacción.
-- Entrada: {"accion": "guardar"|"archivar"|"desarchivar", "id"?, "nombre", "supuestos", "notas"?,
--           "recordados": {"devaluacion": "2", …}}.
-- Devuelve el id del escenario.
create function guardar_escenario(p jsonb) returns smallint
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_accion    text;
  v_id        smallint;
  v_nombre    text;
  v_sup       jsonb;
  v_rec       jsonb;
  v_k         text;
  v_v         jsonb;
  v_estado    text;
  v_mensaje   text;
  v_restr     text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'El escenario llegó vacío o con otra forma';
  end if;
  v_accion := coalesce(nullif(btrim(p->>'accion'), ''), 'guardar');
  if v_accion not in ('guardar','archivar','desarchivar') then
    raise exception 'Acción inválida: % (guardar, archivar o desarchivar)', v_accion;
  end if;
  v_id := leer_id(p->'id', 'el escenario');

  perform pg_advisory_xact_lock(2026100801);

  if v_accion in ('archivar','desarchivar') then
    if v_id is null then
      raise exception 'Falta qué escenario %', v_accion;
    end if;
    update escenarios
       set archivado_en = case when v_accion = 'archivar' then now() end, actualizado_en = now()
     where id = v_id;
    if not found then
      raise exception 'No existe el escenario #%', v_id;
    end if;
    return v_id;
  end if;

  v_nombre := nullif(btrim(p->>'nombre'), '');
  if v_nombre is null then
    raise exception 'Falta el nombre del escenario';
  end if;
  v_sup := p->'supuestos';
  if v_sup is null or jsonb_typeof(v_sup) <> 'object' then
    raise exception 'Faltan los supuestos del escenario';
  end if;
  if coalesce(jsonb_typeof(v_sup->'v'), '') <> 'number' then
    raise exception 'Los supuestos no dicen su versión ("v"): no se pueden leer después';
  end if;

  begin
    if v_id is null then
      insert into escenarios (nombre, supuestos, notas)
      values (v_nombre, v_sup, nullif(btrim(p->>'notas'), ''))
      returning id into v_id;
    else
      update escenarios
         set nombre = v_nombre, supuestos = v_sup, notas = nullif(btrim(p->>'notas'), ''), actualizado_en = now()
       where id = v_id;
      if not found then
        raise exception 'No existe el escenario #%', v_id;
      end if;
    end if;
  exception when unique_violation then
    raise exception 'Ya tenés un escenario que se llama "%": elegí otro nombre', v_nombre;
  when others then
    get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text, v_restr = constraint_name;
    if v_estado = 'P0001' then raise; end if;
    raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_nombre;
  end;

  v_rec := coalesce(nullif(p->'recordados', 'null'::jsonb), '{}'::jsonb);
  if jsonb_typeof(v_rec) <> 'object' then
    raise exception 'Los valores recordados tienen que ser un objeto';
  end if;
  for v_k, v_v in select key, value from jsonb_each(v_rec) loop
    insert into valores_recordados (variable, valor, actualizado_en)
    values (v_k, leer_monto(v_v, 'el valor recordado de ' || v_k), now())
    on conflict (variable) do update set valor = excluded.valor, actualizado_en = excluded.actualizado_en;
  end loop;

  return v_id;
end $$;

comment on function guardar_escenario(jsonb) is
  'Guarda (alta o cambio), archiva o desarchiva un escenario y pisa los valores recordados de sus deslizantes, en una transacción';

revoke all on function guardar_escenario(jsonb) from public, anon, authenticated;
grant execute on function guardar_escenario(jsonb) to service_role;
