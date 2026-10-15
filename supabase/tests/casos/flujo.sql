-- Casos del schema de Flujo y escenarios (entrega 4, plan §6 D.8): migraciones
-- 20261015125017 a 20261015125140. Números inventados (D-24). Corre como
-- service_role (con postgres, un grant faltante no se vería). Deja la base
-- como la encontró en lo que importa a otros archivos: sus filas son propias
-- (tickers FLJ…, conceptos "Prueba flujo…") y lo que carga con lote se revierte.
\set ON_ERROR_STOP 0
\pset pager off

create or replace function pg_temp.espera(cond boolean, etiqueta text) returns text language sql as $$
  select case when coalesce(cond, false) then 'ok     cumple:  ' || etiqueta
              else 'FALLA  (no cumple) ' || etiqueta end
$$;
create or replace function pg_temp.espera_ok(sql text, etiqueta text) returns text language plpgsql as $$
begin
  execute sql;
  return 'ok     acepta:  ' || etiqueta;
exception when others then
  return 'FALLA  (debía aceptar) ' || etiqueta || ': ' || sqlerrm;
end $$;
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

-- Datos propios (como postgres: el catálogo se arma con alta_activo en la app).
insert into activos (ticker, nombre, tipo, moneda_riesgo, geografia, indexacion, fecha_vencimiento)
values ('FLJLET', 'Letra de prueba de Flujo', 'lecap', 'ARS', 'AR', 'fija', '2026-12-15');
insert into activos (ticker, nombre, tipo, moneda_riesgo, geografia, ticker_subyacente)
values ('FLJCED', 'CEDEAR de prueba de Flujo', 'cedear', 'USD', 'US', 'FLJCED');

-- ── Permisos y forma de las funciones nuevas ──
select pg_temp.espera(bool_and(not has_function_privilege('anon', p.oid, 'execute')
                             and not has_function_privilege('authenticated', p.oid, 'execute')
                             and has_function_privilege('service_role', p.oid, 'execute')
                             and not p.prosecdef and p.proconfig is not null),
                      'flujo: solo service_role ejecuta las funciones nuevas, security invoker y search_path fijo (' || count(*) || ' de 5)')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('guardar_recurrente','guardar_flujos_bono','guardar_escenario','guardar_flujo_real','flujos_reales_carga_valida');
select pg_temp.espera(count(*) = 5, 'flujo: están las cinco funciones nuevas')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('guardar_recurrente','guardar_flujos_bono','guardar_escenario','guardar_flujo_real','flujos_reales_carga_valida');
select pg_temp.espera(c.relrowsecurity, 'flujo: ' || c.relname || ' tiene RLS')
from pg_class c where c.relname in ('valores_recordados','flujos_reales') and c.relnamespace = 'public'::regnamespace;
select pg_temp.espera(not has_table_privilege('service_role', t, 'delete') and has_table_privilege('service_role', t, 'update')
                      and not has_table_privilege('anon', t, 'select') and not has_table_privilege('authenticated', t, 'select'),
                      'flujo: ' || t || ' sin borrado para el servidor y sin nada para anon ni authenticated')
from unnest(array['valores_recordados','flujos_reales']) t;
select pg_temp.espera(exists (select 1 from pg_trigger g where g.tgrelid = ('public.' || t)::regclass and g.tgname = 'auditar'
                              and (g.tgtype & 8) = 0),
                      'flujo: ' || t || ' tiene su trigger de auditoría, sin escuchar borrados')
from unnest(array['valores_recordados','flujos_reales']) t;
set role anon;
select pg_temp.espera_error_por($$select guardar_flujo_real('{}')$$, '42501', 'flujo: anon ejecuta guardar_flujo_real');
reset role;
set role authenticated;
select pg_temp.espera_error_por($$select guardar_escenario('{}')$$, '42501', 'flujo: authenticated ejecuta guardar_escenario');
reset role;

set role service_role;

-- ── F1: ingresos y gastos fijos ──
select (guardar_recurrente($j${"accion": "alta", "sentido": "ingreso", "concepto": "Prueba flujo ingreso USD", "moneda": "USD",
  "monto": "3100", "desde": "2026-10-01", "naturaleza": "honorarios"}$j$)->>'id')::bigint as ing1 \gset
