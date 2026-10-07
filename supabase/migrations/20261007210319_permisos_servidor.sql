-- Permisos mínimos para el servidor (service_role).
--
-- Supabase otorga por defecto a service_role TODOS los privilegios sobre todo
-- objeto nuevo que crea `postgres` en public (ALTER DEFAULT PRIVILEGES con
-- arwdDxtm). Eso incluye TRUNCATE, que vacía una tabla sin disparar el trigger
-- de auditoría, y escritura sobre la propia auditoría, que tiene que ser
-- append-only (D-17).
--
-- Regla desde acá: service_role no recibe nada por defecto. Cada migración
-- que crea objetos otorga explícitamente lo que hace falta.

alter default privileges in schema public revoke all on tables    from service_role;
alter default privileges in schema public revoke all on sequences from service_role;
alter default privileges in schema public revoke all on functions from service_role;

revoke all on all tables    in schema public from service_role;
revoke all on all sequences in schema public from service_role;
revoke all on all functions in schema public from service_role;

grant usage on schema public to service_role;

-- Datos: leer y escribir fila por fila (cada cambio pasa por la auditoría).
grant select, insert, update, delete on table
  cuentas, activos, condiciones_bono, ratios_cedear, flujos_bono, feriados,
  cargas, tipo_cambio, cotizaciones, indices, operaciones, saldos_liquidez,
  movimientos_capital, pasivos, pasivo_cuotas, pasivo_saldos, bienes,
  bienes_valuaciones, niveles, nivel_operaciones, ingresos_fijos, gastos_fijos,
  flujo_mensual, escenarios, vencimientos, eventos
  to service_role;

-- Auditoría y vistas: sólo lectura.
grant select on table auditoria, v_tenencias, v_ultima_cotizacion, v_ultimo_saldo to service_role;

-- Identidades: las secuencias se usan al insertar.
grant usage, select on all sequences in schema public to service_role;
