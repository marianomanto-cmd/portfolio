#!/usr/bin/env python3
"""Implementación de referencia del motor de cartera (docs/calidad.md §1).

Es **independiente** del motor TypeScript (`src/lib/domain/`): se escribió solo
a partir de los documentos, antes de mirar ese código:

- `docs/spec.md` (manda);
- `docs/decisiones.md`: D-12 (precio por 1 VN), D-14 (aperturas), D-18 (valor de
  un CEDEAR = precio en pesos del bróker), D-19 (compra del día con costo
  pendiente), D-32 (montos exactos);
- `docs/datos.md`, "Formas válidas de una operación";
- `docs/investigacion-mercado.md` §6.1, D-35 (convención del desglose);
- `docs/vision.md` 4.1, 4.2, 4.5 y Apéndice B (ejemplos con números inventados).

Solo biblioteca estándar. Aritmética `decimal.Decimal` con 50 dígitos
significativos. "Sin dato" es `None` y se propaga: toda cuenta con un insumo
`None` da `None`, nunca 0. Los montos de entrada son `str` (nunca `float`).

Correr `python3 tests/referencia/motor_referencia.py` verifica la referencia
contra los ejemplos numéricos de D-35 y del Apéndice B de `vision.md`.

Decisiones de la fase 1a (provisorias, las tomó el responsable de la
integración y las confirma el dueño; ver docs/decisiones.md). Se codificaron
acá después del primer cruce y reemplazan a I-5, I-6, I-7, I-8 e I-10:

- A. Atribución anclada (visión 4.2, D-35). Una observación de una partida el
  día d es FRESCA si ese día se tipeó un CCL y además hay una cotización del
  activo de ese día, o la cantidad es 0 (cerrada o todavía no abierta). Con
  a0 = última fresca ≤ d0 y a1 = última fresca ≤ d1: si a1 > a0, activo y TC
  son D-35 sobre (a0, a1] (CCL tipeados en a0 y a1, flujos de (a0, a1] cada
  uno a su CCL) y sin atribuir = R − activo − TC; si no, activo = TC = 0 y
  todo es sin atribuir. R = V1 − V0 − ΣF como antes. Un período con cargas
  intermedias es la SUMA de los intervalos entre cargas consecutivas (una
  carga es cualquier fecha con un tipo de cambio o un precio). Los flujos son
  fijos: no dependen del intervalo.
- B. Sin CCL tipeado ese día, la foto usa el último tipeado (como un precio de
  ayer). La atribución no lo usa (A exige CCL tipeado).
- C. Compra con precio pendiente (D-19): su flujo se valúa al precio del día
  de la compra (la última cotización en o antes de esa fecha; si no hay, la
  primera posterior), marcado "inferido" en el motor.
- A (flujos fijos): una apertura dentro del intervalo entra a su valor del día
  de la apertura (cantidad × precio de ese día, al CCL de ese día; el CCL de
  compra declarado es para el PPC). El CCL de un flujo es el `ccl` de la
  operación; si no tiene, el tipeado ese día o el último anterior.
- E. Desde la compra: suma de los intervalos entre cargas desde la primera
  observación fresca de la tenencia, más un intervalo por lote antes de ella,
  desde su costo al CCL de compra hasta su valor en esa observación (visión 4.5
  y D-35 adoptada). Reemplaza a I-11 (CCL_prom queda solo si hubo una baja o un
  cambio de ratio antes de la primera observación).
- B07 (pedido explícito): un precio anterior a un cambio de ratio no sirve
  para la cantidad nueva: el valor es "sin dato".
- Una partida "sin dato" en un intervalo lo es en las dos monedas (como el
  motor: si falta el valor o un flujo, no hay resultado de esa partida).

Fórmulas
========

Tenencia y PPC (promedio ponderado, en ARS y en USD)
----------------------------------------------------
- `apertura`: costo ARS = cantidad × PPP del bróker (`precio`); `precio` NULL →
  costo "sin dato" (D-14). Costo USD = costo ARS ÷ `ccl` de la operación (el
  CCL de compra declarado); sin CCL → "sin dato".
- `compra`: costo ARS = `importe` si existe; si no, cantidad × precio +
  comisiones; con `precio` e `importe` NULL (compra del día, D-19) → "sin
  dato", pero la cantidad cuenta. Costo USD = costo ARS ÷ `ccl` de la operación.
- `venta`: la cantidad baja y el costo, en ARS y en USD, baja en proporción:
  costo × (cantidad después ÷ cantidad antes).
- `ajuste_ratio`: cambia la cantidad (con signo) y no toca el costo.
- PPC = costo ÷ cantidad.

Foto (valuación) a la fecha d
-----------------------------
valor ARS = cantidad × último precio en pesos por unidad con fecha ≤ d;
valor USD = valor ARS ÷ CCL de la fecha d.

Desglose de un intervalo t0 → t1 (D-35), por partida
----------------------------------------------------
V0, V1 = valor ARS en t0 y en t1; CCL0, CCL1 = CCL de t0 y de t1; F_i = flujos
del intervalo en ARS, cada uno con el CCL de su fecha, ccl_i.

    R_ars = V1 − V0 − ΣF_i
    R_usd = V1/CCL1 − V0/CCL0 − ΣF_i/ccl_i

Riesgo USD:  activo_usd = R_usd;            tc_usd = 0
             activo_ars = R_usd × CCL1
             tc_ars     = V0_usd·(CCL1 − CCL0) + Σ(F_i/ccl_i)·(CCL1 − ccl_i)
Riesgo ARS:  activo_ars = R_ars;            tc_ars = 0
             activo_usd = R_ars ÷ CCL0
             tc_usd     = V1·(1/CCL1 − 1/CCL0) + ΣF_i·(1/CCL0 − 1/ccl_i)

Partida sin precio nuevo en el intervalo: todo el resultado queda "sin
atribuir" (activo = TC = 0). Invariante, en cada moneda:
activo + TC + sin atribuir = resultado.

Desglose desde la compra (una tenencia a la fecha d, CCL_d)
-----------------------------------------------------------
CCL_prom = costo ARS ÷ costo USD.

Riesgo USD:  tc_ars = costo_usd × (CCL_d − CCL_prom)
             activo_ars = (valor_usd − costo_usd) × CCL_d
             activo_usd = valor_usd − costo_usd;  tc_usd = 0
Riesgo ARS:  activo_usd = (valor_ars − costo_ars) ÷ CCL_prom
             tc_usd = valor_ars × (1/CCL_d − 1/CCL_prom)
             activo_ars = valor_ars − costo_ars;  tc_ars = 0

Interpretaciones (donde el texto es ambiguo, la lectura elegida)
================================================================
I-1  Una partida es un activo de una cuenta. Las operaciones se aplican en
     orden (fecha, id). La foto de la fecha d es al cierre: incluye las
     operaciones con fecha ≤ d. Los flujos del intervalo t0 → t1 son las
     operaciones con t0 < fecha ≤ t1 (las de t0 ya están en V0).
I-2  `comisiones` es NOT NULL DEFAULT 0 en el schema: nunca es "sin dato". La
     apertura no suma comisiones (su costo es cantidad × PPP, que ya las
     incluye).
I-3  Un costo "sin dato" en cualquier lote deja "sin dato" el costo de toda la
     tenencia (no hay suma parcial), y una venta parcial no lo cura. La venta
     TOTAL sí: con cantidad 0 el costo remanente es 0 exacto, porque no queda
     ninguna unidad cuyo costo se desconozca. Una recompra posterior arranca
     de costo 0 conocido.
I-4  Con cantidad 0 (tenencia cerrada o todavía no abierta) el valor es 0
     exacto en las dos monedas, aunque falten precio o CCL: 0 × algo no es un
     dato que falte. El PPC con cantidad 0 es "sin dato" (0 ÷ 0).
I-5  El precio de la foto es el último conocido con fecha ≤ d ("precios de ayer
     = último valor conocido", spec). El CCL NO se arrastra: es el de la fecha
     exacta de la foto, o "sin dato" (no se estima un tipo de cambio).
I-6  Flujo de una `compra` = su costo ARS (importe, o cantidad × precio +
     comisiones); si está pendiente (D-19), "sin dato", y con él R_ars, R_usd y
     todo su desglose. Flujo de una `venta` = −lo cobrado: −importe si existe;
     si no, −(cantidad × precio − comisiones) (el importe de una venta es
     "total liquidado con comisiones", o sea neto). El `ajuste_ratio` no es
     flujo. Cada flujo se convierte al CCL de su propia operación
     (`ccl_del_dia`, obligatorio en compra y venta).
I-7  Una `apertura` con fecha dentro del intervalo entra como flujo a su valor
     de mercado en t1: F = cantidad × P1, convertido a CCL1 (ccl_i = CCL1). Así
     no genera resultado propio.
I-8  Una partida es atribuible si tiene una cotización con fecha en (t0, t1]
     ("precio nuevo") o si quedó cerrada en t1 (cantidad 0: V1 = 0 es exacto y
     no queda nada por observar). Si no, es "no atribuible": R va entero a sin
     atribuir. Una posición abierta dentro del intervalo y valuada con una
     cotización anterior a t0 NO es atribuible. Motivo (vision.md 4.2): "en
     cualquier período 'sin atribuir' es lo pendiente al final menos lo
     pendiente al principio"; una posición cerrada no deja nada pendiente, y
     una abierta con precio viejo sí. (La versión anterior trataba la venta
     total sin cotización nueva como no atribuible; se revisó después del
     primer cruce con el motor TS, por ese texto.)
I-9  Partes de un resultado "sin dato": si el resultado de una moneda es "sin
     dato", su activo, su TC y su sin atribuir en esa moneda también lo son,
     aunque la fórmula de una parte no use el insumo que falta (por ejemplo,
     tc_usd = V1·(1/CCL1 − 1/CCL0) sin precio en t0, o el TC desde la compra
     sin precio de hoy). Motivo: "activo + TC + sin atribuir = resultado" es
     la invariante (calidad.md §1); si las partes se conocieran, el total
     también, y mostrar una parte de un total desconocido, o un 0 "por
     convención" a su lado, se lee como un dato. Con el resultado conocido,
     los ceros por convención (tc_usd en riesgo USD, tc_ars en riesgo ARS,
     activo y TC de una partida no atribuible, sin atribuir de una
     atribuible) son 0 exacto. Cada moneda se decide por separado.
     (Revisada después del primer cruce con el motor TS, por la invariante:
     la versión anterior dejaba esos ceros y partes sueltas.)
I-10 Precio "viejo" en t0 (arrastrado desde s0 < t0) y fresco en t1: la
     variante simple (la que exige el pedido, campos `variacion`) desglosa
     V0 con CCL0. `vision.md` 4.2 describe otra: "se cierra el intervalo
     mié → vie de cada partida que el jueves quedó arrastrada: se desglosa
     entero en activo y CCL con el CCL de sus dos puntas, y la frase del
     viernes devuelve lo que el jueves había quedado sin atribuir". Esa
     variante se calcula aparte (`variacion_anclada`): activo y TC con CCL(s0)
     en lugar de CCL0, y sin atribuir = −R(s0 → t0). El resultado total es el
     mismo en las dos. Solo se calcula si no hay operaciones en (s0, t0].
I-11 Desde la compra se usa CCL_prom (lo pedido). En riesgo USD es idéntico a
     la suma por lote Σ costo_usd_i·(CCL_d − ccl_i) del Apéndice B (SPY). En
     riesgo ARS NO: el Apéndice B (T30J7) reparte por lote,
     Σ (v_i − c_i) ÷ ccl_i, y da otro reparto con el mismo total. Ver
     `_autoverificacion()`.
I-12 Los totales de una foto o de un desglose suman las partidas; si una es
     "sin dato", el total es "sin dato" y además se informa la suma parcial de
     las conocidas (D-65 en vision.md 4.5).
"""
from __future__ import annotations

