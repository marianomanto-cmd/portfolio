-- Cuadro de marcha del leasing (entrega 4, pantalla Pasivos; D-139 a D-143, D-152, D-153).
--
-- * pasivo_cuotas pasa a guardar el cuadro de marcha que manda el dueño: cada cuota es
--   facturada (con comprobante de la leasera) o proyectada (todavía sin factura: nunca un
--   hecho), con la fuente de cada monto, y si está pagada (puede estarlo sin fecha: el
--   débito automático no la trae en la planilla). Se guarda lo facturado, sin derivar:
--   seguro neto e IVA sobre canon y seguro.
-- * pasivos suma quién paga la cuota, si la empresa le reintegra el IVA al dueño y desde
--   cuándo corre la financiación (con el monto financiado da la tasa del contrato).
-- * pasivo_cargos: los cargos que no son cuota (multas, comisiones, reservas, intereses).
-- * guardar_cuadro_marcha(p): graba el cuadro (o una cuota, o un cargo) con una carga
--   manual, en una transacción, idempotente por lote; upsert por número de cuota.
--
-- No borra nada (D-116). pasivo_cuotas llega vacía: la guarda lo verifica.

do $$ begin
  if exists (select 1 from pasivo_cuotas) then
    raise exception 'pasivo_cuotas tiene filas: esta migración suma columnas obligatorias; reescribirla en tres pasos (visión 7.0)';
  end if;
end $$;

-- ═════════════════════════ pasivo_cuotas ═════════════════════════
-- Sin decir nada, una cuota es proyectada, de contrato e impaga: el error conservador
-- (nunca un hecho por omisión). guardar_cuadro_marcha siempre los dice.

alter table pasivo_cuotas
  add column estado text not null default 'proyectada'
    constraint pasivo_cuotas_estado_check check (estado in ('facturada','proyectada')),
  add column periodo date
    constraint pasivo_cuotas_periodo_check check (periodo is null or extract(day from periodo) = 1),
  add column fuente_canon text not null default 'contrato'
    constraint pasivo_cuotas_fuente_canon_check check (fuente_canon in ('comprobante','contrato','a_confirmar','supuesto')),
  add column fuente_seguro text not null default 'contrato'
    constraint pasivo_cuotas_fuente_seguro_check check (fuente_seguro in ('comprobante','contrato','a_confirmar','supuesto','no_aplica')),
  add column fuente_otros text not null default 'contrato'
    constraint pasivo_cuotas_fuente_otros_check check (fuente_otros in ('comprobante','contrato','a_confirmar','supuesto','no_aplica')),
  add column pagada boolean not null default false,
  add column ccl_fuente text
    constraint pasivo_cuotas_ccl_fuente_check check (ccl_fuente is null or char_length(btrim(ccl_fuente)) between 1 and 200),
  add column pagador text
    constraint pasivo_cuotas_pagador_check check (pagador is null or pagador in ('titular','empresa')),
  add column notas text
    constraint pasivo_cuotas_notas_check check (notas is null or char_length(btrim(notas)) between 1 and 500),
  add constraint pasivo_cuotas_facturada_con_comprobante check (
    estado <> 'facturada'
    or (fuente_canon = 'comprobante' and fuente_seguro in ('comprobante','no_aplica') and fuente_otros in ('comprobante','no_aplica'))),
  add constraint pasivo_cuotas_proyectada_sin_comprobante check (
    estado <> 'proyectada' or 'comprobante' not in (fuente_canon, fuente_seguro, fuente_otros)),
  add constraint pasivo_cuotas_pagada_facturada check (not pagada or estado = 'facturada'),
  add constraint pasivo_cuotas_fecha_pago_de_pagada check (fecha_pago is null or pagada),
  add constraint pasivo_cuotas_ccl_con_fuente check ((ccl_del_dia_pago is null) = (ccl_fuente is null)),
  add constraint pasivo_cuotas_no_aplica_sin_monto check (
    (fuente_seguro <> 'no_aplica' or seguro = 0) and (fuente_otros <> 'no_aplica' or otros_conceptos = 0));

