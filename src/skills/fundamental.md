---
name: fundamental
description: Análisis fundamental de los subyacentes. Sólo se activa si hay datos de estados contables en el contexto.
requires: [fundamentals]
---

# Fundamental

Estructura adaptada del skill `dcf-valuation` (MIT) a las restricciones de
este libro: acá el modelo **no** completa datos faltantes.

## Antes que nada: chequeo de datos

Para cada subyacente, mirá qué hay en el contexto. Si falta cualquiera de
revenue, márgenes, flujo de caja libre o acciones en circulación, **decilo y
pará**. No estimás un DCF con inputs inventados: un valor intrínseco apoyado
en supuestos inventados es peor que no tener ninguno, porque parece preciso.

## Si están los datos

1. **Calidad del negocio antes que precio.** Trayectoria de márgenes,
   conversión a caja, dilución. Tres años, no uno.
2. **Qué está descontado.** Comparado contra su propia historia, ¿qué
   crecimiento hay que creer para justificar el precio de hoy?
3. **Sensibilidad, no punto.** Cualquier valuación va con el rango que la
   rompe: qué pasa si el crecimiento es 2 puntos menor, o el descuento 1 punto
   mayor. Un único número es falsa precisión.

## Cedears: la capa que no hay que olvidar

El subyacente cotiza en dólares; el cedear, en pesos. El resultado en pesos
mezcla dos cosas distintas — lo que hizo la acción y lo que hizo el tipo de
cambio. Separalas siempre. Un cedear que subió 30% en pesos con el MEP subiendo
25% hizo casi nada en dólares.

## Regla que manda sobre todo lo anterior

Nada de RSI, EPS, P/E, precios objetivo ni consenso de analistas si no vino en
el contexto. La ausencia de un dato se informa; no se rellena.