import sys
from decimal import ROUND_HALF_EVEN, Decimal, getcontext

getcontext().prec = 50
getcontext().rounding = ROUND_HALF_EVEN

CERO = Decimal(0)
UNO = Decimal(1)

Monto = Decimal | None  # None = "sin dato"


# ───────────────────────────── aritmética con "sin dato" ─────────────────────


def dec(x: object) -> Monto:
    """Convierte un monto de entrada. Rechaza float (D-32)."""
    if x is None:
        return None
    if isinstance(x, Decimal):
        return x
    if isinstance(x, bool):
        raise TypeError(f'monto no admitido: {x!r}')
    if isinstance(x, (str, int)):
        return Decimal(x)
    raise TypeError(f'monto no admitido: {x!r} (solo str, int, Decimal o None)')


def suma(*xs: Monto) -> Monto:
    total = CERO
    for x in xs:
        if x is None:
            return None
        total += x
    return total


def resta(a: Monto, b: Monto) -> Monto:
    if a is None or b is None:
        return None
    return a - b


def prod(*xs: Monto) -> Monto:
    total = UNO
    for x in xs:
        if x is None:
            return None
        total *= x
    return total


def div(a: Monto, b: Monto) -> Monto:
    if a is None or b is None or b == 0:
        return None
    return a / b