comment on column pasivo_cuotas.estado is
  'facturada = con comprobante de la leasera; proyectada = del cuadro de marcha, todavía sin factura (nunca un hecho, D-139). Sin decir nada, proyectada';
comment on column pasivo_cuotas.periodo is
  'Mes del canon (día 1): el canon del mes M vence el día 1 de M+1. null si la planilla no lo trae';
comment on column pasivo_cuotas.fuente_canon is
  'De dónde sale el canon: comprobante (factura), contrato, a_confirmar (la planilla dice CONFIRMAR) o supuesto (dice SUPUESTO)';
comment on column pasivo_cuotas.fuente_seguro is
  'De dónde sale el seguro: comprobante, contrato, a_confirmar, supuesto o no_aplica (la planilla dice n/a; el monto es 0)';
comment on column pasivo_cuotas.fuente_otros is
  'De dónde sale la percepción de IVA RG 3337: comprobante, contrato, a_confirmar, supuesto o no_aplica (la planilla dice n/a; el monto es 0)';
comment on column pasivo_cuotas.pagada is
  'Si la cuota está pagada (D-140). Puede estarlo sin fecha: el débito automático no la trae en la planilla. Solo una facturada puede estar pagada';
comment on column pasivo_cuotas.ccl_fuente is
  'De dónde salió el CCL del día del pago. Va junto con ccl_del_dia_pago: los dos o ninguno';
comment on column pasivo_cuotas.pagador is
  'Quién pagó esta cuota (titular o empresa), si no es el pagador habitual del contrato; null = el habitual';
comment on column pasivo_cuotas.notas is
  'Nota libre de la cuota, hasta 500 caracteres';
comment on column pasivo_cuotas.seguro is
  'Seguro NETO de IVA, como lo factura la leasera (su IVA va en iva_canon). Antes decía bruto: la tabla estaba vacía (D-142)';
comment on column pasivo_cuotas.iva_canon is
  'IVA facturado de la cuota, sobre canon y seguro, como factura la leasera (D-142)';
comment on column pasivo_cuotas.otros_conceptos is
  'Percepción de IVA RG 3337 y otros conceptos facturados dentro de la cuota (D-142). Un 0 de comprobante es un cero real';
comment on column pasivo_cuotas.fecha_pago is
  'Fecha del pago, si se sabe. null no quiere decir impaga (eso lo dice pagada, D-140): una pagada sin fecha es "fecha sin dato"';

-- ═════════════════════════ pasivos ═════════════════════════

alter table pasivos
  add column pagador_habitual text
    constraint pasivos_pagador_habitual_check check (pagador_habitual is null or pagador_habitual in ('titular','empresa')),
  add column reintegra_iva boolean,
  add column fecha_desembolso date;

comment on column pasivos.pagador_habitual is
  'Quién paga la cuota de costumbre: titular (el dueño, la resta de su ingreso) o empresa. null = sin declarar; Flujo lo necesita';
comment on column pasivos.reintegra_iva is
  '¿La empresa le reintegra al dueño el IVA y la percepción de la cuota? null = sin declarar: nunca se supone un reintegro';
comment on column pasivos.fecha_desembolso is
  'Desde cuándo corre la financiación: la entrega del bien. Con monto_financiado_neto da la tasa implícita del contrato (D-143); nunca se usa fecha_inicio en su lugar';

-- ═════════════════════════ pasivo_cargos ═════════════════════════
-- Cargos fuera de la cuota, cada uno con su fecha, concepto e importe (D-153).
--
-- carga_id no tiene FK a cargas, a propósito: revertir_lote se niega a revertir un lote
-- que tiene filas en una tabla con FK a cargas que no sabe deshacer, y sumarle una tabla
-- a su lista pide reescribirla (D-116). La existencia de la carga la controla un trigger.
-- Revertir el lote deja la fila y marca su carga como revertida: el lector la ignora.
-- Un cargo puntual se anula con anulado_en; nunca se borra.

