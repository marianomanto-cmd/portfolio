#!/usr/bin/env bash
# Reconstruye la base de cero en un Postgres local, aplica todas las
# migraciones en orden y corre los tests del schema. Falla si algo falla.
#
# Uso: supabase/tests/run.sh   (requiere un Postgres accesible; ver PG* abajo)
set -euo pipefail
cd "$(dirname "$0")"
: "${PGHOST:=localhost}" "${PGPORT:=5432}" "${PGUSER:=postgres}"
export PGHOST PGPORT PGUSER
DB="schema_test_$$"
psql -X -q -d postgres -c "create database $DB"
trap 'psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
psql -X -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase_stub.sql
for f in ../migrations/*.sql; do
  psql -X -q -d "$DB" -v ON_ERROR_STOP=1 -1 -f "$f"
  echo "aplicada: $(basename "$f")"
done
out=$(psql -X -q -d "$DB" -tA -f schema_tests.sql 2>&1)
echo "$out"
if grep -q "FALLA" <<<"$out"; then echo "SCHEMA: HAY FALLAS"; exit 1; fi
echo "SCHEMA: OK ($(grep -c '^ok' <<<"$out") controles)"