def inv(a: Monto) -> Monto:
    return div(UNO, a)


def neg(a: Monto) -> Monto:
    return None if a is None else -a


# ───────────────────────────── operaciones y tenencia ────────────────────────


def ordenar(operaciones: list[dict]) -> list[dict]:
    return sorted(operaciones, key=lambda op: (op['fecha'], op['id']))


def costo_operacion_ars(op: dict) -> Monto:
    """Costo en pesos de una apertura o una compra (I-2, D-14, D-19)."""
    cantidad = dec(op['cantidad'])
    precio = dec(op.get('precio'))
    if op['tipo'] == 'apertura':
        return prod(cantidad, precio)
    if op['tipo'] == 'compra':
        importe = dec(op.get('importe'))
        if importe is not None:
            return importe
        if precio is None:
            return None  # compra del día con PPP '-': pendiente (D-19)
        return suma(prod(cantidad, precio), dec(op.get('comisiones') or '0'))
    raise ValueError(f'costo de una operación {op["tipo"]}')


def cobrado_venta_ars(op: dict) -> Monto:
    """Lo que se cobra en una venta, neto de comisiones (I-6)."""
    importe = dec(op.get('importe'))
    if importe is not None:
        return importe
    return resta(prod(dec(op['cantidad']), dec(op.get('precio'))), dec(op.get('comisiones') or '0'))


def tenencia(operaciones: list[dict], fecha: str) -> dict:
    """Cantidad, costo y PPC en ARS y USD al cierre de `fecha`."""
    q = CERO
    costo_ars: Monto = CERO
    costo_usd: Monto = CERO
    for op in ordenar(operaciones):
        if op['fecha'] > fecha:
            continue
        tipo = op['tipo']
        cantidad = dec(op['cantidad'])
        if tipo in ('apertura', 'compra'):
            c_ars = costo_operacion_ars(op)
            c_usd = div(c_ars, dec(op.get('ccl')))
            q += cantidad
            costo_ars = suma(costo_ars, c_ars)
            costo_usd = suma(costo_usd, c_usd)
        elif tipo == 'venta':
            antes = q
            q = q - cantidad
            if q < 0:
                raise ValueError(f'venta mayor que la tenencia: {op}')
            if q == 0:
                costo_ars = CERO  # I-3
                costo_usd = CERO
            else:
                costo_ars = div(prod(costo_ars, q), antes)
                costo_usd = div(prod(costo_usd, q), antes)
        elif tipo == 'ajuste_ratio':
            q += cantidad
            if q <= 0:
                raise ValueError(f'ajuste de ratio que deja la tenencia en {q}: {op}')
        else:
            raise ValueError(f'tipo de operación fuera del alcance de la referencia: {tipo}')
    hay = q != 0
    return {
        'cantidad': q,
        'costo_ars': costo_ars,
        'costo_usd': costo_usd,
        'ppc_ars': div(costo_ars, q) if hay else None,
        'ppc_usd': div(costo_usd, q) if hay else None,
    }


# ───────────────────────────── foto ──────────────────────────────────────────


def ccl_vigente(ccl: dict[str, str | None], fecha: str) -> Monto:
    """Decisión B: el último CCL tipeado en o antes de la fecha."""
    mejor = None
    for d, v in ccl.items():
        if v is not None and d <= fecha and (mejor is None or d > mejor):
            mejor = d
    return None if mejor is None else dec(ccl[mejor])


