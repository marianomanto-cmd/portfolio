-- Casos del schema de Pasivos (entrega 4, migración 20261015124724_pasivos_cuadro_marcha).
-- Cuadro de marcha: checks de pasivo_cuotas, pasivo_cargos, guardar_cuadro_marcha
-- (idempotente, upsert, lo facturado pisa lo proyectado y nunca al revés) y revertir_lote
-- (restaura cada versión anterior). Números inventados (D-24). Deja la base como la
-- encontró: revierte cada lote que carga; el pasivo de prueba es propio.
\set ON_ERROR_STOP 0
\pset pager off

create or replace function pg_temp.espera_error(sql text, etiqueta text) returns text language plpgsql as $$
begin
  execute sql;
  return 'FALLA  (debía rechazar) ' || etiqueta;
exception when others then
  return 'ok     rechaza: ' || etiqueta || '  [' || sqlstate || ']';
end $$;

create or replace function pg_temp.espera_ok(sql text, etiqueta text) returns text language plpgsql as $$
begin
  execute sql;
  return 'ok     acepta:  ' || etiqueta;
exception when others then
  return 'FALLA  (debía aceptar) ' || etiqueta || ': ' || sqlerrm;
end $$;

create or replace function pg_temp.espera(cond boolean, etiqueta text) returns text language sql as $$
  select case when coalesce(cond, false) then 'ok     cumple:  ' || etiqueta
              else 'FALLA  (no cumple) ' || etiqueta end
$$;

create or replace function pg_temp.espera_error_por(sql text, patron text, etiqueta text) returns text language plpgsql as $$
begin
  execute sql;
  return 'FALLA  (debía rechazar) ' || etiqueta;
exception when others then
  if sqlerrm ~* patron or sqlstate = patron then
    return 'ok     rechaza: ' || etiqueta || '  [' || sqlstate || ']';
  end if;
  return 'FALLA  (rechazó por otro motivo) ' || etiqueta || ': [' || sqlstate || '] ' || sqlerrm;
end $$;

-- El pasivo de prueba (propio de este archivo) y su id.
insert into pasivos (nombre, tipo, moneda, fecha_inicio, cuotas_totales)
values ('Leasing de prueba de Pasivos', 'leasing', 'ARS', '2025-08-01', 4);
select id as pc from pasivos where nombre = 'Leasing de prueba de Pasivos' \gset

-- Huella de las cuotas y los cargos visibles de este pasivo (revertir tiene que dejarla igual).
create or replace function pg_temp.huella_pasivo(p bigint) returns text language sql as $$
  select md5(concat_ws('#',
    (select string_agg(t::text, '|' order by t.nro) from pasivo_cuotas t where t.pasivo_id = p),
    (select string_agg(c.concepto || ':' || c.importe::text, '|' order by c.id)
       from pasivo_cargos c join cargas g on g.id = c.carga_id
      where c.pasivo_id = p and g.estado <> 'revertida' and c.anulado_en is null)))
$$;
select pg_temp.huella_pasivo(:pc) as huella_inicial \gset

-- ── Permisos ──
select pg_temp.espera(bool_and(not has_function_privilege('anon', p.oid, 'execute')
                             and not has_function_privilege('authenticated', p.oid, 'execute')
                             and has_function_privilege('service_role', p.oid, 'execute')
                             and not p.prosecdef and p.proconfig is not null),
                      'pasivos: solo service_role ejecuta las funciones nuevas, security invoker y search_path fijo (' || count(*) || ')')
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname in ('guardar_cuadro_marcha', 'pasivo_cargos_carga_existe');
select pg_temp.espera(not has_table_privilege('service_role', 'pasivo_cargos', 'delete')
                      and not has_table_privilege('service_role', 'pasivo_cargos', 'truncate')
                      and has_table_privilege('service_role', 'pasivo_cargos', 'insert')
                      and not has_table_privilege('anon', 'pasivo_cargos', 'select')
                      and not has_table_privilege('authenticated', 'pasivo_cargos', 'select'),
                      'pasivo_cargos: el servidor lee, agrega y anula; no borra; anon y authenticated no la ven');