select pg_temp.espera(naturaleza = 'honorarios' and monto::text = '3100' and vigente_hasta is null and anulado_en is null,
                      'guardar_recurrente: alta de un ingreso, con su naturaleza y el monto exacto')
from ingresos_fijos where id = :ing1;
select pg_temp.espera_error_por($$select guardar_recurrente($j${"accion": "alta", "sentido": "ingreso", "concepto": "Prueba flujo ingreso USD", "moneda": "USD",
  "monto": "3100", "desde": "2026-10-01"}$j$)$$, 'Ya tenés cargado', 'guardar_recurrente: un doble envío no duplica');
select pg_temp.espera_error_por($$select guardar_recurrente($j${"accion": "alta", "sentido": "ingreso", "concepto": "Prueba flujo", "moneda": "USD",
  "monto": 3100, "desde": "2026-10-01"}$j$)$$, 'viajan como texto', 'guardar_recurrente: monto como número JSON (D-32)');
select pg_temp.espera_error_por($$select guardar_recurrente($j${"accion": "alta", "sentido": "ingreso", "concepto": "Prueba flujo", "moneda": "USD",
  "monto": "100", "desde": "2026-10-01", "naturaleza": "propina"}$j$)$$, 'ingresos_fijos_naturaleza_check', 'guardar_recurrente: naturaleza que no existe');
select pg_temp.espera_error_por(format($$select guardar_recurrente('{"accion": "cambiar_desde", "sentido": "ingreso", "id": %s, "monto": "3500", "desde": "2026-09-01"}')$$, :ing1),
  'tiene que ser después', 'guardar_recurrente: un cambio con "desde" anterior a la vigencia');
select pg_temp.espera_error_por(format($$select guardar_recurrente('{"accion": "cambiar_desde", "sentido": "ingreso", "id": %s, "monto": "3500", "desde": "2026-10-01"}')$$, :ing1),
  'tiene que ser después', 'guardar_recurrente: un cambio el mismo día en que empieza');
select (guardar_recurrente(format('{"accion": "cambiar_desde", "sentido": "ingreso", "id": %s, "monto": "3500", "desde": "2027-02-01"}', :ing1)::jsonb)->>'id')::bigint as ing2 \gset
select pg_temp.espera((select vigente_hasta = '2027-01-31' from ingresos_fijos where id = :ing1)
                      and (select vigente_desde = '2027-02-01' and vigente_hasta is null and monto::text = '3500'
                                  and concepto = 'Prueba flujo ingreso USD' and moneda = 'USD' and naturaleza = 'honorarios'
                             from ingresos_fijos where id = :ing2),
                      'guardar_recurrente: cambiar desde feb-2027 cierra la fila el 31/01 y abre otra que hereda concepto, moneda y naturaleza');
select pg_temp.espera_error_por(format($$select guardar_recurrente('{"accion": "cambiar_desde", "sentido": "ingreso", "id": %s, "monto": "3600", "desde": "2027-05-01", "moneda": "EUR"}')$$, :ing2),
  'ingresos_fijos_moneda_check', 'guardar_recurrente: un cambio inválido no cierra nada (todo o nada)');
select pg_temp.espera((select vigente_hasta is null from ingresos_fijos where id = :ing2),
                      'guardar_recurrente: después del rechazo la fila sigue vigente');
select (guardar_recurrente($j${"accion": "alta", "sentido": "gasto", "concepto": "Prueba flujo seguro", "moneda": "ARS",
  "monto": "240000", "desde": "2026-10-01", "frecuencia": "trimestral", "primer_mes": "2026-11-01"}$j$)->>'id')::bigint as gas1 \gset
select pg_temp.espera(frecuencia = 'trimestral' and primer_mes = '2026-11-01' and categoria is null,
                      'guardar_recurrente: gasto trimestral con su primer mes y sin categoría')