def ccl_de(ccl: dict[str, str | None], fecha: str) -> Monto:
    """CCL de un flujo sin CCL propio: el vigente; si no hay, el primero posterior."""
    v = ccl_vigente(ccl, fecha)
    if v is not None:
        return v
    posteriores = sorted(d for d, x in ccl.items() if x is not None and d > fecha)
    return dec(ccl[posteriores[0]]) if posteriores else None


def precio_dia(partida: dict, fecha: str) -> Monto:
    """Precio del día de una operación: el último en o antes; si no hay, el primero posterior (decisión C)."""
    p, _ = precio_vigente(partida['precios'], fecha)
    if p is not None:
        return p
    posteriores = sorted((x for x in partida['precios'] if x['fecha'] > fecha), key=lambda x: x['fecha'])
    return dec(posteriores[0]['precio']) if posteriores else None


def ultimo_ratio(operaciones: list[dict], fecha: str) -> str | None:
    """Fecha del último ajuste de ratio de la tenencia vigente en o antes de la fecha."""
    q = CERO
    ult = None
    for op in ordenar(operaciones):
        if op['fecha'] > fecha:
            break
        if op['tipo'] in ('apertura', 'compra'):
            q += dec(op['cantidad'])
        elif op['tipo'] == 'venta':
            q -= dec(op['cantidad'])
        elif op['tipo'] == 'ajuste_ratio':
            q += dec(op['cantidad'])
            ult = op['fecha']
        if q <= 0:
            q = CERO
            ult = None
    return ult


def precio_vigente(precios: list[dict], fecha: str) -> tuple[Monto, str | None]:
    mejor = None
    for p in precios:
        if p['fecha'] <= fecha and (mejor is None or p['fecha'] > mejor['fecha']):
            mejor = p
    if mejor is None:
        return None, None
    return dec(mejor['precio']), mejor['fecha']


def foto(partida: dict, ccl: dict[str, str | None], fecha: str) -> dict:
    t = tenencia(partida['operaciones'], fecha)
    precio, fecha_precio = precio_vigente(partida['precios'], fecha)
    r = ultimo_ratio(partida['operaciones'], fecha)
    if fecha_precio is not None and r is not None and fecha_precio < r:
        precio, fecha_precio = None, None  # B07
    ccl_d = ccl_vigente(ccl, fecha)  # decisión B
    if t['cantidad'] == 0:
        valor_ars: Monto = CERO  # I-4
        valor_usd: Monto = CERO
    else:
        valor_ars = prod(t['cantidad'], precio)
        valor_usd = div(valor_ars, ccl_d)
    return {
        **t,
        'precio': precio,
        'fecha_precio': fecha_precio,
        'fresco': fecha_precio == fecha,
        'ccl': ccl_d,
        'valor_ars': valor_ars,
        'valor_usd': valor_usd,
    }


# ───────────────────────────── desglose de un intervalo (D-35) ───────────────


def desglose_intervalo(
    riesgo: str,
    v0_ars: Monto,
    v0_usd: Monto,
    v1_ars: Monto,
    v1_usd: Monto,
    ccl0: Monto,
    ccl1: Monto,
    flujos: list[tuple[Monto, Monto]],
    atribuible: bool,
) -> dict:
    """D-35 para una partida. `flujos` = [(F_ars, ccl_i)]."""
    if riesgo not in ('USD', 'ARS'):
        raise ValueError(riesgo)
    suma_f_ars = suma(*[f for f, _ in flujos])
    flujos_usd = [div(f, c) for f, c in flujos]
    suma_f_usd = suma(*flujos_usd)
    r_ars = resta(resta(v1_ars, v0_ars), suma_f_ars)
    r_usd = resta(resta(v1_usd, v0_usd), suma_f_usd)
    if not atribuible:
        return _partes_de_lo_conocido({
            'resultado_ars': r_ars, 'resultado_usd': r_usd,
            'activo_ars': CERO, 'tc_ars': CERO, 'sin_atribuir_ars': r_ars,
            'activo_usd': CERO, 'tc_usd': CERO, 'sin_atribuir_usd': r_usd,
            'atribuible': False,
        })
    if riesgo == 'USD':
        activo_usd = r_usd
        tc_usd: Monto = CERO
        activo_ars = prod(r_usd, ccl1)
        tc_ars = suma(
            prod(v0_usd, resta(ccl1, ccl0)),
            *[prod(fu, resta(ccl1, c)) for fu, (_, c) in zip(flujos_usd, flujos)],
        )
    else:
        activo_ars = r_ars
        tc_ars = CERO
        activo_usd = div(r_ars, ccl0)
        tc_usd = suma(
            prod(v1_ars, resta(inv(ccl1), inv(ccl0))),
            *[prod(f, resta(inv(ccl0), inv(c))) for f, c in flujos],
        )
    return _partes_de_lo_conocido({
        'resultado_ars': r_ars, 'resultado_usd': r_usd,
        'activo_ars': activo_ars, 'tc_ars': tc_ars, 'sin_atribuir_ars': CERO,
        'activo_usd': activo_usd, 'tc_usd': tc_usd, 'sin_atribuir_usd': CERO,
        'atribuible': True,
    })


def _partes_de_lo_conocido(d: dict) -> dict:
    """I-9: las partes de un resultado "sin dato" son "sin dato", por moneda."""
    for m in ('ars', 'usd'):
        if d[f'resultado_{m}'] is None:
            for parte in ('activo', 'tc', 'sin_atribuir'):
                if f'{parte}_{m}' in d:
                    d[f'{parte}_{m}'] = None
    return d


