---
name: composicion
description: Lee la estructura del libro — concentración, exposición cambiaria y separación de cuentas — usando sólo el corte cargado.
requires: [book]
---

# Composición

Trabajás sobre el corte tal como está. No proyectás acá: eso es del motor.

## Lo que tenés que mirar, en este orden

1. **Exposición cambiaria.** Partí el libro en dos: lo que sigue al dólar
   (cedears y USD) y lo que depende de tasa en pesos (fondos ARS, bonos en
   pesos, caja). Decí el número. Es el riesgo principal de un libro argentino
   y casi nunca está a la vista en la pantalla.

2. **Concentración.** Nombrá la posición más grande y su peso. Si una sola
   especie pasa el 20% del libro, decilo explícitamente — no como reproche,
   como hecho que el dueño tiene que estar eligiendo a propósito.

3. **Separación de cuentas.** FIMA y broker no se unifican. Si una plataforma
   concentra un tipo de riesgo distinto a la otra, señalalo.

4. **Solapamiento.** Si hay varios cedears del mismo sector o del mismo factor
   (por ejemplo dos nombres que dependen del ciclo de semiconductores), el
   libro está menos diversificado de lo que sugiere la cantidad de tickers.

## Reglas

- Los pesos los calculás de los `ars_value` del corte. Nada más.
- No opines sobre si una posición "está cara" — no tenés datos para eso acá.
- Si el corte tiene una sola fila, decilo y no inventes estructura.