from gastos_fijos where id = :gas1;
select pg_temp.espera_error_por($$select guardar_recurrente($j${"accion": "alta", "sentido": "gasto", "concepto": "Prueba flujo patente", "moneda": "ARS",
  "monto": "90000", "desde": "2026-10-01", "frecuencia": "anual"}$j$)$$, 'gastos_fijos_frecuencia_con_mes', 'guardar_recurrente: un gasto anual sin primer mes');
select pg_temp.espera_error_por($$select guardar_recurrente($j${"accion": "alta", "sentido": "gasto", "concepto": "Prueba flujo patente", "moneda": "ARS",
  "monto": "90000", "desde": "2026-10-01", "frecuencia": "anual", "primer_mes": "2026-11-15"}$j$)$$, 'gastos_fijos_primer_mes_check', 'guardar_recurrente: un primer mes que no es día 1');
select pg_temp.espera_ok(format($$select guardar_recurrente('{"accion": "anular", "sentido": "gasto", "id": %s}')$$, :gas1), 'guardar_recurrente: anular un gasto');
select pg_temp.espera(anulado_en is not null, 'guardar_recurrente: el gasto anulado queda, marcado') from gastos_fijos where id = :gas1;
select pg_temp.espera_error_por(format($$select guardar_recurrente('{"accion": "cerrar", "sentido": "gasto", "id": %s, "hasta": "2027-01-31"}')$$, :gas1),
  'ya está anulado', 'guardar_recurrente: no se toca un gasto anulado');
select pg_temp.espera_error_por(format($$select guardar_recurrente('{"accion": "cerrar", "sentido": "ingreso", "id": %s, "hasta": "2027-01-01"}')$$, :ing2),
  'anterior a la vigencia', 'guardar_recurrente: cerrar antes de que empiece');

-- ── F2: el pago al vencimiento, con su fuente ──
select pg_temp.espera(guardar_flujos_bono(pg_temp_j) = 1, 'guardar_flujos_bono: graba el pago al vencimiento por 1 VN')
from (select format('{"activo_id": %s, "fuente": "aviso de licitación (inventado)", "flujos": [{"fecha": "2026-12-15", "interes": "0.1210", "amortizacion": "1"}]}',
                    (select id from activos where ticker = 'FLJLET'))::jsonb as pg_temp_j) x;
select pg_temp.espera(interes::text = '0.1210' and amortizacion::text = '1' and fuente = 'aviso de licitación (inventado)',
                      'guardar_flujos_bono: interés y amortización exactos, con la fuente')
from flujos_bono where activo_id = (select id from activos where ticker = 'FLJLET');
select guardar_flujos_bono(format('{"activo_id": %s, "fuente": "corregido", "flujos": [{"fecha": "2026-12-15", "interes": "0.1215", "amortizacion": "1"}]}',
                    (select id from activos where ticker = 'FLJLET'))::jsonb) as n_flujos \gset
select pg_temp.espera(:n_flujos = 1 and count(*) = 1 and min(interes)::text = '0.1215' and min(fuente) = 'corregido',
                      'guardar_flujos_bono: grabar de nuevo corrige (upsert por fecha), no duplica')
from flujos_bono where activo_id = (select id from activos where ticker = 'FLJLET');
select pg_temp.espera_error_por(format($$select guardar_flujos_bono('{"activo_id": %s, "fuente": "x", "flujos": [{"fecha": "2027-01-15", "amortizacion": "1"}]}')$$,
                    (select id from activos where ticker = 'FLJCED')), 'no es un bono ni una letra', 'guardar_flujos_bono: un activo que no es bono ni letra');
select pg_temp.espera_error_por(format($$select guardar_flujos_bono('{"activo_id": %s, "fuente": "x", "flujos": [{"fecha": "2027-01-15", "amortizacion": "1"}]}')$$,
                    (select id from activos where ticker = 'FLJLET')), 'posterior al vencimiento', 'guardar_flujos_bono: un pago después del vencimiento');
select pg_temp.espera_error_por(format($$select guardar_flujos_bono('{"activo_id": %s, "flujos": [{"fecha": "2026-12-15", "amortizacion": "1"}]}')$$,
                    (select id from activos where ticker = 'FLJLET')), 'Falta la fuente', 'guardar_flujos_bono: sin fuente');