def flujos_intervalo(partida: dict, ccl: dict[str, str | None], t0: str, t1: str) -> list[tuple[Monto, Monto]]:
    """Flujos de la partida con t0 < fecha ≤ t1, fijos (decisiones A y C)."""
    out: list[tuple[Monto, Monto]] = []
    for op in ordenar(partida['operaciones']):
        if not (t0 < op['fecha'] <= t1):
            continue
        tipo = op['tipo']
        c_op = dec(op.get('ccl')) if op.get('ccl') is not None else ccl_de(ccl, op['fecha'])
        if tipo == 'compra':
            costo = costo_operacion_ars(op)
            if costo is None:  # decisión C: precio pendiente → precio del día
                costo = prod(dec(op['cantidad']), precio_dia(partida, op['fecha']))
            out.append((costo, c_op))
        elif tipo == 'venta':
            cobrado = cobrado_venta_ars(op)
            if cobrado is None:
                cobrado = prod(dec(op['cantidad']), precio_dia(partida, op['fecha']))
            out.append((neg(cobrado), c_op))
        elif tipo == 'apertura':
            out.append((prod(dec(op['cantidad']), precio_dia(partida, op['fecha'])), ccl_de(ccl, op['fecha'])))
        elif tipo == 'ajuste_ratio':
            pass
        else:
            raise ValueError(tipo)
    return out


def fresca(partida: dict, ccl: dict[str, str | None], d: str) -> bool:
    """Decisión A: CCL tipeado ese día y (precio de ese día o cantidad 0)."""
    if ccl.get(d) is None:
        return False
    if any(p['fecha'] == d for p in partida['precios']):
        return True
    return tenencia(partida['operaciones'], d)['cantidad'] == 0


def ancla(partida: dict, ccl: dict[str, str | None], d: str) -> str | None:
    fechas = sorted((x for x, v in ccl.items() if v is not None and x <= d), reverse=True)
    for x in fechas:
        if fresca(partida, ccl, x):
            return x
    return None


SIN_DATO = {c: None for c in (
    'resultado_ars', 'resultado_usd', 'activo_ars', 'tc_ars', 'sin_atribuir_ars',
    'activo_usd', 'tc_usd', 'sin_atribuir_usd')}


def intervalo(partida: dict, ccl: dict[str, str | None], t0: str, t1: str) -> dict:
    """Un intervalo entre dos cargas consecutivas, con la atribución anclada (A)."""
    f0 = foto(partida, ccl, t0)
    f1 = foto(partida, ccl, t1)
    flujos = flujos_intervalo(partida, ccl, t0, t1)
    if f0['cantidad'] == 0 and f1['cantidad'] == 0 and not flujos:
        return {c: CERO for c in SIN_DATO} | {'atribuible': True}
    faltan = (f0['ccl'] is None or f1['ccl'] is None
              or f0['valor_ars'] is None or f0['valor_usd'] is None or f1['valor_ars'] is None or f1['valor_usd'] is None
              or any(f is None or c is None for f, c in flujos))
    if faltan:
        return dict(SIN_DATO) | {'atribuible': False}
    r_ars = f1['valor_ars'] - f0['valor_ars'] - sum((f for f, _ in flujos), CERO)
    r_usd = f1['valor_usd'] - f0['valor_usd'] - sum((f / c for f, c in flujos), CERO)
    a0 = ancla(partida, ccl, t0)
    a1 = ancla(partida, ccl, t1)
    if a0 is not None and a1 is not None and a1 > a0:
        fa0 = foto(partida, ccl, a0)
        fa1 = foto(partida, ccl, a1)
        fl = flujos_intervalo(partida, ccl, a0, a1)
        conocido = (fa0['valor_ars'] is not None and fa1['valor_ars'] is not None
                    and all(f is not None and c is not None for f, c in fl))
        if conocido:
            d = desglose_intervalo(partida['riesgo'], fa0['valor_ars'], fa0['valor_usd'], fa1['valor_ars'], fa1['valor_usd'],
                                   dec(ccl[a0]), dec(ccl[a1]), fl, True)
            return {
                'resultado_ars': r_ars, 'resultado_usd': r_usd,
                'activo_ars': d['activo_ars'], 'tc_ars': d['tc_ars'], 'sin_atribuir_ars': r_ars - d['activo_ars'] - d['tc_ars'],
                'activo_usd': d['activo_usd'], 'tc_usd': d['tc_usd'], 'sin_atribuir_usd': r_usd - d['activo_usd'] - d['tc_usd'],
                'atribuible': True, 'ancla': [a0, a1],
            }
    return {
        'resultado_ars': r_ars, 'resultado_usd': r_usd,
        'activo_ars': CERO, 'tc_ars': CERO, 'sin_atribuir_ars': r_ars,
        'activo_usd': CERO, 'tc_usd': CERO, 'sin_atribuir_usd': r_usd,
        'atribuible': False,
    }


def fechas_de_carga(caso: dict) -> list[str]:
    """Fechas con un tipo de cambio (aunque el CCL sea null) o con un precio."""
    s = set(caso['ccl'].keys())
    for p in caso['partidas']:
        s |= {x['fecha'] for x in p['precios']}
    return sorted(s)


def variacion(partida: dict, ccl: dict[str, str | None], t0: str, t1: str, cargas: list[str] | None = None) -> dict:
    """Variación t0 → t1: suma de los intervalos entre cargas consecutivas (A)."""
    puntos = [t0] + [d for d in (cargas or []) if t0 < d < t1] + [t1]
    partes = [intervalo(partida, ccl, a, b) for a, b in zip(puntos, puntos[1:])]
    if any(p['resultado_ars'] is None for p in partes):
        d = dict(SIN_DATO)
    else:
        d = {c: sum((p[c] for p in partes), CERO) for c in SIN_DATO}
    d['atribuible'] = all(p['atribuible'] for p in partes)
    flujos = flujos_intervalo(partida, ccl, t0, t1)
    d['flujos_ars'] = suma(*[f for f, _ in flujos])
    d['flujos_usd'] = suma(*[div(f, c) for f, c in flujos])
    return d