select pg_temp.espera((select relrowsecurity from pg_class where oid = 'public.pasivo_cargos'::regclass)
                      and exists (select 1 from pg_trigger where tgrelid = 'public.pasivo_cargos'::regclass and tgname = 'auditar'),
                      'pasivo_cargos: RLS y auditoría');
select pg_temp.espera(not exists (select 1 from pg_constraint where conrelid = 'public.pasivo_cargos'::regclass
                                                          and contype = 'f' and confrelid = 'public.cargas'::regclass),
                      'pasivo_cargos: sin FK a cargas (revertir_lote no se frena por sus filas)');
set role anon;
select pg_temp.espera_error_por($$select guardar_cuadro_marcha('{}')$$, '42501', 'anon ejecuta guardar_cuadro_marcha');
reset role;
set role authenticated;
select pg_temp.espera_error_por($$select guardar_cuadro_marcha('{}')$$, '42501', 'authenticated ejecuta guardar_cuadro_marcha');
reset role;

set role service_role;

-- ── Checks de pasivo_cuotas, con una carga propia (se revierte al final) ──
insert into cargas (fecha, origen, lote, lector) values ('2026-10-15', 'manual', 'c0000000-0000-4000-8000-0000000000c0', 'manual');
select id as k0 from cargas where lote = 'c0000000-0000-4000-8000-0000000000c0' \gset
select pg_temp.espera_ok(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, carga_id) values (%s, 1, '2025-09-01', 1000, %s)$$, :pc, :k0),
  'cuota sin decir estado ni fuentes');
select pg_temp.espera(estado = 'proyectada' and fuente_canon = 'contrato' and fuente_seguro = 'contrato' and fuente_otros = 'contrato' and not pagada,
                      'sin decir nada, la cuota es proyectada, de contrato e impaga (nunca un hecho por omisión)')
from pasivo_cuotas where pasivo_id = :pc and nro = 1;
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, estado, carga_id) values (%s, 2, '2025-10-01', 1000, 'facturada', %s)$$, :pc, :k0),
  'pasivo_cuotas_facturada_con_comprobante', 'una facturada con el canon de contrato');
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, estado, fuente_canon, fuente_seguro, fuente_otros, carga_id) values (%s, 2, '2025-10-01', 1000, 'facturada', 'comprobante', 'a_confirmar', 'comprobante', %s)$$, :pc, :k0),
  'pasivo_cuotas_facturada_con_comprobante', 'una facturada con el seguro a confirmar');
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, estado, fuente_canon, carga_id) values (%s, 2, '2025-10-01', 1000, 'proyectada', 'comprobante', %s)$$, :pc, :k0),
  'pasivo_cuotas_proyectada_sin_comprobante', 'una proyectada con comprobante');
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, pagada, carga_id) values (%s, 2, '2025-10-01', 1000, true, %s)$$, :pc, :k0),
  'pasivo_cuotas_pagada_facturada', 'una proyectada pagada');
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, fecha_pago, carga_id) values (%s, 2, '2025-10-01', 1000, '2025-10-01', %s)$$, :pc, :k0),
  'pasivo_cuotas_fecha_pago_de_pagada', 'una fecha de pago en una cuota impaga');
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, estado, fuente_canon, fuente_seguro, fuente_otros, pagada, fecha_pago, ccl_del_dia_pago, carga_id) values (%s, 2, '2025-10-01', 1000, 'facturada', 'comprobante', 'comprobante', 'comprobante', true, '2025-10-01', 1300, %s)$$, :pc, :k0),
  'pasivo_cuotas_ccl_con_fuente', 'un CCL del pago sin su fuente');
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, otros_conceptos, fuente_otros, carga_id) values (%s, 2, '2025-10-01', 1000, 50, 'no_aplica', %s)$$, :pc, :k0),
  'pasivo_cuotas_no_aplica_sin_monto', 'n/a con un monto');
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, periodo, canon_neto, carga_id) values (%s, 2, '2025-10-01', '2025-09-15', 1000, %s)$$, :pc, :k0),
  'pasivo_cuotas_periodo_check', 'un mes del canon que no es día 1');
