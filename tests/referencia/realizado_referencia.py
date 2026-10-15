#!/usr/bin/env python3
"""Referencia independiente de realizado y no realizado (entrega 4, plan §4 B.2, D-135).

Se escribió a partir del plan y de las decisiones, sin mirar
`src/lib/domain/resultados.ts`. Solo biblioteca estándar, `decimal.Decimal` con
50 dígitos. "Sin dato" es `None` y se propaga: nunca 0. Montos de entrada como
texto (D-32). Números inventados (D-24).

Para una posición y un período (t0, t1]:

- Valor V(t) = cantidad × último precio en o antes de t; en dólares, ÷ el último
  CCL en o antes de t.
- Flujos del período (positivo = entra valor a la posición), cada uno a su CCL
  (el de la operación; si no tiene, el del día): apertura = cantidad × precio de
  ese día (a su valor del día, no a su costo); compra = importe; venta y
  vencimiento = −importe; renta y amortización = −importe.
- resultado = V1 − V0 − ΣF.
- Costo (PPC promedio): apertura y compra suman su costo (la apertura, cantidad
  × PPP; en dólares, ÷ el CCL de compra declarado, o "sin dato"); una venta o un
  vencimiento sacan costo × cantidad ÷ tenencia; una amortización baja el costo
  en lo cobrado, sin pasar de cero; si la tenencia llega a 0, el costo vuelve a 0.
- realizado = Σ cobros de ventas y vencimientos + Σ rentas − Σ costo de lo vendido.
- no realizado = V1 − V0 − Σ aperturas a su valor del día − Σ compras
  + Σ costo de lo vendido + Σ amortizaciones.
- realizado + no realizado = resultado (se verifica acá mismo).

Correr `python3 tests/referencia/realizado_referencia.py` regenera
`tests/referencia/casos-realizado.json` (semilla fija) y verifica la identidad.
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 50
CERO = Decimal(0)

Monto = Decimal | None


def suma(*xs: Monto) -> Monto:
    t = CERO
    for x in xs:
        if x is None:
            return None
        t += x
    return t


def div(a: Monto, b: Monto) -> Monto:
    if a is None or b is None or b == 0:
        return None
    return a / b


def ultimo(serie: dict[str, str], fecha: str) -> Monto:
    ds = sorted(d for d in serie if d <= fecha)
    return Decimal(serie[ds[-1]]) if ds else None


def del_dia(serie: dict[str, str], fecha: str) -> Monto:
    v = ultimo(serie, fecha)
    if v is not None:
        return v
    ds = sorted(d for d in serie if d > fecha)
    return Decimal(serie[ds[0]]) if ds else None


def calcular(caso: dict) -> dict:
    t0, t1 = caso['t0'], caso['t1']
    ccl, precios = caso['ccl'], caso['precios']
    ops = sorted(caso['operaciones'], key=lambda o: (o['fecha'], o['id']))

    def valor(t: str, q: Decimal) -> tuple[Monto, Monto]:
        if q == 0:
            return CERO, CERO
        p = ultimo(precios, t)
        ars = None if p is None else q * p
        return ars, div(ars, ultimo(ccl, t))

    q = CERO
    c_ars: Monto = CERO
    c_usd: Monto = CERO
    q0 = None
    flujos_ars: Monto = CERO
    flujos_usd: Monto = CERO
    cobros = {'ars': CERO, 'usd': CERO}
    vendido = {'ars': CERO, 'usd': CERO}
    falta_costo = {'ars': False, 'usd': False}
    aperturas = {'ars': CERO, 'usd': CERO}
    compras = {'ars': CERO, 'usd': CERO}
    amortizaciones = {'ars': CERO, 'usd': CERO}
    for o in ops:
        if o['fecha'] > t1:
            break
        if q0 is None and o['fecha'] > t0:
            q0 = q
        dentro = o['fecha'] > t0
        cant = Decimal(o['cantidad'])
        ccl_op = Decimal(o['ccl']) if o.get('ccl') else del_dia(ccl, o['fecha'])
        tipo = o['tipo']
        if tipo in ('apertura', 'compra'):
            costo = Decimal(o['importe']) if o.get('importe') else cant * Decimal(o['precio'])
            costo_usd = div(costo, Decimal(o['ccl'])) if o.get('ccl') else None
            if q == 0:
                c_ars, c_usd = CERO, CERO
            q += cant
            c_ars = suma(c_ars, costo)
            c_usd = suma(c_usd, costo_usd)
            if dentro:
                if tipo == 'apertura':
                    f = cant * del_dia(precios, o['fecha'])
                    fu = f / del_dia(ccl, o['fecha'])
                    aperturas['ars'] += f
                    aperturas['usd'] += fu
                else:
                    f = costo
                    fu = costo / ccl_op
                    compras['ars'] += f
                    compras['usd'] += fu
                flujos_ars += f
                flujos_usd += fu
        elif tipo in ('venta', 'vencimiento'):
            if q == 0:
                continue
            factor = min(cant / q, Decimal(1))
            cobro = Decimal(o['importe'])
            if dentro:
                flujos_ars -= cobro
                flujos_usd -= cobro / ccl_op
                cobros['ars'] += cobro
                cobros['usd'] += cobro / ccl_op
                for k, c in (('ars', c_ars), ('usd', c_usd)):
                    if c is None:
                        falta_costo[k] = True
                    else:
                        vendido[k] += c * factor
            c_ars = None if c_ars is None else c_ars - c_ars * factor
            c_usd = None if c_usd is None else c_usd - c_usd * factor
            q -= cant
            if q <= 0:
                q, c_ars, c_usd = CERO, CERO, CERO
        elif tipo == 'renta':
            if dentro:
                imp = Decimal(o['importe'])
                flujos_ars -= imp
                flujos_usd -= imp / ccl_op
                cobros['ars'] += imp
                cobros['usd'] += imp / ccl_op
        elif tipo == 'amortizacion':
            imp = Decimal(o['importe'])
            if dentro:
                flujos_ars -= imp
                flujos_usd -= imp / ccl_op
                amortizaciones['ars'] += imp
                amortizaciones['usd'] += imp / ccl_op
            c_ars = None if c_ars is None else max(c_ars - imp, CERO)
            c_usd = None if c_usd is None else max(c_usd - imp / ccl_op, CERO)
        else:
            raise ValueError(tipo)
    if q0 is None:
        q0 = q
    v0 = valor(t0, q0)
    v1 = valor(t1, q)
    out: dict[str, str | None] = {}
    for i, k in enumerate(('ars', 'usd')):
        flujos = flujos_ars if k == 'ars' else flujos_usd
        resultado = None if v0[i] is None or v1[i] is None else v1[i] - v0[i] - flujos
        realizado = None if falta_costo[k] else cobros[k] - vendido[k]
        no_realizado = (
            None
            if realizado is None or v0[i] is None or v1[i] is None
            else v1[i] - v0[i] - aperturas[k] - compras[k] + vendido[k] + amortizaciones[k]
        )
        if resultado is not None and realizado is not None:
            assert abs(realizado + no_realizado - resultado) < Decimal('1e-30'), (caso['id'], k)
        out[f'resultado_{k}'] = None if resultado is None else str(resultado)
        out[f'realizado_{k}'] = None if realizado is None else str(realizado)
        out[f'no_realizado_{k}'] = None if no_realizado is None else str(no_realizado)
    return out


# ───────────────────────────── generador ─────────────────────────────────────


def generar(rng: random.Random, n: int) -> dict:
    d = date(2026, 9, 1)
    fechas = []
    for _ in range(rng.randint(5, 9)):
        d += timedelta(days=rng.randint(1, 4))
        fechas.append(d.isoformat())
    ccl = {f: f'{rng.randint(95000, 160000) / 100:.2f}' for f in fechas}
    p = rng.randint(800, 6000)
    precios = {}
    for f in fechas:
        p = max(50, p + rng.randint(-300, 320))
        precios[f] = str(p)
    ops = []
    oid = 1
    q = 0
    con_ccl = rng.random() < 0.7
    q = rng.randint(50, 900)
    ops.append({'id': oid, 'fecha': fechas[0], 'tipo': 'apertura', 'cantidad': str(q), 'precio': str(rng.randint(400, 6000)), 'importe': None,
                'ccl': f'{rng.randint(80000, 150000) / 100:.2f}' if con_ccl else None})
    for f in fechas[1:]:
        for _ in range(rng.randint(0, 2)):
            oid += 1
            px = Decimal(precios[f])
            tipo = rng.choice(['compra', 'venta', 'venta', 'renta', 'amortizacion', 'venta_total', 'vencimiento'])
            if tipo == 'compra':
                c = rng.randint(5, 300)
                q += c
                ops.append({'id': oid, 'fecha': f, 'tipo': 'compra', 'cantidad': str(c), 'precio': str(px), 'importe': str(px * c), 'ccl': ccl[f]})
            elif tipo in ('venta', 'venta_total', 'vencimiento') and q > 0:
                c = q if tipo != 'venta' else max(1, q * rng.randint(5, 90) // 100)
                q -= c
                ops.append({'id': oid, 'fecha': f, 'tipo': 'venta' if tipo == 'venta_total' else tipo, 'cantidad': str(c), 'precio': str(px), 'importe': str(px * c), 'ccl': ccl[f]})
            elif tipo == 'renta' and q > 0:
                ops.append({'id': oid, 'fecha': f, 'tipo': 'renta', 'cantidad': '0', 'precio': None, 'importe': str(q * rng.randint(1, 40)), 'ccl': ccl[f]})
            elif tipo == 'amortizacion' and q > 0:
                ops.append({'id': oid, 'fecha': f, 'tipo': 'amortizacion', 'cantidad': '0', 'precio': None, 'importe': str(q * rng.randint(1, 60)), 'ccl': ccl[f]})
    i = rng.randint(0, len(fechas) - 2)
    j = rng.randint(i + 1, len(fechas) - 1)
    riesgo = rng.choice(['USD', 'ARS'])
    caso = {
        'id': f'realizado_{n:02d}',
        'riesgo': riesgo,
        'clase': 'cedear' if riesgo == 'USD' else 'bono',
        't0': fechas[i],
        't1': fechas[j],
        'ccl': ccl,
        'precios': precios,
        'operaciones': ops,
    }
    caso['esperado'] = calcular(caso)
    return caso


def main() -> None:
    rng = random.Random(20261015)
    casos = [generar(rng, n) for n in range(1, 25)]
    destino = Path(__file__).with_name('casos-realizado.json')
    destino.write_text(
        json.dumps(
            {
                'version': 1,
                'semilla': 20261015,
                'generado_por': 'tests/referencia/realizado_referencia.py',
                'nota': 'Números inventados. Montos como texto decimal exacto; null = "sin dato".',
                'casos': casos,
            },
            ensure_ascii=False,
            indent=1,
        )
        + '\n'
    )
    print(f'{len(casos)} casos en {destino}')


if __name__ == '__main__':
    main()
