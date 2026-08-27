# Corte

Libro líquido personal. Consolida **FIMA** y **broker** sin unificar las cuentas. Cargás un corte (foto o CSV), ves ARS/USD, simulás mix/aporte/MEP, y pedís un memo al modelo.

**Las órdenes las ejecutás vos en la plataforma. La app no opera.**

Uso: una sola persona. **No hay login.** Quien tenga la URL ve y puede cambiar el mismo libro — no la compartas.

No es consejo financiero.

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/` Libro | Último corte, ARS/USD, MEP (dolarapi), underlyings Yahoo |
| `/cargar` | Foto o CSV → parseo → confirmás especie/monto → grabás un corte |
| `/escenarios` | Mix objetivo (glide path), aporte USD/mes, MEP, rebalance, oso/base/toro |
| `/asesor` | Memo de Grok atado al libro + números del motor. No ejecuta |

Hay un corte de ejemplo (26 ago 2026) para entrar de una.

## Stack

- TanStack Start (React) + Tailwind
- Postgres: Neon en deploy Grok, PGLite en preview local
- IA: `XAI_API_KEY` en servidor (`grok-4.5`) para parseo de foto y memo
- Mercado: [dolarapi.com/bolsa](https://dolarapi.com/v1/dolares/bolsa) + Yahoo chart (cedears)

Auth **off**. Filas con `user_id = 'me'` (`src/lib/owner.ts`).

## Datos

`migrations/0002_portfolio.sql` (también `supabase/schema.sql`):

- `snapshots` — un corte (fecha, MEP, origen fima/broker/mixed)
- `positions` — filas del corte (especie, ARS, plataforma, kind)
- `settings` — aporte, MEP, meses, USA %, rebalance, mix objetivo
- `memos` — textos del asesor

Catálogo de especies: FIMA Premium / PB Acciones / Renta Plus, T30J7, cedears MU GOOGL MELI XOM ANET, USD, pesos en caja.

## Motor

Determinístico. El modelo **no** inventa los USD finales: los lee del motor.

- Aporte mensual en USD convertido al MEP de ese mes
- Mix interpola lineal del corte de hoy al mix objetivo
- Escenarios: oso (MEP 2600, USA −12%), base (MEP 2200, USA parametrizable), toro (MEP 1900, USA +22%)
- T30J7: carry hasta jun-27, después liquidez
- Cedears: retorno USA × crawl del MEP

## Asesor

Botón explícito. Prompt con corte + motor + plantilla: supuestos, tesis, escenarios, qué lo invalida, acción humana. Si un dato no está en el prompt, tiene que decirlo.

## Supabase (opcional)

1. Proyecto nuevo → SQL Editor → `supabase/schema.sql`
2. `DATABASE_URL` = URI **directa** (5432, session). No Transaction pooler.
3. Lo simple: publicar desde Grok. El Neon del deploy ya persiste.
