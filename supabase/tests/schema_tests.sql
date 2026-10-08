-- Tests del schema. Cada caso espera éxito o rechazo; el runner falla si alguno
-- imprime FALLA. Números inventados (D-24).
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

-- Datos base
select 'cuentas sembradas: ' || string_agg(nombre, ', ' order by id) from cuentas;
insert into activos (ticker, nombre, tipo, moneda_riesgo, geografia, ticker_subyacente) values ('SPY','CEDEAR SPDR S&P 500','cedear','USD','US','SPY');
insert into activos (ticker, nombre, tipo, moneda_riesgo, geografia, indexacion) values ('T30J7','BONCAP 30/06/27','bono','ARS','AR','fija');
insert into cargas (fecha, cuenta_id, origen, archivo_path, archivo_sha256) values ('2026-10-07', 1, 'excel', '2026/10/' || repeat('a', 64) || '.xlsx', repeat('a', 64));
insert into cargas (fecha, origen) values ('2026-10-07', 'manual');

select pg_temp.espera_ok($$insert into tipo_cambio (fecha, ccl, cripto_venta, carga_id) values ('2026-10-07', 1500, 1450, 2)$$, 'tipo de cambio');
select pg_temp.espera_error($$insert into tipo_cambio (fecha, ccl, carga_id) values ('2026-10-08', 'NaN', 2)$$, 'CCL NaN');
select pg_temp.espera_error($$insert into tipo_cambio (fecha, ccl, carga_id) values ('2026-10-09', 'Infinity', 2)$$, 'CCL Infinity');
select pg_temp.espera_error($$insert into tipo_cambio (fecha, ccl) values ('2026-10-10', 1500)$$, 'tipo de cambio sin carga');
select pg_temp.espera_error($$insert into cotizaciones (fecha, activo_id, precio_pesos, carga_id) values ('2026-10-07', 1, 0, 1)$$, 'precio cero');
select pg_temp.espera_ok($$insert into cotizaciones (fecha, activo_id, precio_pesos, carga_id) values ('2026-10-07', 2, 1.30, 1)$$, 'precio por 1 VN');

-- Operaciones
select pg_temp.espera_ok($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, precio, carga_id) values ('2026-10-07',1,2,'apertura',1000000,1.25,1)$$, 'apertura con PPP y sin CCL');
select pg_temp.espera_error($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, precio, carga_id) values ('2026-10-07',1,2,'apertura',5,1.2,1)$$, 'segunda apertura de la misma tenencia');
select pg_temp.espera_ok($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, ccl_del_dia, carga_id) values ('2026-10-07',1,1,'compra',191,1500,1)$$, 'compra del día sin precio (PPP -)');
select pg_temp.espera_error($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, precio, carga_id) values ('2026-10-07',1,1,'compra',10,20000,1)$$, 'compra sin CCL');
select pg_temp.espera_error($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, ccl_del_dia, carga_id) values ('2026-10-07',1,1,'venta',10,1500,1)$$, 'venta sin precio ni importe');
select pg_temp.espera_error($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, ccl_del_dia, carga_id) values ('2026-10-07',1,2,'renta',0,1500,1)$$, 'renta sin importe');
select pg_temp.espera_ok($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, moneda, importe, ccl_del_dia, carga_id) values ('2026-10-07',1,1,'renta',0,'USD',5.00,1500,1)$$, 'dividendo en USD');
select pg_temp.espera_error($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, ccl_del_dia, fecha_origen, carga_id) values ('2026-10-07',1,1,'compra',1,1500,'2026-01-01',1)$$, 'fecha_origen fuera de apertura');
select pg_temp.espera_error($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, precio, ccl_del_dia, carga_id) values ('2026-10-07',2,1,'apertura',3,20000,1400,1)$$, 'apertura con CCL pero sin fecha_origen');
select pg_temp.espera_error($$insert into operaciones (fecha, cuenta_id, activo_id, tipo, cantidad, precio, ccl_del_dia, carga_id) values ('2026-10-07',1,1,'compra','NaN',20000,1500,1)$$, 'cantidad NaN');

-- Saldos
select pg_temp.espera_ok($$insert into saldos_liquidez (fecha, cuenta_id, moneda, monto, carga_id) values ('2026-10-07',1,'ARS',-50000,1)$$, 'saldo negativo (Total de IEB a liquidar)');

-- Movimientos
select pg_temp.espera_ok($$insert into movimientos_capital (fecha, tipo, cuenta_destino_id, moneda_origen, monto_origen, moneda_destino, monto_destino, tc_aplicado, carga_id) values ('2026-10-07','aporte',3,'USD',1000,'ARS',1450000,1450,2)$$, 'aporte USD vendido a cripto');
select pg_temp.espera_error($$insert into movimientos_capital (fecha, tipo, cuenta_origen_id, cuenta_destino_id, moneda_origen, monto_origen, moneda_destino, monto_destino, carga_id) values ('2026-10-07','transferencia',3,3,'ARS',1,'ARS',1,2)$$, 'transferencia a la misma cuenta');
select pg_temp.espera_error($$insert into movimientos_capital (fecha, tipo, cuenta_destino_id, carga_id) values ('2026-10-07','aporte',3,2)$$, 'aporte sin monto');

-- Pasivos
insert into pasivos (nombre, tipo, moneda, fecha_inicio, cuotas_totales) values ('Leasing camioneta','leasing','ARS','2025-06-01',36);
select pg_temp.espera_ok($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, iva_canon, seguro, carga_id) values (1,1,'2025-07-01',1000,210,50,2)$$, 'cuota');
select pg_temp.espera_error($$insert into pasivo_cuotas (pasivo_id, nro, fecha_vencimiento, canon_neto, ccl_del_dia_pago, carga_id) values (1,2,'2025-08-01',1000,1200,2)$$, 'cuota impaga con CCL de pago');
select total_pesos::text as total_cuota_esperado_1260 from pasivo_cuotas where nro = 1;
select pg_temp.espera_ok($$insert into pasivo_saldos (pasivo_id, fecha, capital_pendiente, carga_id) values (1,'2026-10-07',5000000,2)$$, 'capital pendiente informado');

-- Bienes
insert into bienes (nombre, tipo, moneda_valuacion) values ('Casa','inmueble','USD');
select pg_temp.espera_ok($$insert into bienes_valuaciones (bien_id, fecha, valor, fuente, carga_id) values (1,'2026-10-07',100000,'tasación',2)$$, 'valuación casa');

