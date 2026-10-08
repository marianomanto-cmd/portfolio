-- Carga transaccional: confirmar, revertir y altas manuales, cada una en una
-- sola transacción (docs/datos.md, reglas 3 y 4; D-17, D-19, D-32, D-33).
--
-- Con supabase-js cada insert es un pedido HTTP separado, sin atomicidad. Por
-- eso toda escritura que toca más de una fila pasa por una función de Postgres:
--   * confirmar_carga(p): un Enter de la pantalla de carga = un lote, con una
--     carga por cuenta y otra para el tipo de cambio tipeado. También completa
--     el precio de una compra que había quedado pendiente (D-19).
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

-- ═════════════════════════ operaciones: el precio que completó una carga (D-19) ═════════════════════════
-- El día de una compra IEB muestra PPP "-": la compra se graba con el precio
-- vacío (pendiente). Una carga posterior lo completa a partir del PPP nuevo,
-- solo si el dueño acepta la propuesta. precio_carga_id dice qué carga lo
-- completó: revertir ese lote deja la compra pendiente otra vez. La auditoría
-- guarda el cambio (antes: precio null; después: el precio y su carga).
alter table operaciones
  add column precio_carga_id bigint references cargas(id);
alter table operaciones
  add constraint operaciones_precio_carga check (
    precio_carga_id is null or (tipo = 'compra' and precio is not null and importe is null));
create index operaciones_precio_carga on operaciones (precio_carga_id) where precio_carga_id is not null;

comment on column operaciones.precio_carga_id is 'Carga que completó el precio de esta compra pendiente (D-19); null si el precio vino con la compra';

-- ═════════════════════════ tipo_cambio: de dónde salió el CCL ═════════════════════════
alter table tipo_cambio
  add column referencia text check (referencia is null or (btrim(referencia) <> '' and char_length(referencia) <= 200));

comment on column tipo_cambio.referencia is 'De dónde sacó el dueño el CCL tipeado ("Ámbito, cierre"); hasta 200 caracteres';

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

comment on function leer_monto(jsonb, text) is 'Monto de la entrada JSON: texto decimal; falla con número JSON, NaN, Infinity o formato no normalizado (D-32)';
comment on function leer_fecha(jsonb, text) is 'Fecha AAAA-MM-DD de la entrada JSON';
comment on function leer_id(jsonb, text) is 'Identificador entero positivo de la entrada JSON';

-- Permisos (D-20, D-33): una función nueva es ejecutable por PUBLIC por defecto
-- (el default global no se revoca por esquema): se revoca explícitamente.
revoke all on function
  leer_monto(jsonb, text),
  leer_fecha(jsonb, text),
  leer_id(jsonb, text)
  from public, anon, authenticated;

grant execute on function
  leer_monto(jsonb, text),
  leer_fecha(jsonb, text),
  leer_id(jsonb, text)
  to service_role;
