# Corte — instrucciones de producto

App personal de un solo usuario. **Auth OFF.** No agregar login, Google, X, email ni `authMiddleware` salvo que el dueño lo pida otra vez.

## Qué es

Libro líquido: FIMA + broker separados. Carga de corte (foto/CSV), libro ARS/USD, escenarios, memo. El dueño opera en las plataformas; la app no ejecuta órdenes.

## Contratos

- Persistencia: Postgres. Todas las filas van con `user_id = 'me'`. No hay multi-user.
- No login ni rutas `/api/auth`.
- Catálogo de especies en un solo lugar: la tabla `corte.instruments`. `positions` tiene FK contra ella, así que un papel que no esté en el catálogo no entra al libro. Si entra uno nuevo, se agrega ahí primero.
- Motor de escenarios determinístico. El LLM narra esos números; no los recalcula ni inventa RSI/EPS.
- Parseo de foto: el dueño confirma filas antes de grabar el corte.
- Mercado: dolarapi bolsa + Yahoo. Si falla, degradar (n/d), no crashear.
- Memo: user-initiated, plantilla fija (supuestos, escenarios, falsación, acción humana).
- UI: mobile-first, nav inferior, español rioplatense (vos).
- URL pública = el libro es escribible. No compartir el link.

## Dónde está cada cosa

- `src/lib/engine.ts` — motor. Puro, sin red ni DB. Corre igual en server y browser.
- `src/lib/queries.ts` — todo el acceso a datos. Los `numeric` de Postgres vuelven como string: se convierten acá y no más adelante.
- `src/lib/xai.ts` — único lugar que habla con el modelo. `XAI_API_KEY` nunca sale del server.
- `src/lib/csv.ts` — parseo de CSV local, sin modelo: un CSV es tabular y así el resultado es reproducible.
- `supabase/schema.sql` — bootstrap del schema `corte`, no una migración. Una columna nueva va con su propio `alter table`.

## Fuera de alcance (hasta que lo pida)

Login, broker APIs, ejecución de órdenes, alertas push, multi-cuenta, skills de TA automáticos en loop.