-- Cargas
select pg_temp.espera_error($$insert into cargas (fecha, origen, archivo_path) values ('2026-10-07','manual','x')$$, 'carga manual con archivo');
select pg_temp.espera_error($$insert into cargas (fecha, origen, estado) values ('2026-10-07','manual','revertida')$$, 'revertida sin fecha de reversión');

-- Vistas: montos como texto
select pg_typeof(cantidad) as tipo_cantidad_v_tenencias, cantidad from v_tenencias where activo_id = 2;
select pg_typeof(precio_pesos) as tipo_precio_v_ultima from v_ultima_cotizacion limit 1;

-- Auditoría
update cotizaciones set precio_pesos = 1.31 where activo_id = 2;
select tabla, operacion, antes->>'precio_pesos' as antes, despues->>'precio_pesos' as despues, carga_id
from auditoria where tabla = 'cotizaciones' order by id;
select count(*) as filas_auditoria from auditoria;

-- Privilegios
set role anon;
select pg_temp.espera_error($$select * from cotizaciones$$, 'anon lee cotizaciones');
select pg_temp.espera_error($$select * from v_tenencias$$, 'anon lee vista');
select pg_temp.espera_error($$select * from auditoria$$, 'anon lee auditoría');
reset role;
set role authenticated;
select pg_temp.espera_error($$insert into cuentas (nombre, tipo, formato_carga) values ('x','broker','manual')$$, 'authenticated escribe');
reset role;
set role service_role;
select pg_temp.espera_ok($$select * from cotizaciones$$, 'service_role lee tabla');
select pg_temp.espera_ok($$select * from v_tenencias$$, 'service_role lee vista');
select pg_temp.espera_ok($$insert into eventos (fecha, tipo, titulo) values ('2026-11-01','macro','Dato de inflación')$$, 'service_role inserta (identity)');
select pg_temp.espera_ok($$select * from auditoria$$, 'service_role lee auditoría');
select pg_temp.espera_error($$insert into auditoria (tabla, operacion) values ('x','INSERT')$$, 'service_role escribe auditoría a mano');
select pg_temp.espera_error($$delete from auditoria$$, 'service_role borra auditoría');
select pg_temp.espera_error($$truncate auditoria$$, 'service_role trunca auditoría');
select pg_temp.espera_error($$truncate cotizaciones$$, 'service_role trunca datos (saltearía la auditoría)');
select pg_temp.espera_error($$update auditoria set tabla = 'x'$$, 'service_role modifica auditoría');
select pg_temp.espera_error($$insert into v_tenencias values (1,1,'1')$$, 'service_role escribe en vista');
select count(*) as auditoria_registra_insert_de_service_role from auditoria where tabla = 'eventos';
reset role;

-- RLS en todas las tablas
select 'tablas sin RLS: ' || coalesce(string_agg(relname, ', '), 'ninguna')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- Tablas con trigger de auditoría (todas menos auditoria)
select 'tablas sin auditoría: ' || coalesce(string_agg(t.relname, ', '), 'ninguna')
from pg_class t join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relkind = 'r' and t.relname <> 'auditoria'
  and not exists (select 1 from pg_trigger g where g.tgrelid = t.oid and g.tgname = 'auditar');

-- Bucket
select id, public from storage.buckets;

-- ═════════════════════════ Carga transaccional (migraciones *_carga_* y catalogo_activos) ═════════════════════════
-- confirmar_carga, revertir_lote, guardar_manual, alta_activo y editar_activo.
-- Corren como service_role: con postgres (superusuario) un grant faltante no se vería.

-- Una condición que tiene que cumplirse.
create or replace function pg_temp.espera(cond boolean, etiqueta text) returns text language sql as $$
  select case when coalesce(cond, false) then 'ok     cumple:  ' || etiqueta
              else 'FALLA  (no cumple) ' || etiqueta end
$$;

-- Rechazo por el motivo esperado: el mensaje (o el SQLSTATE) tiene que coincidir con el patrón.
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

-- JSON con "@TICKER" y "@Cuenta" reemplazados por sus ids.
create or replace function pg_temp.j(t text) returns jsonb language plpgsql as $$
declare r record;
begin
  for r in select ticker as k, id from activos union all select nombre, id from cuentas
           union all select nombre, id from bienes union all select nombre, id from pasivos loop
    t := replace(t, '"@' || r.k || '"', r.id::text);
  end loop;
  return t::jsonb;
end $$;

-- Huella de todas las tablas de hechos: revertir tiene que dejarla igual (calidad.md §1).
create or replace function pg_temp.huella() returns text language sql as $$
  select md5(concat_ws('#',
    (select string_agg(t::text, '|' order by t::text) from tipo_cambio t),
    (select string_agg(t::text, '|' order by t::text) from cotizaciones t),
    (select string_agg(t::text, '|' order by t::text) from saldos_liquidez t),
    (select string_agg(t::text, '|' order by t::text) from operaciones t),
    (select string_agg(t::text, '|' order by t::text) from eventos t),
    (select string_agg(t::text, '|' order by t::text) from movimientos_capital t),
    (select string_agg(t::text, '|' order by t::text) from bienes_valuaciones t),
    (select string_agg(t::text, '|' order by t::text) from pasivo_saldos t)))
$$;

insert into activos (ticker, nombre, tipo, moneda_riesgo, geografia, ticker_subyacente) values ('XCED','CEDEAR de prueba','cedear','USD','US','XCED');
insert into activos (ticker, nombre, tipo, moneda_riesgo, geografia, indexacion) values ('XBON','Bono de prueba','bono','ARS','AR','fija');
insert into pasivos (nombre, tipo, moneda, fecha_inicio, cuotas_totales) values ('Préstamo de prueba','prestamo','ARS','2026-01-01',12);
insert into bienes (nombre, tipo, moneda_valuacion) values ('Auto de prueba','vehiculo','ARS');

-- ── Permisos de las funciones nuevas ──
select pg_temp.espera(bool_and(not has_function_privilege('anon', p.oid, 'execute')
                             and not has_function_privilege('authenticated', p.oid, 'execute')
                             and has_function_privilege('service_role', p.oid, 'execute')),
                      'solo service_role ejecuta las funciones nuevas (' || count(*) || ')')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('leer_monto','leer_fecha','leer_id','confirmar_carga','revertir_lote','guardar_manual','alta_activo','editar_activo');