select pg_temp.espera_error_por(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, fuente_canon, carga_id) values (%s, 2, '2025-10-01', 1000, 'no_aplica', %s)$$, :pc, :k0),
  'pasivo_cuotas_fuente_canon_check', 'un canon n/a');
select pg_temp.espera_ok(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, otros_conceptos, estado, fuente_canon, fuente_seguro, fuente_otros, pagada, carga_id) values (%s, 2, '2025-10-01', 1000, 0, 'facturada', 'comprobante', 'comprobante', 'comprobante', true, %s)$$, :pc, :k0),
  'pagada · fecha sin dato, con percepción 0 de comprobante (un cero real)');
select pg_temp.espera_ok(format($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, estado, fuente_canon, fuente_seguro, fuente_otros, pagada, fecha_pago, ccl_del_dia_pago, ccl_fuente, carga_id) values (%s, 3, '2025-11-01', 1000, 'facturada', 'comprobante', 'comprobante', 'no_aplica', true, '2025-11-01', 1350.5, 'Ámbito, cierre', %s)$$, :pc, :k0),
  'pagada con fecha, CCL y su fuente');
select pg_temp.espera_error_por(format($$update pasivos set pagador_habitual = 'socio' where id = %s$$, :pc), 'pasivos_pagador_habitual_check', 'un pagador habitual que no existe');
select pg_temp.espera_ok(format($$update pasivos set pagador_habitual = 'titular', reintegra_iva = null, fecha_desembolso = '2025-07-25' where id = %s$$, :pc),
  'pagador, reintegro sin declarar y fecha de desembolso del contrato');

-- ── pasivo_cargos ──
select pg_temp.espera_error_por(format($$insert into pasivo_cargos (pasivo_id, fecha, concepto, importe, fuente, carga_id) values (%s, '2026-01-10', 'multa', 5000, 'comprobante', 999999)$$, :pc),
  '23503', 'un cargo con una carga que no existe');
select pg_temp.espera_error_por(format($$insert into pasivo_cargos (pasivo_id, fecha, concepto, importe, fuente, carga_id) values (%s, '2026-01-10', 'propina', 5000, 'comprobante', %s)$$, :pc, :k0),
  'pasivo_cargos_concepto_check', 'un concepto que no existe');
select pg_temp.espera_error_por(format($$insert into pasivo_cargos (pasivo_id, fecha, concepto, importe, fuente, carga_id) values (%s, '2026-01-10', 'multa', 0, 'comprobante', %s)$$, :pc, :k0),
  'pasivo_cargos_importe_check', 'un cargo de $ 0');
select pg_temp.espera_error_por(format($$insert into pasivo_cargos (pasivo_id, fecha, concepto, importe, fuente, carga_id) values (%s, '2026-01-10', 'multa', 5000, 'no_aplica', %s)$$, :pc, :k0),
  'pasivo_cargos_fuente_check', 'un cargo n/a');
select pg_temp.espera_error_por($$truncate pasivo_cargos$$, '42501', 'service_role trunca pasivo_cargos');

-- Se revierte la carga de los checks: sus cuotas desaparecen.
select pg_temp.espera_ok($$select revertir_lote('c0000000-0000-4000-8000-0000000000c0', 'casos de pasivos: checks')$$, 'revertir la carga de los checks');
select pg_temp.espera(pg_temp.huella_pasivo(:pc) = :'huella_inicial', 'revertir la carga de los checks deja las cuotas como estaban');