# ───────────────────────────── desglose desde la compra ──────────────────────


def desglose_desde_compra(riesgo: str, costo_ars: Monto, costo_usd: Monto, valor_ars: Monto, valor_usd: Monto, ccl_d: Monto) -> dict:
    res_ars = resta(valor_ars, costo_ars)
    res_usd = resta(valor_usd, costo_usd)
    ccl_prom = div(costo_ars, costo_usd)
    if riesgo == 'USD':
        tc_ars = prod(costo_usd, resta(ccl_d, ccl_prom))
        activo_ars = prod(resta(valor_usd, costo_usd), ccl_d)
        activo_usd = res_usd
        tc_usd: Monto = CERO
    elif riesgo == 'ARS':
        activo_usd = div(resta(valor_ars, costo_ars), ccl_prom)
        tc_usd = prod(valor_ars, resta(inv(ccl_d), inv(ccl_prom)))
        activo_ars = res_ars
        tc_ars = CERO
    else:
        raise ValueError(riesgo)
    return _partes_de_lo_conocido({
        'resultado_ars': res_ars, 'resultado_usd': res_usd, 'ccl_prom': ccl_prom,
        'activo_ars': activo_ars, 'tc_ars': tc_ars, 'activo_usd': activo_usd, 'tc_usd': tc_usd,
    })


def ops_tenencia_vigente(operaciones: list[dict], fecha: str) -> list[dict]:
    """Operaciones de la tenencia vigente: desde la última vez que quedó en cero."""
    ops: list[dict] = []
    q = CERO
    for op in ordenar(operaciones):
        if op['fecha'] > fecha:
            break
        if q == 0 and op['tipo'] == 'venta':
            continue
        ops.append(op)
        if op['tipo'] in ('apertura', 'compra', 'ajuste_ratio'):
            q += dec(op['cantidad'])
        elif op['tipo'] == 'venta':
            q -= dec(op['cantidad'])
        if q <= 0:
            q = CERO
            ops = []
    return ops


def desde_compra(partida: dict, ccl: dict[str, str | None], fecha: str, cargas: list[str] | None = None) -> dict | None:
    """Decisión E (visión 4.5, D-35): suma de los intervalos entre cargas desde la
    primera observación fresca de la tenencia, más un intervalo por lote antes de
    ella, desde su costo al CCL de compra hasta su valor en esa observación. Si
    hubo una baja o un cambio de ratio antes de la primera observación, un solo
    intervalo con CCL_prom (como antes)."""
    f = foto(partida, ccl, fecha)
    if f['cantidad'] == 0:
        return None
    if cargas is None:
        cargas = sorted(set(ccl) | {x['fecha'] for x in partida['precios']})
    base = {'resultado_ars': resta(f['valor_ars'], f['costo_ars']), 'resultado_usd': resta(f['valor_usd'], f['costo_usd'])}
    sin = base | {'activo_ars': None, 'tc_ars': None, 'activo_usd': None, 'tc_usd': None}
    ops = ops_tenencia_vigente(partida['operaciones'], fecha)
    inicio = ops[0]['fecha']
    candidatas = sorted(d for d, v in ccl.items() if v is not None and inicio <= d <= fecha)
    primera = next((d for d in candidatas if any(p['fecha'] == d for p in partida['precios'])
                    and tenencia(partida['operaciones'], d)['cantidad'] != 0), None)
    if primera is None:
        return sin
    if any(op['fecha'] <= primera and op['tipo'] not in ('apertura', 'compra') for op in ops):
        return desglose_desde_compra(partida['riesgo'], f['costo_ars'], f['costo_usd'], f['valor_ars'], f['valor_usd'], f['ccl'])
    ccl1 = dec(ccl[primera])
    p1 = next(dec(p['precio']) for p in partida['precios'] if p['fecha'] == primera)
    suma_partes = {c: CERO for c in ('activo_ars', 'tc_ars', 'activo_usd', 'tc_usd')}
    for op in ops:
        if op['fecha'] > primera or op['tipo'] not in ('apertura', 'compra'):
            continue
        costo = costo_operacion_ars(op)
        c0 = dec(op.get('ccl'))
        if costo is None or c0 is None:
            return sin
        v1 = dec(op['cantidad']) * p1
        d = desglose_intervalo(partida['riesgo'], costo, costo / c0, v1, v1 / ccl1, c0, ccl1, [], True)
        for c in suma_partes:
            suma_partes[c] += d[c]
    puntos = [d for d in cargas if primera <= d <= fecha]
    for a, b in zip(puntos, puntos[1:]):
        x = intervalo(partida, ccl, a, b)
        if x['resultado_ars'] is None:
            return sin
        for c in suma_partes:
            suma_partes[c] += x[c]
    return base | suma_partes


# ───────────────────────────── un caso completo ──────────────────────────────

CAMPOS_VARIACION = (
    'resultado_ars', 'resultado_usd', 'activo_ars', 'tc_ars', 'sin_atribuir_ars',
    'activo_usd', 'tc_usd', 'sin_atribuir_usd',
)


def total(valores: list[Monto]) -> dict:
    """Total exacto (None si alguna partida es "sin dato") y suma parcial (I-12)."""
    conocidos = [v for v in valores if v is not None]
    return {'total': suma(*valores), 'parcial': suma(*conocidos), 'faltan': len(valores) - len(conocidos)}