select pg_temp.espera(bool_and(not p.prosecdef and p.proconfig is not null), 'funciones nuevas: security invoker y search_path fijo')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('leer_monto','leer_fecha','leer_id','confirmar_carga','revertir_lote','guardar_manual','alta_activo','editar_activo');
select pg_temp.espera(not exists (
         select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
            and has_function_privilege('anon', p.oid, 'execute')),
       'anon no ejecuta ninguna función de public');
set role anon;
select pg_temp.espera_error_por($$select confirmar_carga('{}')$$, '42501', 'anon ejecuta confirmar_carga');
select pg_temp.espera_error_por($$select revertir_lote('00000000-0000-4000-8000-000000000000', 'x')$$, '42501', 'anon ejecuta revertir_lote');
reset role;
set role authenticated;
select pg_temp.espera_error_por($$select guardar_manual('{}')$$, '42501', 'authenticated ejecuta guardar_manual');
select pg_temp.espera_error_por($$select alta_activo('{}')$$, '42501', 'authenticated ejecuta alta_activo');
reset role;

set role service_role;
select pg_temp.huella() as huella_inicial \gset
select count(*) as auditoria_inicial from auditoria \gset

-- ── Lote A: confirmación completa ──
select pg_temp.espera_ok($$select confirmar_carga(pg_temp.j($j${
  "lote": "a0000000-0000-4000-8000-00000000000a", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": "1500.50", "cripto_venta": "1480", "mep": null, "oficial": null},
  "tiempo_activo_ms": 41234.6, "nota": "  Nota de prueba  ",
  "cuentas": [
    {"cuenta_id": "@IEB", "origen": "excel",
     "archivo_path": "2026/11/1111111111111111111111111111111111111111111111111111111111111111.xlsx",
     "archivo_sha256": "1111111111111111111111111111111111111111111111111111111111111111",
     "lector": "ieb-excel@1", "lectura_cruda": {"hoja": "Patrimonio"}, "grabado": {"filas": 2}, "listado_completo": true,
     "cotizaciones": [{"activo_id": "@XCED", "precio_pesos": "20000.50"}, {"activo_id": "@XBON", "precio_pesos": "1.2345"}],
     "saldos": [{"moneda": "ARS", "monto": "-50000.25"}, {"moneda": "USD", "monto": "120.5"}],
     "operaciones": [
       {"activo_id": "@XBON", "tipo": "apertura", "cantidad": "1000000", "moneda": "ARS", "precio": "1.2", "importe": null,
        "comisiones": "0", "ccl_del_dia": null, "fecha_origen": null, "notas": null},
       {"activo_id": "@XCED", "tipo": "compra", "cantidad": "10", "moneda": null, "precio": null, "importe": null,
        "comisiones": null, "ccl_del_dia": "1500.50", "fecha_origen": null, "notas": "compra del día"}]},
    {"cuenta_id": "@Mercado Pago", "origen": "captura",
     "archivo_path": "2026/11/2222222222222222222222222222222222222222222222222222222222222222.png",
     "archivo_sha256": "2222222222222222222222222222222222222222222222222222222222222222",
     "lector": "captura-claude@1", "lectura_cruda": null, "grabado": null, "listado_completo": true,
     "cotizaciones": [], "saldos": [{"moneda": "ARS", "monto": "1000000"}], "operaciones": []}]}$j$))$$,
  'confirmar_carga: lote completo');
select id as a_tc from cargas where lote = 'a0000000-0000-4000-8000-00000000000a' and cuenta_id is null \gset
select id as a_ieb from cargas where lote = 'a0000000-0000-4000-8000-00000000000a' and cuenta_id = 1 \gset
select pg_temp.espera(count(*) = 3 and bool_and(estado = 'vigente') and bool_and(tiempo_activo_ms = 41235)
                      and count(*) filter (where archivo_sha256 is not null) = 2
                      and count(*) filter (where lector = 'tipeado' and origen = 'manual' and cuenta_id is null) = 1,
                      'confirmar_carga: tres cargas vigentes (tipo de cambio + dos cuentas) con lote, lector y tiempo activo')
from cargas where lote = 'a0000000-0000-4000-8000-00000000000a';
select pg_temp.espera(ccl::text = '1500.50' and cripto_venta::text = '1480' and mep is null and carga_id = :a_tc,
                      'confirmar_carga: tipo de cambio exacto, con su carga')
from tipo_cambio where fecha = '2026-11-02';
select pg_temp.espera(count(*) = 2 and bool_and(carga_id = :a_ieb)
                      and string_agg(precio_pesos::text, ',' order by precio_pesos) = '1.2345,20000.50',
                      'confirmar_carga: cotizaciones exactas, con la carga de la cuenta')
from cotizaciones where fecha = '2026-11-02';
select pg_temp.espera(count(*) = 3 and sum(monto) filter (where cuenta_id = 1 and moneda = 'ARS')::text = '-50000.25',
                      'confirmar_carga: saldos por cuenta y moneda (negativo incluido)')
from saldos_liquidez where fecha = '2026-11-02';
select pg_temp.espera(count(*) = 2 and bool_and(fecha = '2026-11-02' and carga_id = :a_ieb)
                      and bool_or(tipo = 'compra' and moneda = 'ARS' and comisiones = 0 and precio is null),
                      'confirmar_carga: operaciones con la fecha de la carga y defaults (ARS, comisiones 0)')
from operaciones where carga_id = :a_ieb;
select pg_temp.espera(count(*) = 1 and min(titulo) = 'Nota de prueba' and min(carga_id) = :a_tc,
                      'confirmar_carga: nota del día en eventos, con la primera carga del lote')
from eventos where tipo = 'nota';
select pg_temp.espera(count(*) > 0, 'confirmar_carga: la auditoría registra las filas del lote')
from auditoria where carga_id = :a_ieb;
select pg_temp.huella() as huella_a \gset
select count(*) as auditoria_a from auditoria \gset

-- ── El mismo lote dos veces (doble Enter) no escribe nada ──
select pg_temp.espera((confirmar_carga(pg_temp.j($j${"lote": "a0000000-0000-4000-8000-00000000000a", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": "1500.50", "cripto_venta": "1480", "mep": null, "oficial": null},
  "cuentas": [{"cuenta_id": "@IEB", "origen": "excel"}, {"cuenta_id": "@Mercado Pago", "origen": "captura"}]}$j$)) ->> 'repetido')::boolean,
  'confirmar_carga: lote repetido devuelve repetido = true');