-- ── guardar_cuadro_marcha: lote A, la planilla con dos pagadas, una proyectada y un cargo ──
select pg_temp.espera_ok(format($$select guardar_cuadro_marcha('{
  "lote": "c0000000-0000-4000-8000-0000000000a1", "fecha": "2026-10-15", "pasivo_id": %s, "lector": "cuadro-marcha-csv@1",
  "archivo": {"nombre": "cuadro.csv", "sha256": "%s", "texto": "nro_cuota,...\n1,2025-09-01,..."},
  "cuotas": [
    {"nro": 1, "fecha_vencimiento": "2025-09-01", "periodo": "2025-08-01", "canon_neto": "1000000.00", "seguro": "80000.00",
     "iva_canon": "226800.00", "otros_conceptos": "32400.00", "estado": "facturada", "fuente_canon": "comprobante",
     "fuente_seguro": "comprobante", "fuente_otros": "comprobante", "pagada": true},
    {"nro": 2, "fecha_vencimiento": "2025-10-01", "periodo": "2025-09-01", "canon_neto": "1000000.00", "seguro": "80000.00",
     "iva_canon": "226800.00", "otros_conceptos": "0.00", "estado": "facturada", "fuente_canon": "comprobante",
     "fuente_seguro": "comprobante", "fuente_otros": "comprobante", "pagada": true},
    {"nro": 3, "fecha_vencimiento": "2025-11-01", "periodo": "2025-10-01", "canon_neto": "1000000.00", "seguro": "60000.00",
     "iva_canon": "222600.00", "otros_conceptos": "31800.00", "estado": "proyectada", "fuente_canon": "contrato",
     "fuente_seguro": "a_confirmar", "fuente_otros": "supuesto", "pagada": false}],
  "cargos": [{"fecha": "2025-10-05", "concepto": "multa", "detalle": "Multa por mora", "importe": "15000.00", "cuota_nro": 2, "fuente": "comprobante"}]}')$$,
  :pc, repeat('a', 64)), 'guardar_cuadro_marcha: la planilla (lote A)');
select id as ka from cargas where lote = 'c0000000-0000-4000-8000-0000000000a1' \gset
select pg_temp.espera(origen = 'manual' and lector = 'cuadro-marcha-csv@1' and archivo_path is null and cuenta_id is null
                      and lectura_cruda->>'sha256' = repeat('a', 64) and lectura_cruda->>'texto' like 'nro_cuota%'
                      and jsonb_array_length(grabado->'pasivo_cuotas') = 3 and jsonb_array_length(grabado->'pasivo_cargos') = 1,
                      'guardar_cuadro_marcha: una carga manual, sin archivo en el bucket, con el CSV entero en la lectura cruda')
from cargas where id = :ka;
select pg_temp.espera(count(*) = 3 and bool_and(carga_id = :ka)
                      and sum(total_pesos)::text = '3960400.00'
                      and count(*) filter (where pagada and fecha_pago is null) = 2
                      and min(otros_conceptos::text) filter (where nro = 2) = '0.00'
                      and min(fuente_seguro) filter (where nro = 3) = 'a_confirmar' and min(fuente_otros) filter (where nro = 3) = 'supuesto',
                      'guardar_cuadro_marcha: montos exactos, pagadas sin fecha, la percepción 0 de comprobante y las fuentes por campo')
from pasivo_cuotas where pasivo_id = :pc;
select pg_temp.espera(count(*) = 1 and min(importe)::text = '15000.00' and min(cuota_nro) = 2 and min(carga_id) = :ka,
                      'guardar_cuadro_marcha: el cargo extra va a pasivo_cargos con la carga del lote')
from pasivo_cargos where pasivo_id = :pc;
select pg_temp.huella_pasivo(:pc) as huella_a \gset
select count(*) as auditoria_a from auditoria \gset

