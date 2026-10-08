#!/usr/bin/env python3
"""Genera `tests/referencia/casos.json`: casos al azar, deterministas y con
números inventados, con las salidas esperadas según `motor_referencia.py`.

Uso: `python3 tests/referencia/generar_casos.py` (misma semilla → mismo archivo).

Cada caso tiene dos cargas, t0 y t1, y de 1 a 4 partidas (un activo de una
cuenta). Cada partida trae sus operaciones, sus cotizaciones (precio en pesos
por unidad o por 1 VN) y su moneda de riesgo. Los tipos de cambio son un mapa
fecha → CCL (`null` = "sin dato"). Las cotizaciones existen solo en fechas ≤ t0
o exactamente en t1, así el intervalo t0 → t1 tiene una sola observación
posible por partida (no hay cargas intermedias con precio).

Además de los 300 casos al azar (`r001`…`r300`) van casos fijos: `doc_*`, con
los números inventados de D-35 (§6.1) y del Apéndice B de vision.md, y
`min_*`, uno mínimo por cada diferencia que encontró el cruce con el motor TS.

Las etiquetas de cada partida dicen qué borde ejercita, para agrupar las
diferencias: `sin_ops`, `compra`, `compra_importe`, `venta_parcial`,
`venta_importe`, `venta_solo_importe`, `venta_total`, `compra_pendiente`,
`apertura_en_intervalo`, `nueva_compra`, `ajuste_ratio`, `compra_y_venta`,
`viejo_t1` (sin precio nuevo), `viejo_t0` (precio de t0 arrastrado),
`sin_precio_t0`, `apertura_sin_ppp`, `apertura_sin_ccl`, `op_en_t0`,
`venta_total_previa`. Las del caso: `sin_ccl_t0`, `sin_ccl_t1`, `doc`, `minimo`.
"""
from __future__ import annotations

import json
import random
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.dont_write_bytecode = True  # sin __pycache__ en el repo

import motor_referencia as ref  # noqa: E402

SEMILLA = 20261008
N_AL_AZAR = 300
# Las cuentas se hacen con 50 dígitos; el archivo guarda 25 significativos (de
# sobra para comparar a 1e-12) para que no pese varios MB.
DIGITOS_SALIDA = 25


def iso(d: date) -> str:
    return d.isoformat()


def monto(rng: random.Random, desde: float, hasta: float, decimales: int) -> str:
    escala = 10 ** decimales
    n = rng.randint(int(desde * escala), int(hasta * escala))
    return format(Decimal(n).scaleb(-decimales), 'f')


def mover(rng: random.Random, base: str, sigma: float, decimales: int) -> str:
    """Un precio cercano a `base`, con `decimales` decimales y siempre > 0."""
    b = Decimal(base)
    factor = Decimal(str(round(1 + rng.gauss(0, sigma), 6)))
    v = (b * factor).quantize(Decimal(1).scaleb(-decimales))
    minimo = Decimal(1).scaleb(-decimales)
    return format(max(v, minimo), 'f')


class Caso:
    def __init__(self, rng: random.Random, numero: int) -> None:
        self.rng = rng
        self.numero = numero
        self.ccl: dict[str, str | None] = {}

    def nuevo_ccl(self, d: date, cerca_de: str | None = None) -> str:
        clave = iso(d)
        if clave in self.ccl and self.ccl[clave] is not None:
            return self.ccl[clave]  # type: ignore[return-value]
        if cerca_de is None:
            valor = monto(self.rng, 1100, 1700, 2)
        else:
            valor = mover(self.rng, cerca_de, 0.015, 2)
        self.ccl[clave] = valor
        return valor