select pg_temp.espera(pg_temp.huella() = :'huella_a' and (select count(*) from auditoria) = :auditoria_a
                      and (select count(*) from cargas where lote = 'a0000000-0000-4000-8000-00000000000a') = 3,
                      'confirmar_carga: lote repetido no escribe nada');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "a0000000-0000-4000-8000-00000000000a", "fecha": "2026-11-05",
  "tipo_cambio": {"ccl": "1"}, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual"}]}$j$))$$, 'ya se usó para otra carga',
  'confirmar_carga: el mismo lote con otra fecha');

-- ── Un error deja todo sin grabar ──
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": "1600", "cripto_venta": null, "mep": null, "oficial": null},
  "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "cotizaciones": [{"activo_id": "@XCED", "precio_pesos": "99999"}],
               "saldos": [{"moneda": "ARS", "monto": "1"}],
               "operaciones": [{"activo_id": "@XBON", "tipo": "venta", "cantidad": "5", "moneda": "ARS", "precio": null,
                                "importe": null, "comisiones": "0", "ccl_del_dia": "1600", "fecha_origen": null, "notas": null}]}]}$j$))$$,
  'operaciones_forma', 'confirmar_carga: venta sin precio ni importe');
select pg_temp.espera(pg_temp.huella() = :'huella_a' and (select count(*) from auditoria) = :auditoria_a
                      and not exists (select 1 from cargas where lote = 'b0000000-0000-4000-8000-00000000000b')
                      and (select count(*) from cargas where lote = 'a0000000-0000-4000-8000-00000000000a' and estado = 'vigente') = 3,
                      'confirmar_carga: una fila inválida no deja nada grabado ni reemplaza nada');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "cotizaciones": [{"activo_id": "@XCED", "precio_pesos": 20000.5}]}]}$j$))$$,
  'viajan como texto', 'confirmar_carga: monto como número JSON (D-32)');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": "NaN"}, "cuentas": []}$j$))$$, 'Monto inválido', 'confirmar_carga: CCL NaN');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": "Infinity"}, "cuentas": []}$j$))$$, 'Monto inválido', 'confirmar_carga: CCL Infinity');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "saldos": [{"moneda": "ARS", "monto": "1.234,56"}]}]}$j$))$$,
  'Monto inválido', 'confirmar_carga: monto en formato es-AR sin normalizar');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual"}, {"cuenta_id": "@IEB", "origen": "manual"}]}$j$))$$,
  'dos veces', 'confirmar_carga: la misma cuenta dos veces en un lote');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "cotizaciones": [{"activo_id": 32000, "precio_pesos": "1"}]}]}$j$))$$,
  'cotizaciones_activo_id_fkey', 'confirmar_carga: activo que no está en el catálogo');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "excel", "archivo_path": "2026/11/x.xlsx", "archivo_sha256": null}]}$j$))$$,
  'cargas_archivo_sha256', 'confirmar_carga: archivo sin sha256');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-31",
  "tipo_cambio": {"ccl": "1"}, "cuentas": []}$j$))$$, 'Fecha inválida', 'confirmar_carga: fecha que no existe');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "no-es-un-uuid", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": "1"}, "cuentas": []}$j$))$$, 'lote no es', 'confirmar_carga: lote inválido');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "b0000000-0000-4000-8000-00000000000b", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": null, "cripto_venta": null, "mep": null, "oficial": null}, "cuentas": []}$j$))$$,
  'nada para grabar', 'confirmar_carga: sin tipo de cambio ni cuentas');
select pg_temp.espera(pg_temp.huella() = :'huella_a' and (select count(*) from auditoria) = :auditoria_a
                      and not exists (select 1 from cargas where lote = 'b0000000-0000-4000-8000-00000000000b'),
                      'confirmar_carga: los rechazos no dejan rastro');

-- ── Lote C: recargar el mismo día reemplaza y pisa precios y saldos ──
select pg_temp.espera_ok($$select confirmar_carga(pg_temp.j($j${
  "lote": "c0000000-0000-4000-8000-00000000000c", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": "1510", "cripto_venta": "1490", "mep": null, "oficial": null},
  "tiempo_activo_ms": 30000, "nota": null,
  "cuentas": [
    {"cuenta_id": "@IEB", "origen": "excel",
     "archivo_path": "2026/11/3333333333333333333333333333333333333333333333333333333333333333.xlsx",
     "archivo_sha256": "3333333333333333333333333333333333333333333333333333333333333333",
     "lector": "ieb-excel@1", "lectura_cruda": {}, "grabado": {}, "listado_completo": true,
     "cotizaciones": [{"activo_id": "@XCED", "precio_pesos": "21000"}],
     "saldos": [{"moneda": "ARS", "monto": "-10"}],
     "operaciones": [{"activo_id": "@XCED", "tipo": "compra", "cantidad": "5", "moneda": "ARS", "precio": "21000",
                      "importe": null, "comisiones": "10.5", "ccl_del_dia": "1510", "fecha_origen": null, "notas": null}]}]}$j$))$$,
  'confirmar_carga: recarga del mismo día');
select id as c_tc from cargas where lote = 'c0000000-0000-4000-8000-00000000000c' and cuenta_id is null \gset
select id as c_ieb from cargas where lote = 'c0000000-0000-4000-8000-00000000000c' and cuenta_id = 1 \gset
select pg_temp.espera((select estado from cargas where id = :a_ieb) = 'reemplazada'
                      and (select estado from cargas where id = :a_tc) = 'reemplazada'
                      and (select reemplaza_a from cargas where id = :c_ieb) = :a_ieb
                      and (select reemplaza_a from cargas where id = :c_tc) = :a_tc
                      and (select estado from cargas where lote = 'a0000000-0000-4000-8000-00000000000a' and cuenta_id = 3) = 'vigente',
                      'recarga: la carga anterior de la cuenta y del tipo de cambio quedan reemplazadas; la de otra cuenta, no');
