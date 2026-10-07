# Cambios

Todo cambio de la app se registra acá, el más nuevo primero. Cada entrada dice qué cambió y remite a la decisión (`docs/decisiones.md`) o a la sección del spec que lo motiva.

## [Sin publicar]

### 2026-10-07 — Reinicio: especificación, decisiones y schema
- **Reinicio del proyecto.** Se abandona Corte (D-01). Spec del dueño en `docs/spec.md`.
- **Proyecto Supabase dedicado** "Portfolio" (D-02).
- **Schema inicial** en `supabase/migrations/20261007000000_init.sql`, **todavía sin aplicar**: catálogo de activos con exposición por moneda y geografía, ratios de CEDEAR con historial, flujos de bonos, índices CER/TAMAR, cotizaciones normalizadas por 1 VN (D-12), operaciones con apertura sin CCL (D-14), saldos de liquidez (D-13), cargas trazables (D-11, D-17), pasivos, flujo de caja, escenarios, vencimientos y eventos. RLS en todo y la base cerrada a todo lo que no sea el servidor (D-20).
- **Decisiones registradas** en `docs/decisiones.md`: patrimonio total vs. financiero (D-03), bienes con valuación manual (D-04), tab Evolución y PnL (D-05), movimientos de capital (D-06), carga por Excel/captura con IA verificada (D-10, D-11), log de cargas y auditoría (D-17), clave simple (D-21), mobile sin scroll horizontal con test automático (D-30).
- **Escenarios ajustables** (D-08): lista completa de variables editables por escenario, tanteo en la URL, guardado con nombre, duplicado y comparación superpuesta. Cada variable se ajusta con botones Baja · Igual · Sube, con un deslizante para elegir cuánto en Sube/Baja y el valor visible en el botón.
- **En curso:** revisión del schema desde cuatro ángulos y verificación del stack de UI propuesto (D-31). Bienes, movimientos de capital, feriados y auditoría se suman a la migración cuando cierre la revisión.