def generar_partida(caso: Caso, k: int, d_ini: date, t0: date, t1: date, flags_caso: set[str]) -> dict:
    rng = caso.rng
    etiquetas: list[str] = []
    riesgo = 'USD' if rng.random() < 0.5 else 'ARS'
    clase = rng.choice(['cedear', 'accion', 'bono'])
    if clase == 'bono':
        p_base = monto(rng, 0.8, 1.3, 4)
        dec_precio = 4
        cant = lambda: str(rng.randint(10, 1200) * 10_000)  # noqa: E731
    else:
        p_base = monto(rng, 1_000, 60_000, 2)
        dec_precio = 2
        cant = lambda: str(rng.randint(1, 2_000))  # noqa: E731
    comision = lambda: rng.choice(['0', '0', monto(rng, 1, 5_000, 2)])  # noqa: E731

    dias_intervalo = (t1 - t0).days
    fechas_intervalo = [t0 + timedelta(days=i) for i in range(1, dias_intervalo + 1)]

    # Escenario del intervalo.
    opciones = [
        ('sin_ops', 34), ('compra', 15), ('venta_parcial', 12), ('venta_total', 6),
        ('compra_pendiente', 5), ('apertura_en_intervalo', 6), ('nueva_compra', 6),
        ('ajuste_ratio', 6), ('compra_y_venta', 6),
    ]
    if 'sin_ccl_t0' in flags_caso:
        opciones = [o for o in opciones if o[0] not in ('apertura_en_intervalo', 'nueva_compra')]
    if dias_intervalo < 2:
        opciones = [o for o in opciones if o[0] != 'compra_y_venta']
    escenario = rng.choices([o[0] for o in opciones], weights=[o[1] for o in opciones])[0]
    etiquetas.append(escenario)
    sin_tenencia_previa = escenario in ('apertura_en_intervalo', 'nueva_compra')

    ops: list[tuple[date, dict]] = []
    precios: dict[date, str] = {}
    precio_actual = p_base

    # ── historia hasta t0 ──
    if not sin_tenencia_previa:
        ppp = mover(rng, p_base, 0.08, dec_precio + rng.choice([0, 0, 2]))
        apertura = {'tipo': 'apertura', 'cantidad': cant(), 'precio': ppp, 'importe': None, 'comisiones': '0', 'ccl': None}
        if rng.random() < 0.08:
            apertura['precio'] = None
            etiquetas.append('apertura_sin_ppp')
        if rng.random() < 0.65:
            origen = d_ini - timedelta(days=rng.randint(30, 900))
            apertura['ccl'] = monto(rng, 700, 1500, 2)
            apertura['fecha_origen'] = iso(origen)
            caso.ccl.setdefault(iso(origen), apertura['ccl'])
            if caso.ccl[iso(origen)] != apertura['ccl']:
                apertura['ccl'] = caso.ccl[iso(origen)]
        else:
            etiquetas.append('apertura_sin_ccl')
        ops.append((d_ini, apertura))
        caso.nuevo_ccl(d_ini)
        precios[d_ini] = precio_actual
        tenido = Decimal(apertura['cantidad'])

        # Operaciones entre la apertura y t0 (fechas distintas, la última puede ser t0).
        previas = []
        if rng.random() < 0.30:
            previas.append('compra')
        if rng.random() < 0.20:
            previas.append('venta')
        if rng.random() < 0.08:
            previas.append('ajuste_ratio')
        if rng.random() < 0.05:
            previas.append('venta_total')
        dias_previos = (t0 - d_ini).days
        fechas_previas = sorted(rng.sample(range(1, dias_previos + 1), k=min(len(previas), dias_previos)))
        for tipo, dia in zip(previas, fechas_previas):
            f = d_ini + timedelta(days=dia)
            if tenido < 2 and tipo in ('venta', 'ajuste_ratio', 'venta_total'):
                continue
            if f == t0:
                etiquetas.append('op_en_t0')
            precio_actual = mover(rng, precio_actual, 0.03, dec_precio)
            c = caso.nuevo_ccl(f, caso.ccl.get(iso(d_ini)))
            if tipo == 'compra':
                q = cant()
                ops.append((f, {'tipo': 'compra', 'cantidad': q, 'precio': precio_actual, 'importe': None, 'comisiones': comision(), 'ccl': c}))
                tenido += Decimal(q)
            elif tipo == 'venta':
                q = str(max(1, int(tenido * Decimal(rng.randint(10, 60)) / 100)))
                ops.append((f, {'tipo': 'venta', 'cantidad': q, 'precio': precio_actual, 'importe': None, 'comisiones': comision(), 'ccl': c}))
                tenido -= Decimal(q)
            elif tipo == 'ajuste_ratio':
                q = str(int(tenido))  # split 2:1
                ops.append((f, {'tipo': 'ajuste_ratio', 'cantidad': q, 'precio': None, 'importe': None, 'comisiones': '0', 'ccl': c}))
                tenido += Decimal(q)
                precio_actual = format((Decimal(precio_actual) / 2).quantize(Decimal(1).scaleb(-dec_precio)), 'f')
            elif tipo == 'venta_total':
                etiquetas.append('venta_total_previa')
                ops.append((f, {'tipo': 'venta', 'cantidad': str(tenido), 'precio': precio_actual, 'importe': None, 'comisiones': comision(), 'ccl': c}))
                # recompra al día siguiente (si entra antes de t0) o el mismo día no: se recompra solo si hay lugar
                f2 = f + timedelta(days=1)
                if f2 <= t0:
                    q = cant()
                    c2 = caso.nuevo_ccl(f2, c)
                    ops.append((f2, {'tipo': 'compra', 'cantidad': q, 'precio': precio_actual, 'importe': None, 'comisiones': comision(), 'ccl': c2}))
                    tenido = Decimal(q)
                else:
                    tenido = Decimal(0)
            precios[f] = precio_actual
        if tenido == 0:
            # La venta total cayó justo en t0: se reabre en el intervalo como compra nueva.
            escenario = 'nueva_compra'
            etiquetas.append('nueva_compra')
    else:
        tenido = Decimal(0)
        if rng.random() < 0.5:
            precios[d_ini] = precio_actual  # el activo cotizaba antes, aunque no lo tuvieras
            caso.nuevo_ccl(d_ini)

    # ── precio en t0 ──
    r = rng.random()
    if tenido > 0 and r < 0.10 and precios:
        # viejo en t0: la última cotización es anterior a t0 (se borra la de t0 si había)
        precios.pop(t0, None)
        if precios:
            etiquetas.append('viejo_t0')
    elif tenido > 0 and r < 0.14:
        precios.clear()
        etiquetas.append('sin_precio_t0')
    else:
        precio_actual = mover(rng, precio_actual, 0.02, dec_precio)
        precios[t0] = precio_actual

    # ── operaciones del intervalo ──
    def fecha_intervalo() -> date:
        return rng.choice(fechas_intervalo)

    c0 = caso.ccl.get(iso(t0)) or caso.ccl.get(iso(d_ini)) or '1400.00'
    precio_intervalo = mover(rng, precio_actual, 0.02, dec_precio)
    if escenario in ('compra', 'nueva_compra'):
        f = fecha_intervalo()
        op = {'tipo': 'compra', 'cantidad': cant(), 'precio': precio_intervalo, 'importe': None, 'comisiones': comision(), 'ccl': caso.nuevo_ccl(f, c0)}
        if rng.random() < 0.4:
            bruto = Decimal(op['cantidad']) * Decimal(op['precio']) + Decimal(op['comisiones'])
            op['importe'] = format((bruto + Decimal(rng.randint(1, 99_999)) / 100).quantize(Decimal('0.01')), 'f')
            etiquetas.append('compra_importe')
        ops.append((f, op))
        tenido += Decimal(op['cantidad'])
    elif escenario == 'compra_pendiente':
        f = fecha_intervalo()
        op = {'tipo': 'compra', 'cantidad': cant(), 'precio': None, 'importe': None, 'comisiones': '0', 'ccl': caso.nuevo_ccl(f, c0)}
        ops.append((f, op))
        tenido += Decimal(op['cantidad'])
    elif escenario in ('venta_parcial', 'venta_total'):
        f = fecha_intervalo()
        if escenario == 'venta_total':
            q = tenido
        else:
            q = Decimal(max(1, int(tenido * Decimal(rng.randint(10, 80)) / 100)))
            if q >= tenido:
                q = tenido - 1 if tenido > 1 else tenido
        op = {'tipo': 'venta', 'cantidad': str(q), 'precio': precio_intervalo, 'importe': None, 'comisiones': comision(), 'ccl': caso.nuevo_ccl(f, c0)}
        modo = rng.random()
        if modo < 0.3:
            neto = q * Decimal(precio_intervalo) - Decimal(op['comisiones'])
            op['importe'] = format((neto - Decimal(rng.randint(1, 99_999)) / 100).quantize(Decimal('0.01')), 'f')
            etiquetas.append('venta_importe')
        elif modo < 0.45:
            neto = q * Decimal(precio_intervalo) - Decimal(op['comisiones'])
            op['importe'] = format(neto.quantize(Decimal('0.01')), 'f')
            op['precio'] = None
            etiquetas.append('venta_solo_importe')
        ops.append((f, op))
        tenido -= q
    elif escenario == 'apertura_en_intervalo':
        f = fecha_intervalo()
        op = {'tipo': 'apertura', 'cantidad': cant(), 'precio': mover(rng, p_base, 0.08, dec_precio), 'importe': None, 'comisiones': '0', 'ccl': None}
        if rng.random() < 0.5:
            origen = d_ini - timedelta(days=rng.randint(30, 900))
            op['ccl'] = caso.ccl.setdefault(iso(origen), monto(rng, 700, 1500, 2))
            op['fecha_origen'] = iso(origen)
        ops.append((f, op))
        tenido += Decimal(op['cantidad'])
    elif escenario == 'ajuste_ratio':
        f = fecha_intervalo()
        q = str(int(tenido) * rng.choice([1, 2, 4]))
        ops.append((f, {'tipo': 'ajuste_ratio', 'cantidad': q, 'precio': None, 'importe': None, 'comisiones': '0', 'ccl': caso.nuevo_ccl(f, c0)}))
        tenido += Decimal(q)
        precio_actual = format((Decimal(precio_actual) * Decimal(tenido - Decimal(q)) / tenido).quantize(Decimal(1).scaleb(-dec_precio)), 'f')
    elif escenario == 'compra_y_venta':
        f1, f2 = sorted(rng.sample(fechas_intervalo, 2))
        q = cant()
        ops.append((f1, {'tipo': 'compra', 'cantidad': q, 'precio': precio_intervalo, 'importe': None, 'comisiones': comision(), 'ccl': caso.nuevo_ccl(f1, c0)}))
        tenido += Decimal(q)
        qv = Decimal(max(1, int(tenido * Decimal(rng.randint(10, 60)) / 100)))
        p2 = mover(rng, precio_intervalo, 0.01, dec_precio)
        ops.append((f2, {'tipo': 'venta', 'cantidad': str(qv), 'precio': p2, 'importe': None, 'comisiones': comision(), 'ccl': caso.nuevo_ccl(f2, c0)}))
        tenido -= qv

    # ── precio en t1 ──
    if rng.random() < 0.80:
        precios[t1] = mover(rng, precio_actual, 0.03, dec_precio)
    else:
        etiquetas.append('viejo_t1')

    # Los CCL de las fechas con precio (para la variante anclada, I-10).
    for f in precios:
        caso.nuevo_ccl(f, caso.ccl.get(iso(t0)))

    partida = {
        'activo': f'A{k}',
        'riesgo': riesgo,
        'clase': clase,
        'etiquetas': etiquetas,
        'operaciones': [],
        'precios': [{'fecha': iso(f), 'precio': p} for f, p in sorted(precios.items())],
    }
    for f, op in ops:
        partida['operaciones'].append(op | {'fecha': iso(f)})
    return partida


