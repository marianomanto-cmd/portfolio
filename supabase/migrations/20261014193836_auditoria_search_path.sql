-- La auditoría no se puede desviar a una tabla temporal (D-17).
--
-- registrar_auditoria() es SECURITY DEFINER y se creó con
-- `set search_path = public` (20261007205631_init.sql). Cuando pg_temp no
-- figura en el search_path, Postgres busca las tablas primero ahí. Una sesión
-- SQL con permiso de escritura (service_role, que puede crear tablas
-- temporales) que creaba una tabla temporal `auditoria` se llevaba las filas
-- de la auditoría: el cambio quedaba hecho y su registro se perdía al cerrar
-- la sesión.
--
-- Con pg_temp explícito y al final, como en el resto de las funciones,
-- `auditoria` es siempre public.auditoria. El cuerpo de la función no cambia.
-- Control: supabase/tests/schema_tests.sql ("auditoría: una tabla temporal…").

alter function public.registrar_auditoria() set search_path = public, pg_temp;
