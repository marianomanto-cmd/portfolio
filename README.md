# Corte

Libro líquido personal. Consolida **FIMA** y **broker** sin unificar las cuentas. Cargás un corte (foto o CSV), ves ARS/USD, simulás mix/aporte/MEP, y pedís un memo al modelo.

**Las órdenes las ejecutás vos en la plataforma. La app no opera.**

Uso: una sola persona. **No hay login.** Quien tenga la URL ve y puede cambiar el mismo libro — no la compartas.

No es consejo financiero.

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/` Libro | Último corte, ARS/USD, MEP del corte vs. dolarapi, underlyings de Yahoo |
| `/cargar` | Foto o CSV → parseo → confirmás especie/monto → grabás un corte |
| `/escenarios` | Mix objetivo (glide path), aporte USD/mes, MEP, rebalance, oso/base/toro |
| `/asesor` | Memo atado al libro + números del motor. No ejecuta |

## Stack

- Next.js (App Router) + React + Tailwind v4, deploy en Vercel
- Postgres: schema `corte` en Supabase, por `pg` con el Transaction pooler
- IA: `XAI_API_KEY` en servidor (`grok-4.5`) para el parseo de foto y el memo
- Mercado: [dolarapi bolsa](https://dolarapi.com/v1/dolares/bolsa) + Yahoo chart

Auth **off**. Filas con `user_id = 'me'` (`src/lib/owner.ts`).

## Variables de entorno

Las dos van en el proyecto de Vercel. Ninguna se expone al browser.

| Var | Para qué | Sin ella |
|---|---|---|
| `DATABASE_URL` | Postgres del schema `corte` | Las pantallas muestran un aviso de setup, no rompen |
| `XAI_API_KEY` | Parseo de foto y memo | El CSV y la carga a mano siguen andando; el botón de memo se apaga |

`DATABASE_URL` **tiene** que apuntar al Transaction pooler (puerto 6543). No es preferencia: `db.<ref>.supabase.co` resuelve sólo a IPv6 y las funciones de Vercel salen por IPv4, así que la conexión directa al 5432 no conecta desde el deploy. El host exacto del pooler está en el dashboard de Supabase → Connect. `pg` no usa prepared statements con nombre salvo que se los pidas, así que el modo transacción anda sin configuración extra.

La app se conecta con el rol **`corte_app`**, no con `postgres`. Ese rol existe sólo para esto: alcanza el schema `corte` y nada más — sobre las tablas de `public` no tiene ningún privilegio. Así la credencial del libro es independiente de la de la otra app que vive en el mismo proyecto, y rotarla no rompe nada más.

## Datos

`supabase/schema.sql` — bootstrap del schema `corte`:

- `instruments` — catálogo de especies. Un papel nuevo va acá **primero**: `positions` tiene FK contra esta tabla, así que nada entra al libro sin estar en el catálogo
- `snapshots` — un corte (fecha, MEP, origen fima/broker/mixed)
- `positions` — filas del corte (especie, ARS, plataforma, kind, cantidad)
- `settings` — aporte, MEP, meses, USA %, tasa en pesos %, rebalance, mix objetivo
- `memos` — textos del asesor

Vive en el schema `corte` y no en `public` porque el proyecto de Supabase donde está aplicado también hospeda otra app. RLS está prendido en las cinco tablas, con una única política por tabla dirigida al rol `corte_app`. Anon y authenticated no tienen ninguna, así que nada de esto es alcanzable por PostgREST; `corte_app` no es dueño de las tablas y no tiene `BYPASSRLS`, o sea que el acceso pasa por la política y no por privilegio de owner.

Catálogo inicial: FIMA Premium / PB Acciones / Renta Plus, T30J7, cedears MU GOOGL MELI XOM ANET, USD, pesos en caja.

## Motor

Determinístico y puro (`src/lib/engine.ts`). El modelo **no** inventa los USD finales: los lee del motor. Corre igual en el server (para el memo) que en el browser (para que los controles de `/escenarios` respondan al toque).

- Aporte mensual en USD convertido al MEP de ese mes
- El MEP interpola lineal del corte de hoy al del escenario
- Mix interpola lineal del mix de hoy al mix objetivo. Sin rebalanceo sólo el aporte nuevo empuja hacia el objetivo; con rebalanceo la cartera se lleva al mix cada mes
- Escenarios: oso (MEP 2600, USA −12%), base (MEP 2200, USA parametrizable), toro (MEP 1900, USA +22%)
- Cedears: retorno USA × crawl del MEP. Dólares: siguen al MEP. Fondos y caja: tasa en pesos
- Bonos: carry a la tasa en pesos hasta el vencimiento del catálogo (T30J7, jun-27) y después liquidez. Vencido, el mix objetivo reparte su peso entre el resto: no se repone una clase que ya no existe

## Asesor

Botón explícito, nada corre en loop. El prompt lleva el corte, los supuestos y los tres escenarios ya calculados, más la plantilla fija: supuestos, tesis, escenarios, qué la invalida, acción humana. Si un dato no está en el prompt, tiene que decirlo en vez de estimarlo.

## Local

```bash
npm install
cp .env.example .env    # completá DATABASE_URL y XAI_API_KEY
npm run dev
```

`npm run build` levanta sin ninguna env var: las cuatro pantallas son dinámicas y degradan a un aviso de setup, así que el deploy nunca falla por una variable que falta.