create table pasivo_cargos (
  id          bigint generated always as identity primary key,
  pasivo_id   smallint not null references pasivos(id),
  fecha       date not null,
  concepto    text not null check (concepto in ('multa','comision','reserva_fondos','interes','otro')),
  detalle     text check (detalle is null or char_length(btrim(detalle)) between 1 and 200),
  importe     numeric not null check (importe > 0 and importe < 'Infinity'),
  cuota_nro   smallint check (cuota_nro is null or cuota_nro > 0),
  fuente      text not null check (fuente in ('comprobante','contrato','a_confirmar','supuesto')),
  anulado_en  timestamptz,
  carga_id    bigint not null,
  notas       text check (notas is null or char_length(btrim(notas)) between 1 and 500)
);
create index pasivo_cargos_pasivo_fecha on pasivo_cargos (pasivo_id, fecha);
create index pasivo_cargos_carga on pasivo_cargos (carga_id);

alter table pasivo_cargos enable row level security;
revoke all on table pasivo_cargos from public, anon, authenticated;
grant select, insert, update on table pasivo_cargos to service_role;
grant usage, select on sequence pasivo_cargos_id_seq to service_role;
create trigger auditar after insert or update on pasivo_cargos for each row execute function registrar_auditoria();

comment on table pasivo_cargos is
  'Cargos del leasing que no son cuota: multas, comisiones, reservas de fondos, intereses (D-153). Son gasto, nunca amortizan la deuda. Se anulan, no se borran';
comment on column pasivo_cargos.id is 'Identificador del cargo';
comment on column pasivo_cargos.pasivo_id is 'El pasivo al que corresponde el cargo';
comment on column pasivo_cargos.fecha is 'Fecha del cargo (la de la planilla o el comprobante)';
comment on column pasivo_cargos.concepto is 'multa, comision, reserva_fondos, interes u otro';
comment on column pasivo_cargos.detalle is 'Cómo lo llama la planilla o el comprobante, hasta 200 caracteres';
comment on column pasivo_cargos.importe is 'Importe en pesos, con IVA si lo lleva';
comment on column pasivo_cargos.cuota_nro is 'La cuota con la que vino, si vino con una';
comment on column pasivo_cargos.fuente is 'comprobante, contrato, a_confirmar o supuesto, como lo marca la planilla';
comment on column pasivo_cargos.anulado_en is 'Cuándo se anuló por un error. Un cargo anulado no cuenta; queda auditado';
comment on column pasivo_cargos.carga_id is
  'Carga que lo grabó. Sin FK a propósito (ver el comentario de la migración): si su carga está revertida, el cargo no cuenta';
comment on column pasivo_cargos.notas is 'Nota libre, hasta 500 caracteres';

-- La carga de un cargo tiene que existir (lo que haría la FK, sin que revertir_lote lo frene).
create function pasivo_cargos_carga_existe() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from cargas where id = new.carga_id) then
    raise exception 'La carga % del cargo no existe', new.carga_id using errcode = '23503';
  end if;
  return new;
end $$;

comment on function pasivo_cargos_carga_existe() is 'Trigger de pasivo_cargos: la carga del cargo tiene que existir';
revoke all on function pasivo_cargos_carga_existe() from public, anon, authenticated;
grant execute on function pasivo_cargos_carga_existe() to service_role;

create trigger carga_existe before insert or update of carga_id on pasivo_cargos
  for each row execute function pasivo_cargos_carga_existe();

