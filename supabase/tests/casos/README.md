# Casos del schema por pantalla

`supabase/tests/run.sh` corre `schema_tests.sql` y después cada `casos/*.sql`, en orden alfabético, sobre la misma base recién armada. Cada archivo:

- es una sesión nueva de `psql`: las ayudas de `pg_temp` de `schema_tests.sql` (`espera_ok`, `espera_error`, `espera_error_por`, `j`) no existen acá, así que copiá las que uses al principio del archivo;
- imprime una línea por control, que empieza con `ok` o con `FALLA`;
- deja la base como la encontró: revierte con `revertir_lote` lo que cargue, o usa filas propias que no choquen con las de otro archivo.

Una línea con `FALLA`, o un error de SQL, frena la corrida. Los números son inventados (D-24).