select pg_temp.espera((select precio_pesos::text || '/' || (carga_id = :c_ieb)::text from cotizaciones
                        where fecha = '2026-11-02' and activo_id = (select id from activos where ticker = 'XCED')) = '21000/true'
                      and (select carga_id from cotizaciones
                            where fecha = '2026-11-02' and activo_id = (select id from activos where ticker = 'XBON')) = :a_ieb
                      and (select monto::text from saldos_liquidez where fecha = '2026-11-02' and cuenta_id = 1 and moneda = 'ARS') = '-10'
                      and (select carga_id from saldos_liquidez where fecha = '2026-11-02' and cuenta_id = 1 and moneda = 'USD') = :a_ieb
                      and (select ccl::text from tipo_cambio where fecha = '2026-11-02') = '1510',
                      'recarga: pisa los precios y saldos que trae y deja los que no trae');

-- ── Revertir C restaura desde la auditoría lo que había pisado ──
select pg_temp.espera_error_por($$select revertir_lote('c0000000-0000-4000-8000-00000000000c', '   ')$$, 'motivo', 'revertir_lote: sin motivo');
select pg_temp.espera_error_por($$select revertir_lote('c0000000-0000-4000-8000-00000000000c', null)$$, 'motivo', 'revertir_lote: motivo null');
select pg_temp.espera_error_por($$select revertir_lote('a0000000-0000-4000-8000-00000000000a', 'prueba')$$, 'revertí primero',
                                'revertir_lote: no revierte una carga que no es la última de su cuenta');
select pg_temp.espera_error_por($$select revertir_lote('d0000000-0000-4000-8000-0000000000ff', 'prueba')$$, 'No existe',
                                'revertir_lote: lote inexistente');
select revertir_lote('c0000000-0000-4000-8000-00000000000c', 'lectura equivocada') as reversion_c \gset
select pg_temp.espera((:'reversion_c'::jsonb ->> 'restauradas')::int = 3 and (:'reversion_c'::jsonb ->> 'borradas')::int = 1
                      and jsonb_array_length(:'reversion_c'::jsonb -> 'cargas') = 2,
                      'revertir_lote: resumen (3 restauradas: precio, saldo y tipo de cambio; 1 borrada: la compra)');
select pg_temp.espera(pg_temp.huella() = :'huella_a', 'revertir_lote: los hechos quedan como antes del lote');
select pg_temp.espera((select estado from cargas where id = :a_ieb) = 'vigente' and (select estado from cargas where id = :a_tc) = 'vigente'
                      and (select bool_and(estado = 'revertida' and motivo_reversion = 'lectura equivocada' and revertida_en is not null)
                             from cargas where lote = 'c0000000-0000-4000-8000-00000000000c'),
                      'revertir_lote: las cargas reemplazadas vuelven a vigentes y las del lote quedan revertidas con motivo');
select pg_temp.espera(exists (select 1 from auditoria where tabla = 'cotizaciones' and operacion = 'UPDATE'
                               and (antes ->> 'carga_id')::bigint = :c_ieb and (despues ->> 'carga_id')::bigint = :a_ieb),
                      'revertir_lote: la restauración queda en la auditoría');
select pg_temp.espera_error_por($$select revertir_lote('c0000000-0000-4000-8000-00000000000c', 'otra vez')$$, 'ya está revertido',
                                'revertir_lote: un lote ya revertido');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "c0000000-0000-4000-8000-00000000000c", "fecha": "2026-11-02",
  "tipo_cambio": {"ccl": "1510", "cripto_venta": "1490"}, "cuentas": [{"cuenta_id": "@IEB", "origen": "excel"}]}$j$))$$, 'se revirtió',
  'confirmar_carga: un lote revertido no se vuelve a confirmar con el mismo lote');

-- ── Solo la última carga de cada cuenta se revierte ──
select pg_temp.espera_ok($$select confirmar_carga(pg_temp.j($j${"lote": "d0000000-0000-4000-8000-00000000000d", "fecha": "2026-11-03",
  "tipo_cambio": null, "tiempo_activo_ms": null, "nota": null,
  "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "archivo_path": null, "archivo_sha256": null, "lector": null,
               "lectura_cruda": null, "grabado": null, "listado_completo": false,
               "cotizaciones": [{"activo_id": "@XCED", "precio_pesos": "21500"}], "saldos": [], "operaciones": []}]}$j$))$$,
  'confirmar_carga: carga del día siguiente');
select pg_temp.espera_error_por($$select revertir_lote('a0000000-0000-4000-8000-00000000000a', 'prueba')$$, 'revertí primero',
                                'revertir_lote: con una carga posterior de la cuenta, se niega');
select pg_temp.espera_ok($$select revertir_lote('d0000000-0000-4000-8000-00000000000d', 'archivo de otro día')$$, 'revertir_lote: la posterior');
select pg_temp.espera(pg_temp.huella() = :'huella_a', 'revertir_lote: la carga del día siguiente no deja rastro');

-- ── Un nivel que apunta a una operación del lote impide revertirlo ──
select pg_temp.espera_ok($$select confirmar_carga(pg_temp.j($j${"lote": "e0000000-0000-4000-8000-00000000000e", "fecha": "2026-11-04",
  "tipo_cambio": null,
  "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "cotizaciones": [], "saldos": [],
               "operaciones": [{"activo_id": "@XCED", "tipo": "compra", "cantidad": "1", "moneda": "ARS", "precio": "22000",
                                "importe": null, "comisiones": "0", "ccl_del_dia": "1520", "fecha_origen": null, "notas": null}]}]}$j$))$$,
  'confirmar_carga: compra que ejecuta un nivel');
insert into niveles (activo_id, fecha_definicion, nivel_entrada_decidido, tesis_texto)
  values ((select id from activos where ticker = 'XCED'), '2026-11-01', 22000, 'Tesis de prueba');
insert into nivel_operaciones (nivel_id, operacion_id, cantidad)
  values ((select max(id) from niveles), (select o.id from operaciones o join cargas c on c.id = o.carga_id
                                           where c.lote = 'e0000000-0000-4000-8000-00000000000e'), 1);
select pg_temp.espera_error_por($$select revertir_lote('e0000000-0000-4000-8000-00000000000e', 'prueba')$$, 'niveles',
                                'revertir_lote: una operación usada por un nivel');
delete from nivel_operaciones;
delete from niveles;
select pg_temp.espera_ok($$select revertir_lote('e0000000-0000-4000-8000-00000000000e', 'prueba')$$, 'revertir_lote: sin el nivel, revierte');