-- El mismo lote otra vez (doble Enter): la misma carga, nada nuevo.
select pg_temp.espera(guardar_cuadro_marcha(format('{"lote": "c0000000-0000-4000-8000-0000000000a1", "fecha": "2026-10-15", "pasivo_id": %s,
  "lector": "cuadro-marcha-csv@1", "archivo": {"nombre": "cuadro.csv", "sha256": "%s", "texto": "x"},
  "cuotas": [{"nro": 1, "pagada": true}]}', :pc, repeat('a', 64))::jsonb) = :ka
  and pg_temp.huella_pasivo(:pc) = :'huella_a' and (select count(*) from auditoria) = :auditoria_a,
  'guardar_cuadro_marcha: idempotente por lote (devuelve la misma carga y no escribe)');

-- ── Lote B: "Registrar pago" de la cuota 1, desde el formulario (lector manual) ──
select pg_temp.espera_ok(format($$select guardar_cuadro_marcha('{
  "lote": "c0000000-0000-4000-8000-0000000000b1", "fecha": "2026-10-15", "pasivo_id": %s, "lector": "manual",
  "cuotas": [{"nro": 1, "fecha_vencimiento": "2025-09-01", "periodo": "2025-08-01", "canon_neto": "1000000.00", "seguro": "80000.00",
     "iva_canon": "226800.00", "otros_conceptos": "32400.00", "estado": "facturada", "fuente_canon": "comprobante",
     "fuente_seguro": "comprobante", "fuente_otros": "comprobante", "pagada": true,
     "fecha_pago": "2025-09-01", "ccl_del_dia_pago": "1350.25", "ccl_fuente": "Ámbito, cierre", "pagador": "titular"}]}')$$, :pc),
  'guardar_cuadro_marcha: registrar el pago de la cuota 1 (lote B)');
select id as kb from cargas where lote = 'c0000000-0000-4000-8000-0000000000b1' \gset
select pg_temp.espera(fecha_pago = '2025-09-01' and ccl_del_dia_pago::text = '1350.25' and pagador = 'titular' and carga_id = :kb,
                      'guardar_cuadro_marcha: la cuota 1 con su fecha, CCL y pagador')
from pasivo_cuotas where pasivo_id = :pc and nro = 1;

-- ── Lote C: la planilla actualizada; la 3 ya facturada y pagada; no trae los datos del pago ──
select pg_temp.espera_ok(format($$select guardar_cuadro_marcha('{
  "lote": "c0000000-0000-4000-8000-0000000000c1", "fecha": "2026-10-16", "pasivo_id": %s, "lector": "cuadro-marcha-csv@1",
  "archivo": {"nombre": "cuadro-2.csv", "sha256": "%s", "texto": "nro_cuota,...\n3,2025-11-01,..."},
  "cuotas": [
    {"nro": 1, "fecha_vencimiento": "2025-09-01", "periodo": "2025-08-01", "canon_neto": "1000000.00", "seguro": "80000.00",
     "iva_canon": "226800.00", "otros_conceptos": "32400.00", "estado": "facturada", "fuente_canon": "comprobante",
     "fuente_seguro": "comprobante", "fuente_otros": "comprobante", "pagada": true},
    {"nro": 3, "fecha_vencimiento": "2025-11-01", "periodo": "2025-10-01", "canon_neto": "1000000.00", "seguro": "70000.00",
     "iva_canon": "224700.00", "otros_conceptos": "32100.00", "estado": "facturada", "fuente_canon": "comprobante",
     "fuente_seguro": "comprobante", "fuente_otros": "comprobante", "pagada": true}],
  "cargos": [{"fecha": "2025-10-05", "concepto": "multa", "detalle": "Multa por mora", "importe": "15000.00", "cuota_nro": 2, "fuente": "comprobante"},
             {"fecha": "2025-11-03", "concepto": "comision", "importe": "8000.00", "fuente": "comprobante"}]}')$$, :pc, repeat('b', 64)),
  'guardar_cuadro_marcha: la planilla actualizada (lote C)');
select id as kc from cargas where lote = 'c0000000-0000-4000-8000-0000000000c1' \gset
select pg_temp.espera(fecha_pago = '2025-09-01' and ccl_del_dia_pago::text = '1350.25' and ccl_fuente = 'Ámbito, cierre' and pagador = 'titular' and carga_id = :kc,
                      'upsert: recargar la planilla no pierde la fecha, el CCL ni el pagador que cargaste a mano')
from pasivo_cuotas where pasivo_id = :pc and nro = 1;
select pg_temp.espera(estado = 'facturada' and pagada and seguro::text = '70000.00' and fuente_otros = 'comprobante' and carga_id = :kc,
                      'upsert: lo facturado pisa lo proyectado')
from pasivo_cuotas where pasivo_id = :pc and nro = 3;
select pg_temp.espera((select count(*) from pasivo_cuotas where pasivo_id = :pc) = 3, 'upsert: no duplica cuotas');

-- ── Lo que no se puede ──
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "manual", "cuotas": [{"nro": 3, "fecha_vencimiento": "2025-11-01", "canon_neto": "1000000", "estado": "proyectada",
  "fuente_canon": "contrato", "fuente_seguro": "supuesto", "fuente_otros": "supuesto", "pagada": false}]}')$$, :pc),
  'ya tiene factura', 'guardar_cuadro_marcha: bajar una facturada a proyectada');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "manual", "cuotas": [{"nro": 3, "fecha_vencimiento": "2025-11-01", "canon_neto": "1000000", "estado": "facturada",
  "fuente_canon": "comprobante", "fuente_seguro": "comprobante", "fuente_otros": "comprobante", "pagada": false}]}')$$, :pc),
  'figura pagada', 'guardar_cuadro_marcha: pasar a impaga una pagada');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "manual", "cuotas": [{"nro": 5, "fecha_vencimiento": "2026-01-01", "canon_neto": "1000000", "estado": "proyectada",
  "fuente_canon": "contrato", "fuente_seguro": "contrato", "fuente_otros": "contrato", "pagada": false}]}')$$, :pc),
  'tiene 4 cuotas', 'guardar_cuadro_marcha: una cuota fuera del contrato');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "manual", "cuotas": [{"nro": 4, "fecha_vencimiento": "2025-12-01", "canon_neto": "1000000", "estado": "proyectada",
  "fuente_canon": "contrato", "fuente_seguro": "contrato", "fuente_otros": "contrato", "pagada": true}]}')$$, :pc),
  'pasivo_cuotas_pagada_facturada', 'guardar_cuadro_marcha: una proyectada pagada');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "manual", "cuotas": [{"nro": 4, "fecha_vencimiento": "2025-12-01", "canon_neto": "1000000", "estado": "proyectada",
  "fuente_canon": "contrato", "fuente_seguro": "contrato", "fuente_otros": "contrato", "pagada": "no"}]}')$$, :pc),
  'está pagada', 'guardar_cuadro_marcha: "pagada" que no es sí o no');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "manual", "cuotas": [{"nro": 4, "fecha_vencimiento": "2025-12-01", "canon_neto": 1000000.5, "estado": "proyectada",
  "fuente_canon": "contrato", "fuente_seguro": "contrato", "fuente_otros": "contrato", "pagada": false}]}')$$, :pc),
  'viajan como texto', 'guardar_cuadro_marcha: un monto como número JSON (D-32)');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "cuadro-marcha-csv@1", "cuotas": [{"nro": 4, "fecha_vencimiento": "2025-12-01", "canon_neto": "1", "estado": "proyectada",
  "fuente_canon": "contrato", "fuente_seguro": "contrato", "fuente_otros": "contrato", "pagada": false}]}')$$, :pc),
  'Falta el archivo', 'guardar_cuadro_marcha: el lector del CSV sin el archivo');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "manual", "cuotas": [{"nro": 4, "pagada": false}, {"nro": 4, "pagada": false}]}')$$, :pc),
  'dos veces', 'guardar_cuadro_marcha: la misma cuota dos veces');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": %s, "lector": "manual", "cargos": [{"fecha": "2025-12-01", "concepto": "propina", "importe": "10", "fuente": "comprobante"}]}')$$, :pc),
  'pasivo_cargos_concepto_check', 'guardar_cuadro_marcha: un cargo con un concepto que no existe');