def calcular_caso(caso: dict) -> dict:
    t0, t1, ccl = caso['t0'], caso['t1'], caso['ccl']
    cargas = fechas_de_carga(caso)
    partidas = {}
    for p in caso['partidas']:
        partidas[p['activo']] = {
            'foto_t0': foto(p, ccl, t0),  # incluye la tenencia y el PPC a t0
            'foto_t1': foto(p, ccl, t1),
            'variacion': variacion(p, ccl, t0, t1, cargas),  # atribución anclada (decisión A)
            'desde_compra_t1': desde_compra(p, ccl, t1, cargas),  # decisión E
        }
    totales = {
        'valor_ars_t0': total([x['foto_t0']['valor_ars'] for x in partidas.values()]),
        'valor_usd_t0': total([x['foto_t0']['valor_usd'] for x in partidas.values()]),
        'valor_ars_t1': total([x['foto_t1']['valor_ars'] for x in partidas.values()]),
        'valor_usd_t1': total([x['foto_t1']['valor_usd'] for x in partidas.values()]),
    }
    for campo in CAMPOS_VARIACION:
        totales[f'variacion_{campo}'] = total([x['variacion'][campo] for x in partidas.values()])
    return {'partidas': partidas, 'totales': totales}


def a_texto(x: object, digitos: int | None = None) -> object:
    """Serializa Decimal como texto decimal (sin exponente), recursivamente.

    Con `digitos`, redondea a esa cantidad de dígitos significativos.
    """
    if isinstance(x, Decimal):
        if digitos is not None and x != 0:
            x = x.quantize(Decimal(1).scaleb(x.adjusted() - digitos + 1))
        return format(x.normalize(), 'f')
    if isinstance(x, dict):
        return {k: a_texto(v, digitos) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [a_texto(v, digitos) for v in x]
    return x


# ───────────────────────────── autoverificación contra los documentos ─────────


def _cerca(a: Monto, b: str, decimales: int) -> bool:
    if a is None:
        return False
    q = Decimal(1).scaleb(-decimales)
    return abs(a - Decimal(b)) <= q / 2


def _autoverificacion() -> list[str]:
    errores: list[str] = []

    def chequear(nombre: str, valor: Monto, esperado: str, decimales: int) -> None:
        if not _cerca(valor, esperado, decimales):
            errores.append(f'{nombre}: {valor} ≠ {esperado} (a {decimales} decimales)')

    # D-35, ejemplos de investigacion-mercado.md §6.1.
    d = desglose_intervalo('USD', Decimal(1_000_000), Decimal(1_000), Decimal(1_100_000), Decimal(1_100_000) / Decimal(1120),
                           Decimal(1000), Decimal(1120), [], True)
    chequear('D-35 CEDEAR tc_ars', d['tc_ars'], '120000', 2)
    chequear('D-35 CEDEAR activo_ars', d['activo_ars'], '-20000', 2)
    chequear('D-35 CEDEAR resultado_ars', d['resultado_ars'], '100000', 2)
    chequear('D-35 CEDEAR resultado_usd', d['resultado_usd'], '-17.86', 2)
    d = desglose_intervalo('ARS', Decimal(1_000_000), Decimal(1_000), Decimal(1_025_000), Decimal(1_025_000) / Decimal(1120),
                           Decimal(1000), Decimal(1120), [], True)
    chequear('D-35 LECAP activo_usd', d['activo_usd'], '25.00', 2)
    chequear('D-35 LECAP tc_usd', d['tc_usd'], '-109.82', 2)
    chequear('D-35 LECAP resultado_usd', d['resultado_usd'], '-84.82', 2)

    # Apéndice B: desglose del día 13/10 → 14/10, con las partidas del set.
    ccl0, ccl1 = Decimal('1531.70'), Decimal('1548.20')
    usd = [  # (V0_ars, V1_ars) de las partidas con riesgo USD
        (1240 * Decimal(34700), 1240 * Decimal(35150)),  # SPY
        (4200 * ccl0, 4200 * ccl1),  # saldo USD
    ]
    ars = [
        (300 * Decimal(52500), 300 * Decimal(52300)),  # YPFD
        (11_500_000 * Decimal('1.0845'), 11_500_000 * Decimal('1.0852')),  # S13N6
        (9_000_000 * Decimal('1.1232'), 9_000_000 * Decimal('1.1240')),  # T30J7
        (1_250_000 * Decimal('4.8105'), 1_250_000 * Decimal('4.8120')),  # FIMA
        (5_000_000 * Decimal('1.0306'), 5_000_000 * Decimal('1.0310')),  # TXMJ0
        (Decimal(4_908_600), Decimal(4_912_300)),  # MP
        (Decimal(-185_000), Decimal(-185_000)),  # saldo ARS de IEB
    ]
    partes = [desglose_intervalo('USD', a, a / ccl0, b, b / ccl1, ccl0, ccl1, [], True) for a, b in usd]
    partes += [desglose_intervalo('ARS', a, a / ccl0, b, b / ccl1, ccl0, ccl1, [], True) for a, b in ars]
    s = {k: sum((p[k] for p in partes), CERO) for k in CAMPOS_VARIACION}
    chequear('Ap. B tc_ars', s['tc_ars'], '532812.44', 2)
    chequear('Ap. B activo_ars', s['activo_ars'], '57312.56', 2)
    chequear('Ap. B resultado_ars', s['resultado_ars'], '590125.00', 2)
    chequear('Ap. B tc_usd', s['tc_usd'], '-377.0049', 4)
    chequear('Ap. B activo_usd', s['activo_usd'], '36.7602', 4)
    chequear('Ap. B resultado_usd', s['resultado_usd'], '-340.2447', 4)
    chequear('Ap. B SPY activo_ars', partes[0]['activo_ars'], '94487.56', 2)

    # Apéndice B: carga express del 15/10 (nada fresco: todo sin atribuir).
    ccl2 = Decimal('1560.00')
    v_usd = [1240 * Decimal(35150), 4200 * ccl1]
    v_ars = [b for _, b in ars]
    partes = [desglose_intervalo('USD', a, a / ccl1, a if i == 0 else 4200 * ccl2, (a if i == 0 else 4200 * ccl2) / ccl2,
                                 ccl1, ccl2, [], False) for i, a in enumerate(v_usd)]
    partes += [desglose_intervalo('ARS', a, a / ccl1, a, a / ccl2, ccl1, ccl2, [], False) for a in v_ars]
    s = {k: sum((p[k] for p in partes), CERO) for k in CAMPOS_VARIACION}
    chequear('Ap. B express sin_atribuir_ars', s['sin_atribuir_ars'], '49560', 2)
    chequear('Ap. B express sin_atribuir_usd', s['sin_atribuir_usd'], '-477.6744', 4)
    chequear('Ap. B express SPY sin_atribuir_usd', partes[0]['sin_atribuir_usd'], '-212.9499', 4)

    # Apéndice B: Cartera al 14/10, desde la compra.
    spy = {'riesgo': 'USD', 'activo': 'SPY', 'operaciones': [
        {'id': 1, 'fecha': '2026-10-01', 'tipo': 'apertura', 'cantidad': '1000', 'precio': '29100', 'ccl': '1390.00'},
        {'id': 2, 'fecha': '2026-10-09', 'tipo': 'compra', 'cantidad': '240', 'precio': '34500', 'ccl': '1525.00'},
    ], 'precios': [{'fecha': '2026-10-14', 'precio': '35150'}]}
    ccl = {'2026-10-14': '1548.20'}
    t = tenencia(spy['operaciones'], '2026-10-14')
    chequear('Ap. B SPY costo_usd', t['costo_usd'], '26364.76', 2)
    chequear('Ap. B SPY ppc_ars', t['ppc_ars'], '30145.16', 2)
    chequear('Ap. B SPY ppc_usd', t['ppc_usd'], '21.26', 2)
    dc = desde_compra(spy, ccl, '2026-10-14')
    chequear('Ap. B SPY resultado_ars', dc['resultado_ars'], '6206000', 2)
    chequear('Ap. B SPY resultado_usd', dc['resultado_usd'], '1787.93', 2)
    chequear('Ap. B SPY tc_ars', dc['tc_ars'], '3437921.42', 2)
    chequear('Ap. B SPY activo_ars', dc['activo_ars'], '2768078.58', 2)

    s13 = {'riesgo': 'ARS', 'activo': 'S13N6', 'operaciones': [
        {'id': 1, 'fecha': '2026-10-01', 'tipo': 'apertura', 'cantidad': '11500000', 'precio': '1.0426', 'ccl': '1502.00'},
    ], 'precios': [{'fecha': '2026-10-14', 'precio': '1.0852'}]}
    dc = desde_compra(s13, ccl, '2026-10-14')
    chequear('Ap. B S13N6 resultado_ars', dc['resultado_ars'], '489900', 2)
    chequear('Ap. B S13N6 resultado_usd', dc['resultado_usd'], '78.2217', 4)
    chequear('Ap. B S13N6 activo_usd', dc['activo_usd'], '326.1651', 4)
    chequear('Ap. B S13N6 tc_usd', dc['tc_usd'], '-247.9434', 4)

    t30 = {'riesgo': 'ARS', 'activo': 'T30J7', 'operaciones': [
        {'id': 1, 'fecha': '2026-10-01', 'tipo': 'apertura', 'cantidad': '8000000', 'precio': '1.097475', 'ccl': '1452.00'},
        {'id': 2, 'fecha': '2026-10-08', 'tipo': 'compra', 'cantidad': '1000000', 'precio': '1.0986', 'ccl': '1519.40'},
    ], 'precios': [{'fecha': '2026-10-14', 'precio': '1.1240'}]}
    dc = desde_compra(t30, ccl, '2026-10-14')
    chequear('Ap. B T30J7 resultado_ars', dc['resultado_ars'], '237600', 2)
    chequear('Ap. B T30J7 resultado_usd', dc['resultado_usd'], '-235.7033', 4)
    # Decisión E: con una sola observación (la del 14/10), el tramo anterior es un
    # intervalo por lote al CCL de compra: reproduce el reparto por lote del
    # Apéndice B (+162,8604 / −398,5636), que CCL_prom (I-11) no daba.
    por_lote_activo = (Decimal(8_000_000) * Decimal('1.1240') - Decimal('8779800')) / Decimal('1452.00') \
        + (Decimal(1_000_000) * Decimal('1.1240') - Decimal('1098600')) / Decimal('1519.40')
    chequear('Ap. B T30J7 activo_usd por lote', por_lote_activo, '162.8604', 4)
    chequear('Ap. B T30J7 activo_usd (E)', dc['activo_usd'], '162.8604', 4)
    chequear('Ap. B T30J7 tc_usd (E)', dc['tc_usd'], '-398.5636', 4)
    return errores


if __name__ == '__main__':
    errores = _autoverificacion()
    if errores:
        print('La referencia NO reproduce los ejemplos de los documentos:')
        for e in errores:
            print('  -', e)
        sys.exit(1)
    print('Referencia OK: reproduce D-35 (§6.1) y el Apéndice B de vision.md (con la decisión E,')
    print('también el reparto por lote de T30J7: activo +162,8604 / TC −398,5636).')