-- ── Revertir A (ahora es la última) deja todo como al principio ──
select pg_temp.espera_ok($$select revertir_lote('a0000000-0000-4000-8000-00000000000a', 'prueba completa')$$, 'revertir_lote: lote A');
select pg_temp.espera(pg_temp.huella() = :'huella_inicial', 'revertir_lote: todas las tablas de hechos vuelven a la huella inicial');
select pg_temp.espera(not exists (select 1 from eventos where tipo = 'nota'), 'revertir_lote: borra la nota del día');

-- ── guardar_manual ──
select pg_temp.espera_ok($$select guardar_manual(pg_temp.j($j${"lote": "f0000000-0000-4000-8000-00000000000f", "fecha": "2026-11-02",
  "bienes_valuaciones": [{"bien_id": "@Auto de prueba", "fecha": "2026-11-02", "valor": "25000000", "fuente": "guía de precios"}],
  "pasivo_saldos": [{"pasivo_id": "@Préstamo de prueba", "fecha": "2026-11-02", "capital_pendiente": "900000.50"}],
  "movimientos_capital": [{"tipo": "aporte", "cuenta_destino_id": "@Mercado Pago", "moneda_origen": "USD", "monto_origen": "1000",
                           "moneda_destino": "ARS", "monto_destino": "1480000", "tc_aplicado": "1480"}]}$j$))$$,
  'guardar_manual: valuación, capital pendiente y aporte');
select id as m1 from cargas where lote = 'f0000000-0000-4000-8000-00000000000f' \gset
select pg_temp.espera((select origen = 'manual' and lector = 'manual' and cuenta_id is null and estado = 'vigente' and grabado ? 'bienes_valuaciones'
                         from cargas where id = :m1)
                      and (select valor::text from bienes_valuaciones where carga_id = :m1) = '25000000'
                      and (select capital_pendiente::text from pasivo_saldos where carga_id = :m1) = '900000.50'
                      and (select impuesto = 0 and fecha = '2026-11-02' from movimientos_capital where carga_id = :m1),
                      'guardar_manual: graba los hechos con su carga manual');
select pg_temp.espera(guardar_manual(pg_temp.j($j${"lote": "f0000000-0000-4000-8000-00000000000f", "fecha": "2026-11-02",
  "bienes_valuaciones": [{"bien_id": "@Auto de prueba", "valor": "25000000", "fuente": "guía de precios"}]}$j$)) = :m1
                      and (select count(*) from cargas where lote = 'f0000000-0000-4000-8000-00000000000f') = 1
                      and (select count(*) from bienes_valuaciones where bien_id = (select id from bienes where nombre = 'Auto de prueba')) = 1,
                      'guardar_manual: el mismo lote devuelve la misma carga y no duplica');
select pg_temp.huella() as huella_m1 \gset
select pg_temp.espera_ok($$select guardar_manual(pg_temp.j($j${"lote": "f0000000-0000-4000-8000-0000000000f2", "fecha": "2026-11-02",
  "bienes_valuaciones": [{"bien_id": "@Auto de prueba", "valor": "26000000", "fuente": "tasación"}]}$j$))$$,
  'guardar_manual: corrige la valuación del mismo día');
select pg_temp.espera((select valor::text || ' ' || fuente from bienes_valuaciones where bien_id = (select id from bienes where nombre = 'Auto de prueba')) = '26000000 tasación',
                      'guardar_manual: la valuación del mismo día se pisa');
select pg_temp.espera_error_por($$select guardar_manual(pg_temp.j($j${"lote": "f0000000-0000-4000-8000-0000000000f3", "fecha": "2026-11-02",
  "bienes_valuaciones": [{"bien_id": "@Auto de prueba", "valor": "0", "fuente": "x"}]}$j$))$$, 'bienes_valuaciones_valor_check',
  'guardar_manual: valuación cero');
select pg_temp.espera_error_por($$select guardar_manual(pg_temp.j($j${"lote": "f0000000-0000-4000-8000-0000000000f3", "fecha": "2026-11-02",
  "bienes_valuaciones": [{"bien_id": "@Auto de prueba", "valor": "1", "fuente": "  "}]}$j$))$$, '23502', 'guardar_manual: valuación sin fuente');
select pg_temp.espera_error_por($$select guardar_manual(pg_temp.j($j${"lote": "f0000000-0000-4000-8000-0000000000f3", "fecha": "2026-11-02"}$j$))$$,
  'nada para grabar', 'guardar_manual: sin hechos');
select pg_temp.espera(not exists (select 1 from cargas where lote = 'f0000000-0000-4000-8000-0000000000f3'),
                      'guardar_manual: los rechazos no dejan carga');
select pg_temp.espera_ok($$select revertir_lote('f0000000-0000-4000-8000-0000000000f2', 'tasación equivocada')$$, 'revertir_lote: alta manual');
select pg_temp.espera(pg_temp.huella() = :'huella_m1', 'revertir_lote: restaura la valuación anterior');
select pg_temp.espera_ok($$select revertir_lote('f0000000-0000-4000-8000-00000000000f', 'prueba')$$, 'revertir_lote: primera alta manual');
select pg_temp.espera(pg_temp.huella() = :'huella_inicial', 'revertir_lote: las altas manuales no dejan rastro');

-- ── D-19: completar el precio de una compra pendiente ──
-- G1: compra del día con PPP "-" (precio e importe vacíos) y CCL con su referencia.
select pg_temp.espera_ok($$select confirmar_carga(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-000000000001", "fecha": "2026-11-10",
  "tipo_cambio": {"ccl": "1500", "cripto_venta": null, "mep": null, "oficial": null, "referencia": "  Ámbito, cierre  "},
  "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "cotizaciones": [], "saldos": [],
               "operaciones": [{"activo_id": "@XCED", "tipo": "compra", "cantidad": "10", "moneda": "ARS", "precio": null,
                                "importe": null, "comisiones": "0", "ccl_del_dia": "1500", "fecha_origen": null, "notas": null}]}]}$j$))$$,
  'D-19: compra pendiente (PPP "-")');
select pg_temp.espera((select referencia from tipo_cambio where fecha = '2026-11-10') = 'Ámbito, cierre',
                      'tipo_cambio: guarda la referencia del CCL, sin espacios de más');