def generar_caso(rng: random.Random, numero: int) -> dict:
    caso = Caso(rng, numero)
    base = date(2026, 1, 5) + timedelta(days=rng.randrange(0, 200))
    d_ini = base
    t0 = d_ini + timedelta(days=rng.randint(6, 45))
    t1 = t0 + timedelta(days=rng.choice([1, 1, 1, 2, 3, 4, 7]))
    ccl0 = caso.nuevo_ccl(t0)
    caso.nuevo_ccl(t1, ccl0)
    caso.nuevo_ccl(d_ini, ccl0)
    flags: set[str] = set()
    r = rng.random()
    if r < 0.03:
        flags.add('sin_ccl_t0')
    elif r < 0.07:
        flags.add('sin_ccl_t1')
    partidas = [generar_partida(caso, k + 1, d_ini, t0, t1, flags) for k in range(rng.randint(1, 4))]
    # Ids globales en orden cronológico (fecha, partida, orden de alta).
    orden = sorted(
        ((op['fecha'], k, i) for k, p in enumerate(partidas) for i, op in enumerate(p['operaciones'])),
    )
    for nuevo_id, (_, k, i) in enumerate(orden, start=1):
        partidas[k]['operaciones'][i]['id'] = nuevo_id
    for p in partidas:
        p['operaciones'].sort(key=lambda op: (op['fecha'], op['id']))
    # Un CCL "sin dato" solo en una fecha sin operaciones (su ccl_del_dia es obligatorio).
    fechas_ops = {op['fecha'] for p in partidas for op in p['operaciones']}
    for flag, t in (('sin_ccl_t0', t0), ('sin_ccl_t1', t1)):
        if flag in flags:
            if iso(t) in fechas_ops:
                flags.discard(flag)
            else:
                caso.ccl[iso(t)] = None
    return {
        'id': f'r{numero:03d}',
        'etiquetas': sorted(flags),
        't0': iso(t0),
        't1': iso(t1),
        'ccl': dict(sorted(caso.ccl.items())),
        'partidas': partidas,
    }


