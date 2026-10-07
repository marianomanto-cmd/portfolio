-- Imita lo mínimo de Supabase que toca la migración: roles y storage.buckets.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
-- Supabase otorgaba por defecto todo a estos roles en public (comportamiento viejo).
-- Lo simulamos para verificar que la migración lo revoca bien.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
-- Comportamiento real observado en el proyecto (2026-10-07): postgres otorga
-- por defecto todo a service_role sobre objetos nuevos en public.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
