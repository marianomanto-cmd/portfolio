# Corte

Libro líquido personal: consolidás FIMA + broker sin unificar las cuentas. Cargás un corte (foto o CSV), ves ARS/USD, corrés escenarios de mix/aporte/MEP, y pedís un memo al modelo. **Las órdenes las ejecutás vos en la plataforma.**

La app corre en el preview/deploy de Grok (TanStack Start + Postgres + Better Auth). Este repo guarda el esquema para que puedas montar el mismo Postgres en Supabase.

## Stack

TanStack Start (React) + Postgres. En Grok: Neon + Better Auth (Google, X, email). El SQL de `supabase/schema.sql` corre en **Supabase**.

## Supabase

1. New project.
2. SQL Editor: ejecutá `supabase/schema.sql` (tablas de cortes, posiciones, settings, memos).
3. Si más adelante apuntás un deploy propio: `DATABASE_URL` = URI de Postgres **directa** (puerto 5432, session mode, no Transaction pooler).
4. Google/X en un Vercel independiente necesitan el broker de Grok. Email/password está habilitado en la app.
5. Lo simple: **publicar desde Grok**. Supabase es el Postgres en tu cuenta cuando lo cableemos.

## Uso

1. Entrá (Google, X o email).
2. **Cargar**: foto de FIMA/broker o CSV. Confirmá especies.
3. **Libro**: corte + MEP (dolarapi) + underlyings Yahoo.
4. **Escenarios**: mix, aporte, MEP, rebalance.
5. **Asesor**: memo atado al libro y al motor. No opera.

No es consejo financiero.
