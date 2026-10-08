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
    ccl_d = dec(ccl.get(fecha))
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


def flujos_intervalo(partida: dict, t0: str, t1: str, precio1: Monto, ccl1: Monto) -> list[tuple[Monto, Monto]]:
    """Flujos de la partida con t0 < fecha ≤ t1 (I-1, I-6, I-7)."""
    out: list[tuple[Monto, Monto]] = []
    for op in ordenar(partida['operaciones']):
        if not (t0 < op['fecha'] <= t1):
            continue
        tipo = op['tipo']
        if tipo == 'compra':
            out.append((costo_operacion_ars(op), dec(op.get('ccl'))))
        elif tipo == 'venta':
            out.append((neg(cobrado_venta_ars(op)), dec(op.get('ccl'))))
        elif tipo == 'apertura':
            out.append((prod(dec(op['cantidad']), precio1), ccl1))
        elif tipo == 'ajuste_ratio':
            pass
        else:
            raise ValueError(tipo)
    return out


def es_atribuible(partida: dict, t0: str, t1: str, cantidad_t1: Decimal) -> bool:
    """I-8: hay precio nuevo en (t0, t1], o la partida quedó cerrada en t1."""
    return cantidad_t1 == 0 or any(t0 < p['fecha'] <= t1 for p in partida['precios'])


def variacion(partida: dict, ccl: dict[str, str | None], t0: str, t1: str) -> dict:
    f0 = foto(partida, ccl, t0)
    f1 = foto(partida, ccl, t1)
    flujos = flujos_intervalo(partida, t0, t1, f1['precio'], f1['ccl'])
    atribuible = es_atribuible(partida, t0, t1, f1['cantidad'])
    d = desglose_intervalo(
        partida['riesgo'], f0['valor_ars'], f0['valor_usd'], f1['valor_ars'], f1['valor_usd'],
        f0['ccl'], f1['ccl'], flujos, atribuible,
    )
    d['flujos_ars'] = suma(*[f for f, _ in flujos])
    d['flujos_usd'] = suma(*[div(f, c) for f, c in flujos])
    return d


def variacion_anclada(partida: dict, ccl: dict[str, str | None], t0: str, t1: str) -> dict | None:
    """Variante de vision.md 4.2 para precio viejo en t0 y fresco en t1 (I-10).

    Devuelve None si no aplica (precio fresco en t0, sin precio en t0, partida no
    atribuible en el intervalo, u operaciones entre s0 y t0).
    """
    f0 = foto(partida, ccl, t0)
    if f0['fecha_precio'] is None or f0['fresco'] or f0['cantidad'] == 0:
        return None
    if not es_atribuible(partida, t0, t1, tenencia(partida['operaciones'], t1)['cantidad']):
        return None
    s0 = f0['fecha_precio']
    if any(s0 < op['fecha'] <= t0 for op in partida['operaciones']):
        return None
    simple = variacion(partida, ccl, t0, t1)
    fs = foto(partida, ccl, s0)
    f1 = foto(partida, ccl, t1)
    flujos = flujos_intervalo(partida, t0, t1, f1['precio'], f1['ccl'])
    anclado = desglose_intervalo(
        partida['riesgo'], fs['valor_ars'], fs['valor_usd'], f1['valor_ars'], f1['valor_usd'],
        fs['ccl'], f1['ccl'], flujos, True,
    )
    # Lo que quedó pendiente en s0 → t0 vuelve con signo opuesto.
    pend_ars = resta(f0['valor_ars'], fs['valor_ars'])
    pend_usd = resta(f0['valor_usd'], fs['valor_usd'])
    return _partes_de_lo_conocido({
        'resultado_ars': simple['resultado_ars'],
        'resultado_usd': simple['resultado_usd'],
        'activo_ars': anclado['activo_ars'], 'tc_ars': anclado['tc_ars'], 'sin_atribuir_ars': neg(pend_ars),
        'activo_usd': anclado['activo_usd'], 'tc_usd': anclado['tc_usd'], 'sin_atribuir_usd': neg(pend_usd),
        'ancla': s0,
    })


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


def desde_compra(partida: dict, ccl: dict[str, str | None], fecha: str) -> dict | None:
    f = foto(partida, ccl, fecha)
    if f['cantidad'] == 0:
        return None
    return desglose_desde_compra(partida['riesgo'], f['costo_ars'], f['costo_usd'], f['valor_ars'], f['valor_usd'], f['ccl'])


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
    partidas = {}
    for p in caso['partidas']:
        partidas[p['activo']] = {
            'foto_t0': foto(p, ccl, t0),  # incluye la tenencia y el PPC a t0
            'foto_t1': foto(p, ccl, t1),
            'variacion': variacion(p, ccl, t0, t1),
            'variacion_anclada': variacion_anclada(p, ccl, t0, t1),
            'desde_compra_t1': desde_compra(p, ccl, t1),
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
    # I-11: por lote (Apéndice B) el reparto es +162,8604 / −398,5636; con
    # CCL_prom (lo pedido) es otro. Se deja constancia, no es un error.
    por_lote_activo = (Decimal(8_000_000) * Decimal('1.1240') - Decimal('8779800')) / Decimal('1452.00') \
        + (Decimal(1_000_000) * Decimal('1.1240') - Decimal('1098600')) / Decimal('1519.40')
    chequear('Ap. B T30J7 activo_usd por lote', por_lote_activo, '162.8604', 4)
    if _cerca(dc['activo_usd'], '162.8604', 4):
        errores.append('T30J7: se esperaba que CCL_prom NO coincida con el reparto por lote')
    return errores


if __name__ == '__main__':
    errores = _autoverificacion()
    if errores:
        print('La referencia NO reproduce los ejemplos de los documentos:')
        for e in errores:
            print('  -', e)
        sys.exit(1)
    t30_lote = 'por lote: activo +162,8604 / TC −398,5636'
    print('Referencia OK: reproduce D-35 (§6.1) y el Apéndice B de vision.md.')
    print(f'Nota I-11 (T30J7, riesgo ARS): con CCL_prom el reparto difiere del {t30_lote}.')