select o.id as g1_op from operaciones o join cargas c on c.id = o.carga_id where c.lote = 'a1900000-0000-4000-8000-000000000001' \gset
select pg_temp.huella() as huella_g1 \gset
-- Rechazos: ninguno deja rastro.
select pg_temp.espera_error_por($$select confirmar_carga(jsonb_set(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-0000000000e1", "fecha": "2026-11-11",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@Mercado Pago", "origen": "manual", "completar_precios": [{"operacion_id": 0, "precio": "12200"}]}]}$j$),
  '{cuentas,0,completar_precios,0,operacion_id}', to_jsonb((select o.id from operaciones o join cargas c on c.id = o.carga_id
                                                              where c.lote = 'a1900000-0000-4000-8000-000000000001'))))$$,
  'ya no está pendiente', 'D-19: no completa una compra de otra cuenta');
select pg_temp.espera_error_por($$select confirmar_carga(jsonb_set(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-0000000000e2", "fecha": "2026-11-09",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "completar_precios": [{"operacion_id": 0, "precio": "12200"}]}]}$j$),
  '{cuentas,0,completar_precios,0,operacion_id}', to_jsonb((select o.id from operaciones o join cargas c on c.id = o.carga_id
                                                              where c.lote = 'a1900000-0000-4000-8000-000000000001'))))$$,
  'ya no está pendiente', 'D-19: no completa desde una carga anterior a la compra');
select pg_temp.espera_error_por($$select confirmar_carga(jsonb_set(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-0000000000e3", "fecha": "2026-11-11",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "completar_precios": [{"operacion_id": 0, "precio": 12200}]}]}$j$),
  '{cuentas,0,completar_precios,0,operacion_id}', to_jsonb((select o.id from operaciones o join cargas c on c.id = o.carga_id
                                                              where c.lote = 'a1900000-0000-4000-8000-000000000001'))))$$,
  'Monto inválido', 'D-19: el precio como número JSON (D-32)');
select pg_temp.espera_error_por($$select confirmar_carga(jsonb_set(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-0000000000e4", "fecha": "2026-11-11",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "completar_precios": [{"operacion_id": 0, "precio": "0"}]}]}$j$),
  '{cuentas,0,completar_precios,0,operacion_id}', to_jsonb((select o.id from operaciones o join cargas c on c.id = o.carga_id
                                                              where c.lote = 'a1900000-0000-4000-8000-000000000001'))))$$,
  'operaciones_precio_check', 'D-19: precio cero');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-0000000000e5", "fecha": "2026-11-11",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "completar_precios": [{"operacion_id": 999999, "precio": "1"}]}]}$j$))$$,
  'ya no está pendiente', 'D-19: una compra que no existe');
select pg_temp.espera_error_por($$select confirmar_carga(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-0000000000e6", "fecha": "2026-11-11",
  "tipo_cambio": {"ccl": "1500", "referencia": 12}, "cuentas": []}$j$))$$, 'tiene que ser texto', 'tipo_cambio: referencia que no es texto');
select pg_temp.espera_error_por(format($f$select confirmar_carga('{"lote": "a1900000-0000-4000-8000-0000000000e7", "fecha": "2026-11-11",
  "tipo_cambio": {"ccl": "1500", "referencia": "%s"}, "cuentas": []}')$f$, repeat('x', 201)), '200 caracteres', 'tipo_cambio: referencia de más de 200 caracteres');
select pg_temp.espera(pg_temp.huella() = :'huella_g1'
                      and not exists (select 1 from cargas where lote::text like 'a1900000-0000-4000-8000-0000000000e%'),
                      'D-19: los rechazos no dejan rastro');
-- G2: la carga siguiente completa el precio.
select pg_temp.espera_ok($$select confirmar_carga(jsonb_set(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-000000000002", "fecha": "2026-11-11",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "cotizaciones": [{"activo_id": "@XCED", "precio_pesos": "12300"}],
                                     "completar_precios": [{"operacion_id": 0, "precio": "12200.5"}]}]}$j$),
  '{cuentas,0,completar_precios,0,operacion_id}', to_jsonb((select o.id from operaciones o join cargas c on c.id = o.carga_id
                                                              where c.lote = 'a1900000-0000-4000-8000-000000000001'))))$$,
  'D-19: la carga siguiente completa el precio');
select id as g2_ieb from cargas where lote = 'a1900000-0000-4000-8000-000000000002' and cuenta_id = 1 \gset
select pg_temp.espera((select precio::text = '12200.5' and precio_carga_id = :g2_ieb and importe is null from operaciones where id = :g1_op),
                      'D-19: la compra queda con el precio y la carga que lo completó');
select pg_temp.espera(exists (select 1 from auditoria where tabla = 'operaciones' and operacion = 'UPDATE'
                               and (antes ->> 'id')::bigint = :g1_op and antes ->> 'precio' is null
                               and despues ->> 'precio' = '12200.5' and (despues ->> 'precio_carga_id')::bigint = :g2_ieb),
                      'D-19: la auditoría guarda el cambio de precio');
select pg_temp.huella() as huella_g2 \gset
select pg_temp.espera_error_por($$select confirmar_carga(jsonb_set(pg_temp.j($j${"lote": "a1900000-0000-4000-8000-0000000000e8", "fecha": "2026-11-12",
  "tipo_cambio": null, "cuentas": [{"cuenta_id": "@IEB", "origen": "manual", "completar_precios": [{"operacion_id": 0, "precio": "1"}]}]}$j$),
  '{cuentas,0,completar_precios,0,operacion_id}', to_jsonb((select o.id from operaciones o join cargas c on c.id = o.carga_id
                                                              where c.lote = 'a1900000-0000-4000-8000-000000000001'))))$$,
  'ya no está pendiente', 'D-19: nunca pisa un precio conocido');
select pg_temp.espera_error_por($$update operaciones set precio_carga_id = (select min(id) from cargas) where tipo = 'apertura'$$,
  'operaciones_precio_carga', 'operaciones: precio completado en algo que no es una compra');
select pg_temp.espera(pg_temp.huella() = :'huella_g2', 'D-19: el intento de pisar no deja rastro');
-- Revertir G2 deja la compra pendiente otra vez; revertir G1 deja todo como al principio.
select revertir_lote('a1900000-0000-4000-8000-000000000002', 'PPP mal leído') as reversion_g2 \gset
select pg_temp.espera((:'reversion_g2'::jsonb ->> 'restauradas')::int = 1 and (:'reversion_g2'::jsonb ->> 'borradas')::int = 1,
                      'revertir_lote: deshace la completación (1 restaurada) y borra el precio del día (1 borrada)');