select pg_temp.espera_error_por($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000d1", "fecha": "2026-10-16",
  "pasivo_id": 32000, "lector": "manual", "cuotas": [{"nro": 1, "pagada": false}]}')$$,
  'no existe', 'guardar_cuadro_marcha: un pasivo que no existe');
select pg_temp.espera(not exists (select 1 from cargas where lote = 'c0000000-0000-4000-8000-0000000000d1'),
                      'guardar_cuadro_marcha: un error no deja ninguna carga');

-- ── Revertir: cada lote restaura lo que pisó ──
-- C: la cuota 1 vuelve a la versión de B (con su pago) y la 3 a la proyectada de A; los cargos de C dejan de contar.
select pg_temp.espera_ok($$select revertir_lote('c0000000-0000-4000-8000-0000000000c1', 'casos de pasivos: planilla equivocada')$$,
  'revertir_lote: la planilla actualizada (C), con cargos en pasivo_cargos');
select pg_temp.espera(fecha_pago = '2025-09-01' and ccl_del_dia_pago::text = '1350.25' and carga_id = :kb,
                      'revertir C: la cuota 1 vuelve a la versión de B')
from pasivo_cuotas where pasivo_id = :pc and nro = 1;
select pg_temp.espera(estado = 'proyectada' and not pagada and seguro::text = '60000.00' and fuente_seguro = 'a_confirmar' and carga_id = :ka,
                      'revertir C: la cuota 3 vuelve a la proyectada de A')