-- ── F3: escenarios y valores recordados ──
select guardar_escenario($j${"nombre": "Prueba flujo base", "supuestos": {"v": 1, "horizonte_meses": 12},
  "recordados": {"devaluacion": "2", "retorno.cedear": "8.5"}}$j$) as esc1 \gset
select pg_temp.espera((select supuestos->>'horizonte_meses' = '12' and archivado_en is null from escenarios where id = :esc1)
                      and (select count(*) = 2 from valores_recordados where variable in ('devaluacion','retorno.cedear'))
                      and (select valor::text = '8.5' from valores_recordados where variable = 'retorno.cedear'),
                      'guardar_escenario: alta con sus supuestos y los valores recordados');
select guardar_escenario(format('{"id": %s, "nombre": "Prueba flujo base", "supuestos": {"v": 1, "horizonte_meses": 24}, "recordados": {"devaluacion": "2.5"}}', :esc1)::jsonb) as esc1b \gset
select pg_temp.espera(:esc1b = :esc1
                      and (select valor::text = '2.5' from valores_recordados where variable = 'devaluacion')
                      and (select count(*) = 1 from valores_recordados where variable = 'devaluacion')
                      and (select supuestos->>'horizonte_meses' = '24' from escenarios where id = :esc1),
                      'guardar_escenario: cambiar por id pisa los supuestos y el valor recordado (upsert), no lo duplica');
select pg_temp.espera_error_por($$select guardar_escenario('{"nombre": "Prueba flujo sin v", "supuestos": {"horizonte_meses": 12}}')$$,
  'versión', 'guardar_escenario: supuestos sin versión');
select pg_temp.espera_error_por($$insert into escenarios (nombre, supuestos) values ('Prueba flujo directo', '{"v": "1"}')$$,
  'escenarios_supuestos_con_version', 'escenarios: el check exige una versión numérica');
select pg_temp.espera_error_por($$select guardar_escenario('{"nombre": "Prueba flujo base", "supuestos": {"v": 1}}')$$,
  'Ya tenés un escenario', 'guardar_escenario: nombre repetido');
select pg_temp.espera_error_por($$select guardar_escenario('{"nombre": "Prueba flujo x", "supuestos": {"v": 1}, "recordados": {"Devaluación": "2"}}')$$,
  'valores_recordados_variable_check', 'guardar_escenario: una clave de variable inválida');
select pg_temp.espera(not exists (select 1 from escenarios where nombre = 'Prueba flujo x'),
                      'guardar_escenario: un valor recordado inválido no deja el escenario a medias');
select guardar_escenario(format('{"accion": "archivar", "id": %s}', :esc1)::jsonb) as esc1c \gset
select pg_temp.espera(:esc1c = :esc1 and archivado_en is not null, 'guardar_escenario: archivar (no hay borrar)') from escenarios where id = :esc1;
select guardar_escenario(format('{"accion": "desarchivar", "id": %s}', :esc1)::jsonb) as esc1d \gset
select pg_temp.espera(:esc1d = :esc1 and archivado_en is null, 'guardar_escenario: desarchivar') from escenarios where id = :esc1;
select pg_temp.espera_error_por($$delete from valores_recordados$$, '42501', 'valores_recordados: el servidor no borra');

-- ── F4: Cargar ingreso / Cargar gasto ──
select count(*) as aud0 from auditoria \gset
select guardar_flujo_real($j${"lote": "f1000000-0000-4000-8000-0000000000f1", "fecha": "2026-11-30", "sentido": "ingreso",
  "concepto": "mensual", "moneda": "USD", "monto": "3100", "cuenta_id": 3, "cripto_usado": "1541.20", "pesos_recibidos": "4777720"}$j$) as r1 \gset
select (:'r1'::jsonb->>'carga_id')::bigint as c1, (:'r1'::jsonb->>'flujo_id')::bigint as f1 \gset
select pg_temp.espera((:'r1'::jsonb->>'movimiento') = 'aporte' and (:'r1'::jsonb->>'repetido')::boolean = false
                      and (select origen = 'manual' and cuenta_id is null and lector = 'flujo_real' and estado = 'vigente'
                                  and grabado->'flujos_reales'->0->>'monto' = '3100' from cargas where id = :c1),
                      'guardar_flujo_real: una carga manual con lo grabado');