def casos_de_los_documentos() -> list[dict]:
    """Casos armados a mano con los números inventados de los documentos."""
    casos = []
    # D-35 §6.1: CEDEAR de $1.000.000 (CCL 1.000) que sube 10% con CCL 1.120.
    casos.append({
        'id': 'doc_d35_cedear', 'etiquetas': ['doc'], 't0': '2026-03-02', 't1': '2026-03-03',
        'ccl': {'2026-02-02': '950.00', '2026-03-02': '1000', '2026-03-03': '1120'},
        'partidas': [{
            'activo': 'A1', 'riesgo': 'USD', 'clase': 'cedear', 'etiquetas': ['sin_ops'],
            'operaciones': [{'id': 1, 'fecha': '2026-02-02', 'tipo': 'apertura', 'cantidad': '100', 'precio': '9000',
                             'importe': None, 'comisiones': '0', 'ccl': '950.00', 'fecha_origen': '2026-02-02'}],
            'precios': [{'fecha': '2026-03-02', 'precio': '10000'}, {'fecha': '2026-03-03', 'precio': '11000'}],
        }],
    })
    # D-35 §6.1: LECAP de $1.000.000 que pasa a $1.025.000, CCL 1.000 → 1.120.
    casos.append({
        'id': 'doc_d35_lecap', 'etiquetas': ['doc'], 't0': '2026-03-02', 't1': '2026-03-03',
        'ccl': {'2026-03-02': '1000', '2026-03-03': '1120'},
        'partidas': [{
            'activo': 'A1', 'riesgo': 'ARS', 'clase': 'bono', 'etiquetas': ['sin_ops', 'apertura_sin_ccl'],
            'operaciones': [{'id': 1, 'fecha': '2026-03-02', 'tipo': 'apertura', 'cantidad': '1000000', 'precio': '0.98',
                             'importe': None, 'comisiones': '0', 'ccl': None}],
            'precios': [{'fecha': '2026-03-02', 'precio': '1'}, {'fecha': '2026-03-03', 'precio': '1.025'}],
        }],
    })
    # Apéndice B de vision.md: SPY, YPFD, S13N6 y T30J7, del 13/10 al 14/10.
    casos.append({
        'id': 'doc_apendice_b', 'etiquetas': ['doc'], 't0': '2026-10-13', 't1': '2026-10-14',
        'ccl': {'2026-10-01': '1520.00', '2026-10-08': '1519.40', '2026-10-09': '1525.00', '2026-10-13': '1531.70',
                '2026-10-14': '1548.20', '2024-03-01': '1390.00', '2025-11-03': '1502.00', '2025-06-02': '1452.00'},
        'partidas': [
            {'activo': 'SPY', 'riesgo': 'USD', 'clase': 'cedear', 'etiquetas': ['sin_ops'],
             'operaciones': [
                 {'id': 1, 'fecha': '2026-10-01', 'tipo': 'apertura', 'cantidad': '1000', 'precio': '29100',
                  'importe': None, 'comisiones': '0', 'ccl': '1390.00', 'fecha_origen': '2024-03-01'},
                 {'id': 6, 'fecha': '2026-10-09', 'tipo': 'compra', 'cantidad': '240', 'precio': '34500',
                  'importe': None, 'comisiones': '0', 'ccl': '1525.00'}],
             'precios': [{'fecha': '2026-10-01', 'precio': '33000'}, {'fecha': '2026-10-13', 'precio': '34700'},
                         {'fecha': '2026-10-14', 'precio': '35150'}]},
            {'activo': 'YPFD', 'riesgo': 'ARS', 'clase': 'accion', 'etiquetas': ['sin_ops', 'apertura_sin_ccl'],
             'operaciones': [
                 {'id': 2, 'fecha': '2026-10-01', 'tipo': 'apertura', 'cantidad': '300', 'precio': '48200',
                  'importe': None, 'comisiones': '0', 'ccl': None}],
             'precios': [{'fecha': '2026-10-13', 'precio': '52500'}, {'fecha': '2026-10-14', 'precio': '52300'}]},
            {'activo': 'S13N6', 'riesgo': 'ARS', 'clase': 'bono', 'etiquetas': ['sin_ops'],
             'operaciones': [
                 {'id': 3, 'fecha': '2026-10-01', 'tipo': 'apertura', 'cantidad': '11500000', 'precio': '1.0426',
                  'importe': None, 'comisiones': '0', 'ccl': '1502.00', 'fecha_origen': '2025-11-03'}],
             'precios': [{'fecha': '2026-10-13', 'precio': '1.0845'}, {'fecha': '2026-10-14', 'precio': '1.0852'}]},
            {'activo': 'T30J7', 'riesgo': 'ARS', 'clase': 'bono', 'etiquetas': ['sin_ops'],
             'operaciones': [
                 {'id': 4, 'fecha': '2026-10-01', 'tipo': 'apertura', 'cantidad': '8000000', 'precio': '1.097475',
                  'importe': None, 'comisiones': '0', 'ccl': '1452.00', 'fecha_origen': '2025-06-02'},
                 {'id': 5, 'fecha': '2026-10-08', 'tipo': 'compra', 'cantidad': '1000000', 'precio': '1.0986',
                  'importe': None, 'comisiones': '0', 'ccl': '1519.40'}],
             'precios': [{'fecha': '2026-10-13', 'precio': '1.1232'}, {'fecha': '2026-10-14', 'precio': '1.1240'}]},
        ],
    })
    return casos


