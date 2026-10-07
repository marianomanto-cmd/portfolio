# App de gestión de inversiones — especificación

> Spec original del dueño (2026-10-07). Las decisiones que lo ajustan están en `docs/decisiones.md`.

Aplicación web para gestionar una cartera de inversiones personal. El dueño carga la información todos los días y la app calcula posición, exposición y proyecciones con supuestos variables.

## Contexto
Argentino, Córdoba. La plata se mueve en dos monedas a la vez:
* Ingresos en dólares (traídos de afuera y vendidos a dólar cripto) más un monto fijo en pesos.
* CEDEARs: cotizan en pesos pero valen dólares.
* Bonos y letras en pesos.
* Deuda grande en pesos a cuota fija (leasing de una camioneta).

Cualquier número en una sola moneda está mal. Toda posición, resultado y proyección existe a la vez en pesos y en dólares, y la app separa cuánto de un resultado vino del activo y cuánto del tipo de cambio. Si subo 10% en pesos pero el CCL subió 12%, perdí plata en dólares.

## Stack
* Supabase (PostgreSQL vía PostgREST). Vercel, Next.js App Router, TypeScript.
* Cálculos en server components / route handlers o funciones puras testeadas, nunca inline en el JSX.
* Un solo usuario. Protección: clave simple.
* Todo cambio de schema = migración versionada en `supabase/migrations`. La base se reconstruye de cero.
* RLS activado en todas las tablas desde la primera migración.
* `service_role` sólo en el servidor (env de Vercel).
* Tipos TS generados desde el schema.
* Un solo entorno: producción.

## Requisito que hace o rompe el producto
La carga diaria tarda menos de 60 segundos.
* Una sola pantalla de carga, no un wizard.
* Un campo para el CCL del día y uno para el dólar cripto. Con eso se recalcula todo.
* Parseo de lo que da el bróker; la app muestra lo que entendió para confirmar antes de guardar.
* Lo que no cambió no se vuelve a cargar. Precios de ayer = último valor conocido, marcados como viejos.
* Tab entre campos, Enter para guardar.

## Modelo de datos (punto de partida del dueño)
activos, cotizaciones (único fecha+activo), tipo_cambio (ccl, mep, cripto_venta, oficial — cripto_venta manda para ingresos), operaciones (con ccl_del_dia: sin eso no hay PPC en USD), niveles, pasivos, pasivo_cuotas, gastos_fijos, flujo_mensual, escenarios (supuestos jsonb), vencimientos (destino_decidido).

Las posiciones no son tabla: se derivan de `operaciones`. CEDEAR: `precio_subyacente_usd × tipo_cambio ÷ ratio_cedear`; el ratio es editable con historial.

## Secciones
1. **Hoy** — patrimonio ARS y USD lado a lado; variación del día desglosada en activo vs. tipo de cambio; exposición neta al peso; próximos vencimientos y alertas; excedente invertible del mes.
2. **Carga diaria** — la pantalla de 60 segundos.
3. **Exposición** — los pasivos netean contra los activos (deuda en pesos a tasa fija = posición corta en pesos). Activos ARS / pasivos ARS / neto; activos USD; apertura por clase, moneda y geografía (AR/US/BR/global); concentración (top 1, top 3); evolución de la exposición neta (área apilada).
4. **Cartera** — tabla densa: cantidad · PPC ARS · PPC USD · precio · resultado ARS ($ y %) · resultado USD ($ y %) · desglose activo vs. TC · % cartera · días en posición. Ordenable, totales fijos abajo.
5. **Pasivos** — cuadro de marcha; cuota en pesos (plana) vs. en dólares (cae) en el mismo eje; pagado y faltante en ARS y en USD al TC de cada fecha; IVA y Ganancias recuperados; opción de compra; costo total vs. valor del bien.
6. **Flujo de caja** — ingresos (USD × cripto_venta + pesos fijos) − gastos fijos − cuotas = excedente invertible, que alimenta las proyecciones. Historial mensual, proyectado vs. real.
7. **Proyecciones** — senda de TC por tramos, aporte USD con crecimiento, retorno y volatilidad por clase, TEM por bono, inflación, horizonte, shock de ingresos desde el mes N. Salidas: patrimonio ARS/USD, Monte Carlo t-Student con p5/p25/p50/p75/p95 en abanico, mes de cobertura de cuota, probabilidad de terminar debajo del capital aportado. Escenarios guardados con nombre y comparables superpuestos.
8. **Niveles y disciplina** — nivel decidido + tesis antes de comprar; precio real al ejecutar; diferencia %; marcador de cuántas veces se respetó el nivel y cuánto costó no respetarlo en pesos; pendientes; invalidaciones perforadas con alerta.
9. **Rendimientos** — TIR realizada por instrumento; rutina de liquidez entre dos cuentas remuneradas (TNA combinada neta de impuesto a las transferencias); cada decisión contra SPY en dólares.
10. **Calendario** — vencimientos, balances, cuotas, eventos macro manuales. Alerta si un vencimiento está a < 15 días sin `destino_decidido`.

## Trazabilidad (no negociable)
Todo número calculado muestra de dónde salió (hover/click: fórmula con valores concretos). Cálculos en funciones puras con tests: TIR, TEM, PPC en dos monedas, desglose activo/TC, valor técnico CER. Falta un dato → "sin dato", nunca cero ni estimado. Precio de más de 2 días → marcado como viejo.

## UI
Ancho completo, sin max-width. Nav lateral izquierda colapsable a iconos. Light/dark según sistema con toggle. Números monoespaciados, `tabular-nums`, a la derecha. Pesos y dólares distinguibles sin leer el símbolo, consistente en toda la app. 25 filas sin scroll. Positivo/negativo por color y por signo. Sin tortas (barras apiladas horizontales o treemap); área apilada para composición en el tiempo; abanico para Monte Carlo; log cuando el rango lo pide; mismo color por activo en todos los gráficos.

## Qué NO
Sin APIs de brókers ni de precios en la v1. No inventar ni estimar precios. No guardar posiciones como tabla. Sin max-width. Sin tortas. Sin hardcodear ratios, cotizaciones ni tipos de cambio. Sin multiusuario. Sin recomendaciones de compra.

## Fases
1. **Núcleo** — schema, carga diaria, cartera doble moneda con desglose, exposición con pasivos neteados.
2. **Contexto** — pasivos y licuación, flujo de caja, calendario con alertas.
3. **Motor** — proyecciones, escenarios, Monte Carlo, cobertura de cuota.
4. **Disciplina** — niveles, rendimientos realizados, benchmark SPY.

Cada fase funcionando y desplegada antes de la siguiente.