select pg_temp.espera(sentido = 'ingreso' and concepto = 'mensual' and monto::text = '3100' and cripto_usado::text = '1541.20'
                      and pesos_recibidos::text = '4777720' and cuenta_id = 3 and carga_id = :c1,
                      'guardar_flujo_real: la fila, exacta')
from flujos_reales where id = :f1;
select pg_temp.espera(count(*) = 1 and min(tipo) = 'aporte' and min(cuenta_destino_id) = 3 and min(moneda_origen) = 'USD'
                      and min(monto_origen)::text = '3100' and min(moneda_destino) = 'ARS' and min(monto_destino)::text = '4777720'
                      and min(tc_aplicado)::text = '1541.20',
                      'guardar_flujo_real: en la misma transacción, el aporte a la cuenta (US$ vendidos al cripto, entran pesos)')
from movimientos_capital where carga_id = :c1;
select pg_temp.espera((guardar_flujo_real($j${"lote": "f1000000-0000-4000-8000-0000000000f1", "fecha": "2026-11-30", "sentido": "ingreso",
  "concepto": "mensual", "moneda": "USD", "monto": "3100", "cuenta_id": 3, "cripto_usado": "1541.20", "pesos_recibidos": "4777720"}$j$)->>'repetido')::boolean
                      and (select count(*) = 1 from flujos_reales where carga_id = :c1)
                      and (select count(*) = 1 from movimientos_capital where carga_id = :c1),
                      'guardar_flujo_real: el mismo lote dos veces no duplica (devuelve repetido)');
select pg_temp.espera_error_por($$select guardar_flujo_real($j${"lote": "f2000000-0000-4000-8000-0000000000f2", "fecha": "2026-11-30", "sentido": "ingreso",
  "concepto": "mensual", "moneda": "USD", "monto": "3100", "cuenta_id": 3, "cripto_usado": "1541.20", "pesos_recibidos": "4700000"}$j$)$$,
  'no cierran', 'guardar_flujo_real: los pesos no cierran con US$ × cripto');
select pg_temp.espera_ok($$select guardar_flujo_real($j${"lote": "f3000000-0000-4000-8000-0000000000f3", "fecha": "2026-11-30", "sentido": "ingreso",
  "concepto": "extraordinario", "moneda": "USD", "monto": "100", "cuenta_id": null, "cripto_usado": "1541.2", "pesos_recibidos": "154124"}$j$)$$,
  'guardar_flujo_real: pesos dentro de la tolerancia de los decimales tipeados (D-37)');
select pg_temp.espera_error_por($$select guardar_flujo_real($j${"lote": "f4000000-0000-4000-8000-0000000000f4", "fecha": "2026-11-30", "sentido": "ingreso",
  "concepto": "mensual", "moneda": "USD", "monto": "100", "cripto_usado": "1541.20"}$j$)$$,
  'van juntos', 'guardar_flujo_real: cripto sin pesos');
select pg_temp.espera_error_por($$select guardar_flujo_real($j${"lote": "f4000000-0000-4000-8000-0000000000f4", "fecha": "2026-11-30", "sentido": "gasto",
  "concepto": "extraordinario", "moneda": "ARS", "monto": "100", "cripto_usado": "1541.20", "pesos_recibidos": "154120"}$j$)$$,
  'solo con dólares', 'guardar_flujo_real: cripto en un gasto');
select pg_temp.espera_error_por($$select guardar_flujo_real($j${"lote": "f4000000-0000-4000-8000-0000000000f4", "fecha": "2026-11-30", "sentido": "ingreso",
  "concepto": "sueldo", "moneda": "ARS", "monto": "100"}$j$)$$,
  'concepto', 'guardar_flujo_real: concepto que no es mensual ni extraordinario');
select pg_temp.espera_error_por($$select guardar_flujo_real($j${"lote": "f4000000-0000-4000-8000-0000000000f4", "fecha": "2026-11-30", "sentido": "ingreso",
  "concepto": "mensual", "moneda": "ARS", "monto": "0"}$j$)$$,
  'mayor que cero', 'guardar_flujo_real: monto cero');