def _partida(activo: str, riesgo: str, clase: str, etiquetas: list[str], ops: list[dict], precios: list[tuple[str, str]]) -> dict:
    base = {'importe': None, 'comisiones': '0', 'precio': None, 'ccl': None}
    return {
        'activo': activo, 'riesgo': riesgo, 'clase': clase, 'etiquetas': etiquetas,
        'operaciones': [base | o for o in ops],
        'precios': [{'fecha': f, 'precio': x} for f, x in precios],
    }


def casos_minimos() -> list[dict]:
    """Un caso mínimo por cada diferencia que encontró el primer cruce contra el
    motor TS. Números inventados y redondos. Las diferencias 1 a 4 se
    resolvieron con las decisiones A, B y C de la fase 1a (ver el docstring de
    motor_referencia.py): hoy el motor y la referencia coinciden en todos."""
    ap = {'id': 1, 'fecha': '2026-06-01', 'tipo': 'apertura', 'cantidad': '100', 'precio': '9000',
          'ccl': '900', 'fecha_origen': '2025-06-02'}
    ccl_base = {'2025-06-02': '900', '2026-06-01': '950'}
    return [
        # 1. Carga sin CCL en t1: la foto usa el CCL de t0 (decisión B) y nada se atribuye (A).
        {'id': 'min_ccl_sin_dato_t1', 'etiquetas': ['minimo', 'sin_ccl_t1'], 't0': '2026-06-10', 't1': '2026-06-11',
         'ccl': ccl_base | {'2026-06-10': '1000', '2026-06-11': None},
         'partidas': [_partida('A1', 'USD', 'cedear', ['sin_ops'], [ap],
                               [('2026-06-10', '10000'), ('2026-06-11', '11000')])]},
        # 2. Compra del día con precio pendiente (D-19): su flujo va al precio del día (decisión C).
        {'id': 'min_compra_pendiente', 'etiquetas': ['minimo'], 't0': '2026-06-10', 't1': '2026-06-11',
         'ccl': ccl_base | {'2026-06-10': '1000', '2026-06-11': '1100'},
         'partidas': [_partida('A1', 'USD', 'cedear', ['compra_pendiente'],
                               [ap, {'id': 2, 'fecha': '2026-06-11', 'tipo': 'compra', 'cantidad': '10', 'ccl': '1100'}],
                               [('2026-06-10', '10000'), ('2026-06-11', '11000')])]},
        # 3. Posición nueva (no estaba en t0) sin precio nuevo en t1: todo sin atribuir (A).
        {'id': 'min_nueva_sin_precio', 'etiquetas': ['minimo'], 't0': '2026-06-10', 't1': '2026-06-11',
         'ccl': {'2026-06-10': '1000', '2026-06-11': '1100'},
         'partidas': [_partida('A1', 'USD', 'cedear', ['nueva_compra', 'viejo_t1'],
                               [{'id': 1, 'fecha': '2026-06-11', 'tipo': 'compra', 'cantidad': '10', 'precio': '10500', 'ccl': '1100'}],
                               [('2026-06-10', '10000')])]},
        # 4. Venta total en el intervalo, sin cotización nueva: atribuible (I-8), coincide con el motor.
        {'id': 'min_venta_total_sin_precio', 'etiquetas': ['minimo'], 't0': '2026-06-10', 't1': '2026-06-11',
         'ccl': ccl_base | {'2026-06-10': '1000', '2026-06-11': '1100'},
         'partidas': [_partida('A1', 'ARS', 'bono', ['venta_total', 'viejo_t1'],
                               [ap | {'cantidad': '1000', 'precio': '1.00'},
                                {'id': 2, 'fecha': '2026-06-11', 'tipo': 'venta', 'cantidad': '1000', 'precio': '1.03', 'ccl': '1100'}],
                               [('2026-06-10', '1.02')])]},
        # 5. Sin precio en t0: el resultado es "sin dato", y sus partes también (I-9).
        {'id': 'min_sin_precio_t0', 'etiquetas': ['minimo'], 't0': '2026-06-10', 't1': '2026-06-11',
         'ccl': ccl_base | {'2026-06-10': '1000', '2026-06-11': '1100'},
         'partidas': [_partida('A1', 'ARS', 'bono', ['sin_ops', 'sin_precio_t0'],
                               [ap | {'cantidad': '1000', 'precio': '1.00'}], [('2026-06-11', '1.05')])]},
        # 6. Carga express (jue) entre dos completas (mié y vie): el viernes devuelve lo del jueves (A, visión 4.2).
        {'id': 'min_express_entre_completas', 'etiquetas': ['minimo'], 't0': '2026-06-11', 't1': '2026-06-12',
         'ccl': ccl_base | {'2026-06-10': '1000', '2026-06-11': '1100', '2026-06-12': '1120'},
         'partidas': [_partida('A1', 'USD', 'cedear', ['sin_ops', 'viejo_t0'], [ap],
                               [('2026-06-10', '10000'), ('2026-06-12', '11000')])]},
        # 7. Desde la compra sin precio: el TC no usa el valor, pero es parte de un resultado "sin dato" (I-9).
        {'id': 'min_desde_compra_sin_valor', 'etiquetas': ['minimo'], 't0': '2026-06-10', 't1': '2026-06-11',
         'ccl': ccl_base | {'2026-06-10': '1000', '2026-06-11': '1100'},
         'partidas': [_partida('A1', 'USD', 'cedear', ['sin_ops', 'sin_precio_t0', 'viejo_t1'], [ap], [])]},
    ]