from pasivo_cuotas where pasivo_id = :pc and nro = 3;
select pg_temp.espera((select count(*) from pasivo_cargos c join cargas g on g.id = c.carga_id
                        where c.pasivo_id = :pc and g.estado <> 'revertida' and c.anulado_en is null) = 1,
                      'revertir C: sus cargos quedan con la carga revertida y no cuentan; el de A sí');
-- B: la cuota 1 vuelve a la de A (sin pago). A: no queda nada.
select pg_temp.espera_ok($$select revertir_lote('c0000000-0000-4000-8000-0000000000b1', 'casos de pasivos: pago equivocado')$$, 'revertir_lote: el pago (B)');
select pg_temp.espera(fecha_pago is null and ccl_del_dia_pago is null and pagada and carga_id = :ka,
                      'revertir B: la cuota 1 vuelve a la versión de A, pagada y sin fecha')
from pasivo_cuotas where pasivo_id = :pc and nro = 1;
select pg_temp.espera(pg_temp.huella_pasivo(:pc) = :'huella_a', 'revertir C y B deja el cuadro como lo dejó A');
select pg_temp.espera_ok($$select revertir_lote('c0000000-0000-4000-8000-0000000000a1', 'casos de pasivos: fin')$$, 'revertir_lote: la planilla (A)');
select pg_temp.espera(pg_temp.huella_pasivo(:pc) = :'huella_inicial'
                      and not exists (select 1 from pasivo_cuotas where pasivo_id = :pc),
                      'revertir A deja las cuotas y los cargos visibles como estaban antes de este archivo');
select pg_temp.espera_error_por(format($$select guardar_cuadro_marcha('{"lote": "c0000000-0000-4000-8000-0000000000a1", "fecha": "2026-10-15",
  "pasivo_id": %s, "lector": "cuadro-marcha-csv@1", "archivo": {"nombre": "c.csv", "sha256": "%s", "texto": "x"},
  "cuotas": [{"nro": 1, "pagada": false}]}')$$, :pc, repeat('a', 64)),
  'se revirtió', 'guardar_cuadro_marcha: un lote revertido no se vuelve a usar');

-- Anular un cargo (update de anulado_en) queda auditado; nunca se borra.
insert into cargas (fecha, origen, lote, lector) values ('2026-10-17', 'manual', 'c0000000-0000-4000-8000-0000000000e1', 'manual');
select id as ke from cargas where lote = 'c0000000-0000-4000-8000-0000000000e1' \gset
select pg_temp.espera_ok(format($$insert into pasivo_cargos (pasivo_id, fecha, concepto, importe, fuente, carga_id) values (%s, '2026-01-10', 'otro', 100, 'supuesto', %s)$$, :pc, :ke),
  'un cargo a mano');
select pg_temp.espera_ok(format($$update pasivo_cargos set anulado_en = now() where carga_id = %s$$, :ke), 'anular un cargo');
select pg_temp.espera(exists (select 1 from auditoria where tabla = 'pasivo_cargos' and operacion = 'UPDATE' and carga_id = :ke),
                      'anular un cargo queda en la auditoría');
select pg_temp.espera_ok($$select revertir_lote('c0000000-0000-4000-8000-0000000000e1', 'casos de pasivos: cargo a mano')$$,
  'revertir_lote: una carga con solo un cargo (sin FK, no se frena)');
reset role;