-- ═════════════════════════ guardar_cuadro_marcha ═════════════════════════
-- Entrada: {"lote", "fecha", "pasivo_id", "lector": "cuadro-marcha-csv@1" | "manual",
--           "archivo": {"nombre", "sha256", "texto"}   (el CSV entero; obligatorio con el lector del CSV),
--           "cuotas": [{nro, fecha_vencimiento, periodo, canon_neto, iva_canon, seguro, otros_conceptos,
--                       estado, fuente_canon, fuente_seguro, fuente_otros, pagada,
--                       y, si se dicen: fecha_pago, monto_pagado, cuenta_pago_id, ccl_del_dia_pago,
--                       ccl_fuente, pagador, notas, base_ganancias}],
--           "cargos": [{fecha, concepto, detalle, importe, cuota_nro, fuente, notas}]}
-- Crea una carga manual (sin archivo en el bucket, como D-130: el CSV va en la lectura
-- cruda) y hace upsert de cada cuota por (pasivo, nro): lo facturado pisa lo proyectado.
-- Lo que una cuota no dice del pago (la planilla no lo trae) queda como estaba: recargar la
-- planilla no pierde la fecha ni el CCL que cargaste a mano. Rechaza una cuota fuera del
-- contrato, bajar una facturada a proyectada y una pagada que la entrada dice impaga.
-- Los cargos se agregan como filas nuevas de esta carga. No toca pasivos (no tiene
-- carga_id y revertir el lote no lo restauraría). Revertible con revertir_lote.
create function guardar_cuadro_marcha(p jsonb) returns bigint
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_lote      uuid;
  v_fecha     date;
  v_pasivo    bigint;
  v_contrato  record;
  v_lector    text;
  v_archivo   jsonb;
  v_cuotas    jsonb;
  v_cargos    jsonb;
  v_x         jsonb;
  v_n         bigint;
  v_carga     bigint;
  v_nro       bigint;
  v_previa    record;
  v_hay       boolean;
  v_pagada    boolean;
  v_ctx       text;
  v_estado    text;
  v_mensaje   text;
  v_restr     text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'El cuadro de marcha llegó vacío o con otra forma';
  end if;
  if coalesce(p->>'lote', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'El lote no es un identificador válido: %', coalesce(p->>'lote', '(vacío)');
  end if;
  v_lote := (p->>'lote')::uuid;
  v_fecha := leer_fecha(p->'fecha', 'la fecha de la carga');
  if v_fecha is null then
    raise exception 'Falta la fecha de la carga';
  end if;
  v_pasivo := leer_id(p->'pasivo_id', 'el pasivo');
  if v_pasivo is null then
    raise exception 'Falta el pasivo del cuadro de marcha';
  end if;
  select id, nombre, cuotas_totales into v_contrato from pasivos where id = v_pasivo;
  if not found then
    raise exception 'El pasivo #% no existe', v_pasivo;
  end if;
  v_lector := coalesce(nullif(btrim(p->>'lector'), ''), 'manual');
  if v_lector not in ('cuadro-marcha-csv@1', 'manual') then
    raise exception 'Lector desconocido: % (se espera cuadro-marcha-csv@1 o manual)', v_lector;
  end if;

  v_archivo := nullif(p->'archivo', 'null'::jsonb);
  if v_archivo is not null then
    if jsonb_typeof(v_archivo) <> 'object'
       or coalesce(v_archivo->>'sha256', '') !~ '^[0-9a-f]{64}$'
       or coalesce(btrim(v_archivo->>'texto'), '') = '' then
      raise exception 'El archivo del cuadro de marcha llegó incompleto: falta su texto o su sha256';
    end if;
  elsif v_lector = 'cuadro-marcha-csv@1' then
    raise exception 'Falta el archivo del cuadro de marcha (va entero en la lectura cruda de la carga)';
  end if;

  v_cuotas := coalesce(nullif(p->'cuotas', 'null'::jsonb), '[]'::jsonb);
  v_cargos := coalesce(nullif(p->'cargos', 'null'::jsonb), '[]'::jsonb);
  if jsonb_typeof(v_cuotas) <> 'array' or jsonb_typeof(v_cargos) <> 'array' then
    raise exception 'Las cuotas y los cargos tienen que ser listas';
  end if;
  if jsonb_array_length(v_cuotas) + jsonb_array_length(v_cargos) = 0 then
    raise exception 'No hay cuotas ni cargos para grabar';
  end if;
  if exists (select 1 from jsonb_array_elements(v_cuotas) e group by e->>'nro' having count(*) > 1) then
    raise exception 'Una cuota aparece dos veces: %',
      (select string_agg(k, ', ') from (select e->>'nro' as k from jsonb_array_elements(v_cuotas) e
                                         group by e->>'nro' having count(*) > 1) r);
  end if;

  perform pg_advisory_xact_lock(2026100801);

  -- Idempotencia por lote: el mismo Enter (o su reintento) devuelve la misma carga.
  if exists (select 1 from cargas where lote = v_lote) then
    select id into v_carga from cargas
     where lote = v_lote and cuenta_id is null and lector = v_lector and estado <> 'revertida';
    if found and (select count(*) from cargas where lote = v_lote) = 1 then
      return v_carga;
    end if;
    if exists (select 1 from cargas where lote = v_lote and estado = 'revertida') then
      raise exception 'Ese cuadro de marcha se grabó y después se revirtió. Para volver a grabarlo, importalo de nuevo.';
    end if;
    raise exception 'El lote % ya se usó para otra carga', v_lote;
  end if;

  insert into cargas (fecha, cuenta_id, origen, lote, lector, lectura_cruda, grabado)
  values (v_fecha, null, 'manual', v_lote, v_lector,
          case when v_archivo is null then null
               else jsonb_build_object('archivo', coalesce(nullif(btrim(v_archivo->>'nombre'), ''), 'cuadro de marcha'),
                                       'sha256', v_archivo->>'sha256', 'texto', v_archivo->>'texto') end,
          jsonb_strip_nulls(jsonb_build_object(
            'pasivo_id', v_pasivo,
            'pasivo_cuotas', nullif(v_cuotas, '[]'::jsonb),
            'pasivo_cargos', nullif(v_cargos, '[]'::jsonb))))
  returning id into v_carga;

  -- Cuotas: upsert por número; lo facturado pisa lo proyectado, nunca al revés.
  for v_x, v_n in select e.x, e.n from jsonb_array_elements(v_cuotas) with ordinality as e(x, n) order by e.n loop
    if jsonb_typeof(v_x) <> 'object' then
      raise exception 'La cuota % de la lista no tiene forma de cuota', v_n;
    end if;
    v_nro := leer_id(v_x->'nro', format('el número de la cuota %s de la lista', v_n));
    if v_nro is null then
      raise exception 'Falta el número de la cuota % de la lista', v_n;
    end if;
    v_ctx := format('cuota %s de %s', v_nro, v_contrato.nombre);
    if v_nro > v_contrato.cuotas_totales then
      raise exception 'La cuota % no existe: el contrato de % tiene % cuotas', v_nro, v_contrato.nombre, v_contrato.cuotas_totales;
    end if;
    if jsonb_typeof(coalesce(v_x->'pagada', 'null'::jsonb)) <> 'boolean' then
      raise exception 'Falta decir si la cuota % está pagada (sí o no)', v_nro;
    end if;
    v_pagada := (v_x->>'pagada')::boolean;

    select * into v_previa from pasivo_cuotas where pasivo_id = v_pasivo and nro = v_nro for update;
    v_hay := found;
    if v_hay and v_previa.estado = 'facturada' and v_x->>'estado' = 'proyectada' then
      raise exception 'La cuota % ya tiene factura: corregila desde su fila', v_nro;
    end if;
    if v_hay and v_previa.pagada and not v_pagada then
      raise exception 'La cuota % figura pagada y lo que grabás dice que no: corregila desde su fila', v_nro;
    end if;

    begin
      insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, periodo, canon_neto, iva_canon, seguro,
                                 otros_conceptos, base_ganancias, estado, fuente_canon, fuente_seguro, fuente_otros,
                                 pagada, fecha_pago, monto_pagado, cuenta_pago_id, ccl_del_dia_pago, ccl_fuente,
                                 pagador, notas, carga_id)
      values (v_pasivo, v_nro,
              leer_fecha(v_x->'fecha_vencimiento', v_ctx || ', vencimiento'),
              leer_fecha(v_x->'periodo', v_ctx || ', mes del canon'),
              leer_monto(v_x->'canon_neto', v_ctx || ', canon'),
              coalesce(leer_monto(v_x->'iva_canon', v_ctx || ', IVA'), 0),
              coalesce(leer_monto(v_x->'seguro', v_ctx || ', seguro'), 0),
              coalesce(leer_monto(v_x->'otros_conceptos', v_ctx || ', percepción'), 0),
              case when v_x ? 'base_ganancias' then leer_monto(v_x->'base_ganancias', v_ctx || ', base de Ganancias')
                   when v_hay then v_previa.base_ganancias end,
              nullif(btrim(v_x->>'estado'), ''),
              nullif(btrim(v_x->>'fuente_canon'), ''),
              nullif(btrim(v_x->>'fuente_seguro'), ''),
              nullif(btrim(v_x->>'fuente_otros'), ''),
              v_pagada,
              case when v_x ? 'fecha_pago' then leer_fecha(v_x->'fecha_pago', v_ctx || ', fecha de pago')
                   when v_hay then v_previa.fecha_pago end,
              case when v_x ? 'monto_pagado' then leer_monto(v_x->'monto_pagado', v_ctx || ', monto pagado')
                   when v_hay then v_previa.monto_pagado end,
              case when v_x ? 'cuenta_pago_id' then leer_id(v_x->'cuenta_pago_id', v_ctx || ', cuenta del pago')
                   when v_hay then v_previa.cuenta_pago_id end,
              case when v_x ? 'ccl_del_dia_pago' then leer_monto(v_x->'ccl_del_dia_pago', v_ctx || ', CCL del pago')
                   when v_hay then v_previa.ccl_del_dia_pago end,
              case when v_x ? 'ccl_fuente' then nullif(btrim(v_x->>'ccl_fuente'), '')
                   when v_hay then v_previa.ccl_fuente end,
              case when v_x ? 'pagador' then nullif(btrim(v_x->>'pagador'), '')
                   when v_hay then v_previa.pagador end,
              case when v_x ? 'notas' then nullif(btrim(v_x->>'notas'), '')
                   when v_hay then v_previa.notas end,
              v_carga)
      on conflict (pasivo_id, nro) do update
        set fecha_vencimiento = excluded.fecha_vencimiento, periodo = excluded.periodo,
            canon_neto = excluded.canon_neto, iva_canon = excluded.iva_canon, seguro = excluded.seguro,
            otros_conceptos = excluded.otros_conceptos, base_ganancias = excluded.base_ganancias,
            estado = excluded.estado, fuente_canon = excluded.fuente_canon, fuente_seguro = excluded.fuente_seguro,
            fuente_otros = excluded.fuente_otros, pagada = excluded.pagada, fecha_pago = excluded.fecha_pago,
            monto_pagado = excluded.monto_pagado, cuenta_pago_id = excluded.cuenta_pago_id,
            ccl_del_dia_pago = excluded.ccl_del_dia_pago, ccl_fuente = excluded.ccl_fuente,
            pagador = excluded.pagador, notas = excluded.notas, carga_id = excluded.carga_id;
    exception when others then
      get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text,
                              v_restr = constraint_name;
      if v_estado = 'P0001' then raise; end if;
      raise exception using errcode = v_estado, message = v_mensaje, constraint = v_restr, detail = v_ctx;
    end;
  end loop;

  -- Cargos extra: filas nuevas de esta carga. Los de la planilla anterior quedan con la suya.
  for v_x, v_n in select e.x, e.n from jsonb_array_elements(v_cargos) with ordinality as e(x, n) order by e.n loop
    if jsonb_typeof(v_x) <> 'object' then
      raise exception 'El cargo % de la lista no tiene forma de cargo', v_n;
    end if;
    v_ctx := format('cargo %s (%s) de %s', v_n, coalesce(v_x->>'concepto', 'sin concepto'), v_contrato.nombre);
    begin
      insert into pasivo_cargos (pasivo_id, fecha, concepto, detalle, importe, cuota_nro, fuente, carga_id, notas)
      values (v_pasivo,
              leer_fecha(v_x->'fecha', v_ctx || ', fecha'),
              nullif(btrim(v_x->>'concepto'), ''),
              nullif(btrim(v_x->>'detalle'), ''),
              leer_monto(v_x->'importe', v_ctx || ', importe'),
              leer_id(v_x->'cuota_nro', v_ctx || ', cuota'),
              nullif(btrim(v_x->>'fuente'), ''),
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

comment on function guardar_cuadro_marcha(jsonb) is
  'Graba el cuadro de marcha de un pasivo (o una cuota, o un cargo) con una carga manual: upsert por número de cuota, lo facturado pisa lo proyectado. Idempotente por lote; revertible con revertir_lote';
revoke all on function guardar_cuadro_marcha(jsonb) from public, anon, authenticated;
grant execute on function guardar_cuadro_marcha(jsonb) to service_role;
