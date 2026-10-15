#!/usr/bin/env python3
"""Referencia independiente de la TIR de un contrato de leasing (Pasivos, D-143).

Implementación propia, sin compartir código con src/lib/domain/pasivos/tir.ts:
bisección pura en Decimal (precisión 50) sobre el VPN en días/365, 300 vueltas.
Sirve para contrastar tirContrato() en casos inventados (D-24: ningún número real).

Uso: python3 tests/referencia/tir_referencia.py   → imprime un JSON con cada caso:
     {"nombre", "tea", "tem", "vpn"} (tasas como fracción, texto con 12 decimales).
"""
import json
import sys
from datetime import date
from decimal import Decimal, getcontext

getcontext().prec = 50


def mes_siguiente(d: date, n: int) -> date:
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def vpn(flujos, r: Decimal, t0: date) -> Decimal:
    total = Decimal(0)
    for fecha, monto in flujos:
        t = Decimal((fecha - t0).days) / Decimal(365)
        total += monto / ((Decimal(1) + r) ** t)
    return total


def tir(flujos):
    t0 = min(f for f, _ in flujos)
    lo, hi = Decimal("-0.99"), Decimal("100")
    for _ in range(300):
        mid = (lo + hi) / 2
        if vpn(flujos, mid, t0) > 0:
            lo = mid
        else:
            hi = mid
    r = (lo + hi) / 2
    return r, vpn(flujos, r, t0)


def caso(nombre, financiado, desembolso, primera, n, canon, opcion, fecha_opcion, canones=None):
    flujos = [(desembolso, -Decimal(financiado))]
    for k in range(n):
        c = Decimal(canones[k]) if canones else Decimal(canon)
        flujos.append((mes_siguiente(primera, k), c))
    flujos.append((fecha_opcion, Decimal(opcion)))
    r, v = tir(flujos)
    tem = (Decimal(1) + r) ** (Decimal(1) / Decimal(12)) - 1
    return {"nombre": nombre, "tea": f"{r:.12f}", "tem": f"{tem:.12f}", "vpn": f"{v:.6f}"}


CASOS = [
    # El ejemplo de la app (demo): 35 cánones de $ 1.000.000, opción $ 1.000.000 junto con la última.
    caso("demo", "22000000", date(2025, 7, 25), date(2025, 9, 1), 35, "1000000", "1000000", date(2028, 7, 1)),
    # Un préstamo corto: 12 cuotas, opción chica un mes después de la última.
    caso("corto", "1000000", date(2026, 1, 10), date(2026, 2, 1), 12, "100000", "50000", date(2027, 2, 1)),
    # Cánones que suben (cuotas escalonadas).
    caso(
        "escalonado", "5000000", date(2025, 3, 15), date(2025, 4, 1), 24, None, "250000", date(2027, 3, 1),
        canones=[str(200000 + 5000 * k) for k in range(24)],
    ),
    # Tasa negativa: lo que se paga es menos que lo financiado.
    caso("tasa_negativa", "1000000", date(2026, 1, 1), date(2026, 2, 1), 10, "90000", "0", date(2026, 11, 1)),
]

if __name__ == "__main__":
    json.dump(CASOS, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
