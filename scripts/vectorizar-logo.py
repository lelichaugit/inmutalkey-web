#!/usr/bin/env python3
"""Vectoriza el isotipo plano de InmutalKey con potrace (paquete `potracer`).

Entrada (repo clínico):
  --solido  PNG RGBA del logo sólido (azul marino + azul + esmeralda, con filete claro alrededor de la serpiente)
  --linea   PNG RGB del logo lineal sobre blanco (azul marino + azul)

Salida:
  src/data/logo.json         trazos para `Logo.astro` (el azul marino del sólido y la variante `linea` usan currentColor)
  public/brand/logo-*.svg    archivos sueltos (sólido, contorno y línea)

Imprime el IoU de cada capa contra el original. No es una copia exacta: los originales se conservan en
public/brand/originales/.

Uso:  pip install potracer pillow numpy
      python3 scripts/vectorizar-logo.py --solido ../clinica-nom004/src/assets/logo.png \
                                         --linea  ../clinica-nom004/src/assets/cleanlogo.png
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageChops, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent

# Marco común de ambos PNG (1000×1000): el isotipo ocupa x 386–614, y 176–823.
MARCO = (380, 170, 240, 660)  # x, y, ancho, alto

AZUL_MARINO = "#0d1b35"
AZUL = "#0178b0"
ESMERALDA = "#0a8b69"
AZUL_LINEA = "#2f6f98"


def recortar(arr: np.ndarray) -> np.ndarray:
    x, y, w, h = MARCO
    return arr[y : y + h, x : x + w]


def trazar(mascara: np.ndarray) -> list[potrace.Curve]:
    # potracer traza los píxeles "oscuros" (valor < 0.5): se invierte la máscara.
    bm = potrace.Bitmap(~mascara)
    return list(bm.trace(turdsize=4, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0,
                         opticurve=True, opttolerance=0.2))


def xy(p) -> tuple[float, float]:
    return (float(p.x), float(p.y))


def fmt(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def a_path(curvas: list[potrace.Curve]) -> str:
    partes: list[str] = []
    for c in curvas:
        sx, sy = xy(c.start_point)
        partes.append(f"M{fmt(sx)} {fmt(sy)}")
        for s in c.segments:
            (ex, ey) = xy(s.end_point)
            if s.is_corner:
                (cx, cy) = xy(s.c)
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


def rasterizar(curvas: list[potrace.Curve], forma: tuple[int, int], escala: int = 4) -> np.ndarray:
    """Relleno par-impar (como `fill-rule` de potrace) para medir el IoU."""
    alto, ancho = forma
    total = Image.new("1", (ancho * escala, alto * escala), 0)
    for c in curvas:
        puntos = [np.array(xy(c.start_point))]
        actual = puntos[0]
        for s in c.segments:
            if s.is_corner:
                tramo = np.array([xy(s.c), xy(s.end_point)])
            else:
                tramo = bezier(actual, xy(s.c1), xy(s.c2), xy(s.end_point))
            puntos.extend(tramo)
            actual = np.array(xy(s.end_point))
        capa = Image.new("1", total.size, 0)
        ImageDraw.Draw(capa).polygon([(float(x) * escala, float(y) * escala) for x, y in puntos], fill=1)
        total = ImageChops.logical_xor(total, capa)
    return np.array(total.resize((ancho, alto), Image.Resampling.BOX).convert("L")) > 127


def dilatar(m: np.ndarray, r: int) -> np.ndarray:
    """Dilatación binaria cuadrada de radio r (sin SciPy)."""
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


def iou(a: np.ndarray, b: np.ndarray) -> float:
    return float((a & b).sum() / max((a | b).sum(), 1))


def svg(capas: list[tuple[str, str]], titulo: str) -> str:
    _, _, w, h = MARCO
    cuerpo = "".join(f'<path fill="{color}" d="{d}"/>' for color, d in capas)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{titulo}">'
        f"<title>{titulo}</title>{cuerpo}</svg>\n"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--solido", required=True, type=Path)
    ap.add_argument("--linea", required=True, type=Path)
    args = ap.parse_args()

    # ── Sólido ──
    s = recortar(np.array(Image.open(args.solido).convert("RGBA")).astype(int))
    rgb, alfa = s[..., :3], s[..., 3] > 127
    claro = rgb.mean(-1) > 180  # filete claro alrededor de la serpiente → se recorta (transparente)
    base = alfa & ~claro
    esmeralda = base & (rgb[..., 1] > rgb[..., 2] + 20) & (rgb[..., 1] > 100)
    azul = base & ~esmeralda & (rgb[..., 2] > 120)

    capas_solido = {"base": base, "azul": azul, "esmeralda": esmeralda}
    trazos_solido = {k: trazar(m) for k, m in capas_solido.items()}

    # ── Línea ──
    l = recortar(np.array(Image.open(args.linea).convert("RGB")).astype(int))
    oscuro = l.mean(-1) < 200
    # El azul marino ronda B−R≈37; la serpiente, B−R>80. Los bordes antialias de la serpiente caen como "marino":
    # en `contorno` el azul (dilatado 2 px y recortado a la silueta) se pinta ENCIMA de la silueta completa.
    azul_l = dilatar(oscuro & (l[..., 2] > l[..., 0] + 60), 2) & oscuro
    trazos_linea = {"todo": trazar(oscuro), "azul": trazar(azul_l)}
    mascaras_linea = {"todo": oscuro, "azul": azul_l}

    print("IoU vectorizado vs. original")
    for nombre, curvas in trazos_solido.items():
        print(f"  sólido/{nombre:9s} {iou(rasterizar(curvas, base.shape), capas_solido[nombre]):.3f}")
    for nombre, curvas in trazos_linea.items():
        print(f"  línea/{nombre:10s} {iou(rasterizar(curvas, oscuro.shape), mascaras_linea[nombre]):.3f}")

    d = {k: a_path(v) for k, v in trazos_solido.items()}
    dl = {k: a_path(v) for k, v in trazos_linea.items()}
    _, _, w, h = MARCO

    datos = {
        "viewBox": f"0 0 {w} {h}",
        "fuente": "clinica-nom004/src/assets/{logo,cleanlogo}.png · potrace (scripts/vectorizar-logo.py)",
        "solido": [
            {"color": "currentColor", "d": d["base"]},
            {"color": AZUL, "d": d["azul"]},
            {"color": ESMERALDA, "d": d["esmeralda"]},
        ],
        "contorno": [
            {"color": "currentColor", "d": dl["todo"]},
            {"color": AZUL_LINEA, "d": dl["azul"]},
        ],
        "linea": [{"color": "currentColor", "d": dl["todo"]}],
    }
    destino = RAIZ / "src" / "data" / "logo.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    marca = RAIZ / "public" / "brand"
    marca.mkdir(parents=True, exist_ok=True)
    (marca / "logo-solido.svg").write_text(
        svg([(AZUL_MARINO, d["base"]), (AZUL, d["azul"]), (ESMERALDA, d["esmeralda"])], "InmutalKey"), encoding="utf-8")
    (marca / "logo-solido-claro.svg").write_text(
        svg([("#ffffff", d["base"]), (AZUL, d["azul"]), (ESMERALDA, d["esmeralda"])], "InmutalKey"), encoding="utf-8")
    (marca / "logo-contorno.svg").write_text(
        svg([(AZUL_MARINO, dl["todo"]), (AZUL_LINEA, dl["azul"])], "InmutalKey"), encoding="utf-8")
    (marca / "logo-linea.svg").write_text(svg([(AZUL_MARINO, dl["todo"])], "InmutalKey"), encoding="utf-8")
    print(f"Escrito {destino.relative_to(RAIZ)} y public/brand/logo-*.svg")


if __name__ == "__main__":
    main()