select pg_temp.espera((select precio is null and precio_carga_id is null from operaciones where id = :g1_op)
                      and pg_temp.huella() = :'huella_g1',
                      'revertir_lote: la compra vuelve a quedar pendiente y los hechos, como después de G1');
select pg_temp.espera_ok($$select revertir_lote('a1900000-0000-4000-8000-000000000001', 'prueba')$$, 'revertir_lote: la compra pendiente');
select pg_temp.espera(pg_temp.huella() = :'huella_inicial', 'D-19: después de revertir todo, la huella inicial');

-- ── Catálogo: alta_activo y editar_activo ──
select pg_temp.espera_ok($$select alta_activo('{"ticker": "XNEW", "nombre": "CEDEAR nuevo", "tipo": "cedear", "moneda_riesgo": "USD",
  "geografia": "US", "indexacion": null, "ticker_subyacente": "XNEW", "ratio": "20", "color": "#123abc"}')$$, 'alta_activo: CEDEAR con ratio');
select pg_temp.espera((select r.ratio::text || ' ' || (r.vigente_desde = (now() at time zone 'America/Argentina/Cordoba')::date)::text
                         from ratios_cedear r join activos a on a.id = r.activo_id where a.ticker = 'XNEW') = '20 true',
                      'alta_activo: ratio vigente desde hoy en Córdoba');
select pg_temp.espera_error_por($$select alta_activo('{"ticker": "XBAD", "nombre": "Bono", "tipo": "bono", "moneda_riesgo": "ARS",
  "geografia": "AR", "indexacion": "fija", "ratio": "5"}')$$, 'solo va en un CEDEAR', 'alta_activo: ratio en algo que no es CEDEAR');
select pg_temp.espera_error_por($$select alta_activo('{"ticker": "XBAD", "nombre": "CEDEAR", "tipo": "cedear", "moneda_riesgo": "USD",
  "geografia": "US", "ratio": "-1", "ticker_subyacente": "XBAD"}')$$, 'Monto inválido|ratios_cedear_ratio_check', 'alta_activo: ratio negativo');
select pg_temp.espera(not exists (select 1 from activos where ticker = 'XBAD'), 'alta_activo: sin activo a medias');
select pg_temp.espera_error_por($$select alta_activo('{"ticker": "XNEW", "nombre": "Otro", "tipo": "accion_local", "moneda_riesgo": "ARS", "geografia": "AR"}')$$,
  'activos_ticker_key', 'alta_activo: ticker repetido');
select pg_temp.espera_ok($$select editar_activo((select id from activos where ticker = 'XNEW'),
  '{"color": null, "nombre": "CEDEAR renombrado", "ratio": {"ratio": "25", "vigente_desde": "2026-12-01"}}')$$, 'editar_activo: cambios parciales y ratio nuevo');
select pg_temp.espera((select nombre = 'CEDEAR renombrado' and color is null and tipo = 'cedear' from activos where ticker = 'XNEW')
                      and (select count(*) from ratios_cedear r join activos a on a.id = r.activo_id where a.ticker = 'XNEW') = 2,
                      'editar_activo: cambia solo lo pedido y suma el ratio con su vigencia');
select pg_temp.espera_error_por($$select editar_activo(32000, '{"nombre": "x"}')$$, 'No existe el activo', 'editar_activo: activo inexistente');

-- ── Esquema nuevo ──
select pg_temp.espera_error_por($$insert into eventos (fecha, tipo, titulo) values ('2026-11-02', 'nota', 'sin carga')$$, 'eventos_nota',
                                'eventos: una nota sin carga');
select pg_temp.espera_error_por($$insert into cargas (fecha, cuenta_id, origen, archivo_path, archivo_sha256) values ('2026-11-02', 1, 'excel', '2026/11/otro.xlsx', repeat('b', 64))$$,
                                'cargas_archivo_sha256', 'cargas: ruta que no contiene el sha256');
select pg_temp.espera_error_por($$insert into cargas (fecha, origen, estado, revertida_en) values ('2026-11-02', 'manual', 'revertida', now())$$,
                                'cargas_motivo_reversion', 'cargas: revertida sin motivo');
select pg_temp.espera_error_por($$insert into cargas (fecha, origen, tiempo_activo_ms) values ('2026-11-02', 'manual', -1)$$,
                                'tiempo_activo_ms', 'cargas: tiempo activo negativo');
select pg_temp.espera_error_por($$truncate cargas$$, '42501', 'service_role trunca cargas');
select pg_temp.espera_error_por($$truncate eventos$$, '42501', 'service_role trunca eventos');
select pg_temp.espera_error_por($$insert into auditoria (tabla, operacion) values ('cargas', 'INSERT')$$, '42501',
                                'service_role escribe la auditoría a mano (después de la migración)');
reset role;

-- ═════════════════════════ Seguridad (migraciones 202610081910* y siguientes) ═════════════════════════

-- ── Toda función de public fija el search_path, con pg_temp explícito y al final ──
-- Sin pg_temp en la lista, Postgres busca las tablas primero en la temporal de la sesión.
select pg_temp.espera(bool_and(coalesce((select bool_or(c ~ '^search_path=(.+, )?pg_temp$') from unnest(p.proconfig) c), false)),
                      'toda función de public fija el search_path con pg_temp al final (' || count(*) || ')')
from pg_proc p
where p.pronamespace = 'public'::regnamespace;

-- ── Auditoría: una tabla temporal "auditoria" no se lleva las filas (20261008191000_auditoria_search_path) ──
set role service_role;
create temp table auditoria (id bigserial, en timestamptz default now(), tabla text, operacion text,
                             antes jsonb, despues jsonb, carga_id bigint);
select count(*) as aud_feriados_antes from public.auditoria where tabla = 'feriados' \gset
insert into feriados (mercado, fecha, descripcion) values ('AR', '2031-01-02', 'Feriado de prueba');
delete from feriados where mercado = 'AR' and fecha = '2031-01-02';
reset role;
select pg_temp.espera((select count(*) from public.auditoria where tabla = 'feriados') = :aud_feriados_antes + 2
                      and (select count(*) from pg_temp.auditoria) = 0,
                      'auditoría: con una tabla temporal "auditoria", el alta y la baja van igual a public.auditoria');
drop table pg_temp.auditoria;
