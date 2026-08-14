#!/usr/bin/env python3
"""Pre-renderiza sprites de micros por empresa desde los GLB del Car Kit de Kenney.

Por que pre-renderizar en vez de usar los PNG de `Previews/`: esos estan a 31
grados de elevacion, casi de perfil. Un sprite tan lateral no se puede rotar en
2D — a 180 grados la micro queda con las ruedas para arriba. A ~62 grados la
proyeccion es lo bastante cenital como para que `rotate(headingDeg)` en CSS se
lea como un giro sobre el mapa. Ver README.md.

Sin dependencias externas: solo stdlib (zlib, struct, math). Rasterizador
propio con z-buffer, textura muestreada del atlas colormap.png recoloreado y
supersampling para las orillas.

Uso:
    python3 tools/render-sprites/render_sprites.py
"""

from __future__ import annotations

import argparse
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from glb import load_glb  # noqa: E402
from pngio import Image, read_png, write_png  # noqa: E402

# El atlas de Kenney son 8x4 celdas de 64x128. La fila 1 (0-based) es la
# pintura de carroceria: cada modelo usa una columna distinta de esa fila y es
# la unica celda que hay que repintar para cambiarle el color a la micro.
ATLAS_COLS = 8
ATLAS_ROWS = 4
BODY_ROW = 1

# Elevacion de camara. 31 grados (el de los Previews) no permite rotacion 2D.
DEFAULT_ELEVATION_DEG = 62.0

# Luz direccional en espacio de escena: arriba, algo a la izquierda y adelante.
LIGHT = (-0.38, 0.86, 0.34)
AMBIENT = 0.60
DIFFUSE = 0.40

COMPANIES: list[tuple[str, str, str]] = [
    # slug, modelo GLB, color de carroceria.
    # Los slugs son la lista blanca de packages/shared/src/vehicle.ts; "generico"
    # es el DEFAULT_ASSET_SLUG que usan las empresas creadas desde el panel.
    ("generico", "van", "#8E8E93"),
    ("bupesa", "delivery", "#1B5FC1"),
    ("talagante", "delivery", "#B3261E"),
    ("islaval", "delivery", "#0E8F8A"),
    ("damir", "van", "#6D28D9"),
    ("cobrexpress", "delivery", "#C2620E"),
    ("paine", "delivery", "#2E7D32"),
    ("munibus", "suv-luxury", "#BE185D"),
    ("colina", "van", "#334155"),
]


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def body_cell_column(mesh) -> int:
    """Columna del atlas que usa la carroceria de este modelo."""
    counts: dict[int, int] = {}
    for u, v in mesh.uvs:
        row = min(ATLAS_ROWS - 1, int(v * ATLAS_ROWS))
        if row != BODY_ROW:
            continue
        col = min(ATLAS_COLS - 1, int(u * ATLAS_COLS))
        counts[col] = counts.get(col, 0) + 1
    if not counts:
        raise RuntimeError("el modelo no usa ninguna celda de la fila de pintura")
    return max(counts, key=lambda c: counts[c])


def repaint(atlas: Image, column: int, rgb: tuple[int, int, int]) -> Image:
    """Copia del atlas con la celda de carroceria pintada del color pedido."""
    out = Image(atlas.width, atlas.height, bytearray(atlas.pixels))
    cw = atlas.width // ATLAS_COLS
    ch = atlas.height // ATLAS_ROWS
    r, g, b = rgb
    for y in range(BODY_ROW * ch, (BODY_ROW + 1) * ch):
        base = y * atlas.width * 4
        for x in range(column * cw, (column + 1) * cw):
            i = base + x * 4
            out.pixels[i] = r
            out.pixels[i + 1] = g
            out.pixels[i + 2] = b
            out.pixels[i + 3] = 255
    return out


def project(mesh, elevation_deg: float):
    """Camara ortografica: mira desde atras y arriba, morro del vehiculo al norte.

    Los GLB del Car Kit son Y-up con el frente en +Z (los nodos wheel-front-*
    estan en z positivo). Con la camara en (0, sin e, -cos e) el eje +Z del
    modelo cae hacia arriba en pantalla, que es lo que necesita el frontend:
    heading 0 = norte = sprite sin rotar.
    """
    e = math.radians(elevation_deg)
    ce, se = math.cos(e), math.sin(e)
    pts = []
    for x, y, z in mesh.positions:
        sx = x
        sy = y * ce + z * se
        depth = y * se - z * ce  # mayor = mas cerca de la camara
        pts.append((sx, sy, depth))
    return pts


