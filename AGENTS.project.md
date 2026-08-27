# Corte — instrucciones de producto

App personal de un solo usuario. **Auth OFF.** No agregar login, Google, X, email ni `authMiddleware` salvo que el dueño lo pida otra vez.

## Qué es

Libro líquido: FIMA + broker separados. Carga de corte (foto/CSV), libro ARS/USD, escenarios, memo. El dueño opera en las plataformas; la app no ejecuta órdenes.

## Contratos

- Persistencia: Postgres. Todas las filas van con `user_id = 'me'`. No hay multi-user.
- No login ni rutas `/api/auth`.
- Catálogo de especies en un solo lugar. Si entra un papel nuevo, actualizar catálogo y seed de ejemplo.
- Motor de escenarios determinístico. El LLM narra esos números; no los recalcula ni inventa RSI/EPS.
- Parseo de foto: el dueño confirma filas antes de grabar el corte.
- Mercado: dolarapi bolsa + Yahoo. Si falla, degradar (n/d), no crashear.
- Memo: user-initiated, plantilla fija (supuestos, escenarios, falsación, acción humana).
- UI: mobile-first, nav inferior, español rioplatense (vos).
- URL pública = el libro es escribible. No compartir el link.

## Fuera de alcance (hasta que lo pida)

Login, broker APIs, ejecución de órdenes, alertas push, multi-cuenta, skills de TA automáticos en loop.
