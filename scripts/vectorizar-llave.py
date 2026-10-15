#!/usr/bin/env python3
"""Vectoriza el contorno de la llave 3D (la versión "plano técnico" del logo principal) con potrace.

Entrada:  capturas/logomain-contorno.png  (líneas blancas sobre negro, 1024×1024, alineado píxel a píxel con
          capturas/logomain-3d.png y capturas/logomain-silueta.png; los tres salen de capturas/cleanmainweblogo.svg)
Salida:   src/data/llave-contorno.json  ({ viewBox, d } para Isotipo3D.astro)
          public/brand/llave-contorno.svg

El marco (MARCO) es el mismo que usa scripts/generar-marca.mjs para recortar el render: así el contorno y el render
quedan superpuestos exactamente.

Uso:  pip install potracer pillow numpy
      python3 scripts/vectorizar-llave.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageChops, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
MARCO = (360, 150, 304, 724)  # x, y, ancho, alto dentro del lienzo de 1024 (igual que MARCO_LLAVE en generar-marca.mjs)


def xy(p) -> tuple[float, float]:
    return (float(p.x), float(p.y))


def fmt(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def a_path(curvas) -> str:
    partes: list[str] = []
    for c in curvas:
        sx, sy = xy(c.start_point)
        partes.append(f"M{fmt(sx)} {fmt(sy)}")
        for s in c.segments:
            ex, ey = xy(s.end_point)
            if s.is_corner:
                cx, cy = xy(s.c)
                partes.append(f"L{fmt(cx)} {fmt(cy)}L{fmt(ex)} {fmt(ey)}")
            else:
                (ax, ay), (bx, by) = xy(s.c1), xy(s.c2)
                partes.append(f"C{fmt(ax)} {fmt(ay)} {fmt(bx)} {fmt(by)} {fmt(ex)} {fmt(ey)}")
        partes.append("Z")
    return "".join(partes)


def bezier(p0, p1, p2, p3, n=12):
    t = np.linspace(0, 1, n)[1:, None]
    p0, p1, p2, p3 = (np.array(p, dtype=float) for p in (p0, p1, p2, p3))
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t**2 * p2 + t**3 * p3


def rasterizar(curvas, forma: tuple[int, int], escala: int = 4) -> np.ndarray:
    alto, ancho = forma
    total = Image.new("1", (ancho * escala, alto * escala), 0)
    for c in curvas:
        puntos = [np.array(xy(c.start_point))]
        actual = puntos[0]
        for s in c.segments:
            tramo = np.array([xy(s.c), xy(s.end_point)]) if s.is_corner else bezier(actual, xy(s.c1), xy(s.c2), xy(s.end_point))
            puntos.extend(tramo)
            actual = np.array(xy(s.end_point))
        capa = Image.new("1", total.size, 0)
        ImageDraw.Draw(capa).polygon([(float(x) * escala, float(y) * escala) for x, y in puntos], fill=1)
        total = ImageChops.logical_xor(total, capa)
    return np.array(total.resize((ancho, alto), Image.Resampling.BOX).convert("L")) > 127


def main() -> None:
    x, y, w, h = MARCO
    lienzo = np.array(Image.open(RAIZ / "capturas/logomain-contorno.png").convert("L"))
    fuera = lienzo.copy()
    fuera[y : y + h, x : x + w] = 0
    if (fuera > 127).any():
        raise SystemExit("El contorno se sale de MARCO: ajusta MARCO aquí y MARCO_LLAVE en generar-marca.mjs.")
    mascara = lienzo[y : y + h, x : x + w] > 127
    # potracer traza los píxeles "oscuros" (valor < 0.5): se invierte la máscara.
    curvas = list(potrace.Bitmap(~mascara).trace(turdsize=4, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                                                 alphamax=1.0, opticurve=True, opttolerance=0.2))
    d = a_path(curvas)
    a, b = rasterizar(curvas, mascara.shape), mascara
    iou = float((a & b).sum() / max((a | b).sum(), 1))
    caja = f"0 0 {w} {h}"
    (RAIZ / "src/data/llave-contorno.json").write_text(json.dumps({"viewBox": caja, "d": d}) + "\n", encoding="utf8")
    (RAIZ / "public/brand/llave-contorno.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{caja}" role="img" aria-label="InmutalKey">'
        f'<title>InmutalKey</title><path fill="#ffffff" fill-rule="evenodd" d="{d}"/></svg>\n', encoding="utf8")
    print(f"contorno: {len(curvas)} curvas, {len(d)} caracteres, IoU {iou:.3f}")


if __name__ == "__main__":
    main()