def main() -> None:
    errores = ref._autoverificacion()
    if errores:
        raise SystemExit('La referencia no pasa su autoverificación: ' + '; '.join(errores))
    rng = random.Random(SEMILLA)
    casos = casos_de_los_documentos() + casos_minimos() + [generar_caso(rng, n + 1) for n in range(N_AL_AZAR)]
    for c in casos:
        c['esperado'] = ref.a_texto(ref.calcular_caso(c), digitos=DIGITOS_SALIDA)
    salida = {
        'version': 1,
        'semilla': SEMILLA,
        'generado_por': 'tests/referencia/generar_casos.py',
        'nota': 'Números inventados. Montos como texto decimal exacto; null = "sin dato".',
        'casos': casos,
    }
    destino = AQUI / 'casos.json'
    # Un caso por renglón: diffs legibles sin inflar el archivo.
    renglones = ',\n'.join(json.dumps(c, ensure_ascii=False, separators=(',', ':')) for c in casos)
    cabecera = json.dumps({k: v for k, v in salida.items() if k != 'casos'}, ensure_ascii=False)[:-1]
    destino.write_text(f'{cabecera},"casos":[\n{renglones}\n]}}\n', encoding='utf-8')
    etiquetas: dict[str, int] = {}
    for c in casos:
        for p in c['partidas']:
            for e in p['etiquetas']:
                etiquetas[e] = etiquetas.get(e, 0) + 1
        for e in c['etiquetas']:
            etiquetas['caso:' + e] = etiquetas.get('caso:' + e, 0) + 1
    print(f'{len(casos)} casos → {destino}')
    print('partidas por etiqueta:', dict(sorted(etiquetas.items())))


if __name__ == '__main__':
    main()