def render(
    mesh,
    atlas: Image,
    size: int,
    supersample: int,
    elevation_deg: float,
    padding: float,
) -> Image:
    pts = project(mesh, elevation_deg)
    res = size * supersample

    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2.0
    cy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2.0
    # Se escala por el radio, no por el bounding box: el frontend rota el sprite
    # sobre su centro y el contenido tiene que caber en el circulo inscrito para
    # que ningun rumbo recorte la micro.
    radius = max(math.hypot(p[0] - cx, p[1] - cy) for p in pts) or 1.0
    scale = (res / 2.0 - padding * supersample) / radius
    half = res / 2.0

    screen = []
    for sx, sy, depth in pts:
        screen.append(((sx - cx) * scale + half, half - (sy - cy) * scale, depth))

    lx, ly, lz = LIGHT
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / ln, ly / ln, lz / ln

    tw, th = atlas.width, atlas.height
    tex = atlas.pixels

    zbuf = [-1e30] * (res * res)
    color = bytearray(res * res * 4)

    uvs = mesh.uvs
    normals = mesh.normals

    for i0, i1, i2 in mesh.triangles:
        x0, y0, d0 = screen[i0]
        x1, y1, d1 = screen[i1]
        x2, y2, d2 = screen[i2]
        area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
        if area == 0.0:
            continue
        inv_area = 1.0 / area

        min_x = max(0, int(math.floor(min(x0, x1, x2))))
        max_x = min(res - 1, int(math.ceil(max(x0, x1, x2))))
        min_y = max(0, int(math.floor(min(y0, y1, y2))))
        max_y = min(res - 1, int(math.ceil(max(y0, y1, y2))))
        if min_x > max_x or min_y > max_y:
            continue

        u0, v0 = uvs[i0]
        u1, v1 = uvs[i1]
        u2, v2 = uvs[i2]
        n0 = normals[i0]
        n1 = normals[i1]
        n2 = normals[i2]

        for py in range(min_y, max_y + 1):
            fy = py + 0.5
            row = py * res
            for px in range(min_x, max_x + 1):
                fx = px + 0.5
                w0 = ((x1 - fx) * (y2 - fy) - (x2 - fx) * (y1 - fy)) * inv_area
                if w0 < 0.0:
                    continue
                w1 = ((x2 - fx) * (y0 - fy) - (x0 - fx) * (y2 - fy)) * inv_area
                if w1 < 0.0:
                    continue
                w2 = 1.0 - w0 - w1
                if w2 < 0.0:
                    continue

                depth = w0 * d0 + w1 * d1 + w2 * d2
                idx = row + px
                if depth <= zbuf[idx]:
                    continue
                zbuf[idx] = depth

                u = w0 * u0 + w1 * u1 + w2 * u2
                v = w0 * v0 + w1 * v1 + w2 * v2
                tx = int(u * tw) % tw
                ty = int(v * th) % th  # glTF: v=0 arriba, igual que el bitmap
                t = (ty * tw + tx) * 4

                nx = w0 * n0[0] + w1 * n1[0] + w2 * n2[0]
                ny = w0 * n0[1] + w1 * n1[1] + w2 * n2[1]
                nz = w0 * n0[2] + w1 * n1[2] + w2 * n2[2]
                nl = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
                ndl = (nx * lx + ny * ly + nz * lz) / nl
                if ndl < 0.0:
                    ndl = -ndl * 0.25  # caras traseras del material doubleSided
                shade = AMBIENT + DIFFUSE * ndl

                o = idx * 4
                r = int(tex[t] * shade)
                g = int(tex[t + 1] * shade)
                b = int(tex[t + 2] * shade)
                color[o] = 255 if r > 255 else r
                color[o + 1] = 255 if g > 255 else g
                color[o + 2] = 255 if b > 255 else b
                color[o + 3] = 255

    return downsample(color, res, size, supersample)


def downsample(src: bytearray, res: int, size: int, factor: int) -> Image:
    """Promedio por caja. El color se promedia solo sobre muestras cubiertas,
    asi el borde no se contamina con negro transparente."""
    out = Image(size, size)
    dst = out.pixels
    n = factor * factor
    for y in range(size):
        for x in range(size):
            r = g = b = cov = 0
            for sy in range(y * factor, y * factor + factor):
                base = (sy * res + x * factor) * 4
                for k in range(factor):
                    o = base + k * 4
                    if src[o + 3]:
                        r += src[o]
                        g += src[o + 1]
                        b += src[o + 2]
                        cov += 1
            o = (y * size + x) * 4
            if cov:
                dst[o] = r // cov
                dst[o + 1] = g // cov
                dst[o + 2] = b // cov
                dst[o + 3] = (cov * 255) // n
    return out


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, "..", ".."))
    ap = argparse.ArgumentParser(description="Genera los sprites de micros por empresa")
    ap.add_argument(
        "--kenney",
        default=os.path.join(root, "apps", "api", "tools", "kenney", "Models", "GLB format"),
        help="carpeta con los .glb y Textures/colormap.png",
    )
    ap.add_argument(
        "--out",
        default=os.path.join(root, "frontend", "public", "assets", "micros"),
        help="carpeta de salida de los sprites",
    )
    ap.add_argument("--size", type=int, default=128)
    ap.add_argument("--supersample", type=int, default=4)
    ap.add_argument("--elevation", type=float, default=DEFAULT_ELEVATION_DEG)
    ap.add_argument("--padding", type=float, default=2.0, help="margen en px del sprite final")
    ap.add_argument("--only", help="genera solo este slug")
    args = ap.parse_args()

    atlas = read_png(os.path.join(args.kenney, "Textures", "colormap.png"))
    os.makedirs(args.out, exist_ok=True)

    cache: dict[str, object] = {}
    total = 0
    for slug, model, color in COMPANIES:
        if args.only and slug != args.only:
            continue
        if model not in cache:
            cache[model] = load_glb(os.path.join(args.kenney, f"{model}.glb"))
        mesh = cache[model]
        painted = repaint(atlas, body_cell_column(mesh), hex_to_rgb(color))
        t0 = time.time()
        img = render(
            mesh, painted, args.size, args.supersample, args.elevation, args.padding
        )
        path = os.path.join(args.out, f"{slug}.png")
        write_png(path, img)
        n = os.path.getsize(path)
        total += n
        print(f"{slug:12s} {model:11s} {color}  {n:6d} B  {time.time() - t0:.2f}s")
    print(f"total {total} B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
