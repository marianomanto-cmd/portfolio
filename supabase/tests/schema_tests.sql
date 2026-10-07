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
insert into cargas (fecha, cuenta_id, origen, archivo_path) values ('2026-10-07', 1, 'excel', 'cargas/x.xlsx');
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