select pg_temp.espera(not exists (select 1 from cargas where lote in ('f2000000-0000-4000-8000-0000000000f2','f4000000-0000-4000-8000-0000000000f4')),
                      'guardar_flujo_real: los rechazos no dejan carga');
select guardar_flujo_real($j${"lote": "f5000000-0000-4000-8000-0000000000f5", "fecha": "2026-11-28", "sentido": "gasto",
  "concepto": "extraordinario", "moneda": "ARS", "monto": "350000", "cuenta_id": 2}$j$) as r5 \gset
select pg_temp.espera((:'r5'::jsonb->>'movimiento') = 'retiro'
                      and (select count(*) = 1 and min(tipo) = 'retiro' and min(cuenta_origen_id) = 2 and min(monto_origen)::text = '350000'
                             from movimientos_capital where carga_id = (:'r5'::jsonb->>'carga_id')::bigint),
                      'guardar_flujo_real: un gasto que sale de una cuenta graba el retiro');
select pg_temp.espera_error_por(format($$insert into flujos_reales (fecha, sentido, concepto, moneda, monto, carga_id) values ('2026-11-30','ingreso','mensual','ARS',1,%s)$$,
                    (select max(id) from cargas where lector is distinct from 'flujo_real' and cuenta_id is not null)),
  'no es una carga manual', 'flujos_reales: la carga tiene que ser manual (trigger carga_valida)');
select pg_temp.espera_error_por($$insert into flujos_reales (fecha, sentido, concepto, moneda, monto, carga_id) values ('2026-11-30','ingreso','mensual','ARS',1,999999999)$$,
  'no existe', 'flujos_reales: una carga que no existe (trigger carga_valida)');
select pg_temp.espera_error_por(format($$update flujos_reales set anulado_en = now() where id = %s$$, :f1),
  'flujos_reales_anula_afuera', 'flujos_reales: lo que entró a una cuenta no se anula (se deshace)');
select pg_temp.espera_ok($$update flujos_reales set anulado_en = now() where carga_id = (select id from cargas where lote = 'f3000000-0000-4000-8000-0000000000f3')$$,
  'flujos_reales: se anula lo que entró afuera');
select pg_temp.espera_error_por($$delete from flujos_reales$$, '42501', 'flujos_reales: el servidor no borra');
select pg_temp.espera(count(*) > :aud0, 'flujos_reales: la auditoría registra lo grabado') from auditoria;

-- Deshacer = revertir el lote (las reglas de Registro): se va el aporte, la carga queda revertida
-- y la fila queda sin contar (sin clave foránea a cargas, revertir_lote no se frena).
select pg_temp.espera_ok($$select revertir_lote('f1000000-0000-4000-8000-0000000000f1', 'prueba de Deshacer')$$,
  'Deshacer: revertir_lote revierte el lote de un ingreso que entró a una cuenta');
select pg_temp.espera((select estado = 'revertida' from cargas where id = :c1)
                      and not exists (select 1 from movimientos_capital where carga_id = :c1)
                      and exists (select 1 from flujos_reales where id = :f1),
                      'Deshacer: el aporte se fue, la carga quedó revertida y la fila sigue (el lector la ignora)');
select pg_temp.espera_error_por($$select guardar_flujo_real($j${"lote": "f1000000-0000-4000-8000-0000000000f1", "fecha": "2026-11-30", "sentido": "ingreso",
  "concepto": "mensual", "moneda": "USD", "monto": "3100", "cuenta_id": 3, "cripto_usado": "1541.20", "pesos_recibidos": "4777720"}$j$)$$,
  'se deshizo', 'guardar_flujo_real: un lote deshecho no se vuelve a grabar solo');
select pg_temp.espera_ok($$select revertir_lote('f5000000-0000-4000-8000-0000000000f5', 'prueba')$$, 'Deshacer: el gasto con retiro');
select pg_temp.espera_ok($$select revertir_lote('f3000000-0000-4000-8000-0000000000f3', 'prueba')$$, 'Deshacer: el ingreso afuera');
reset role;
