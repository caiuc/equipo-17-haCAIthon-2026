"""Parser minimo de GLB (glTF 2.0 binario) con solo la stdlib.

Cubre lo que exporta UnityGLTF para el Car Kit de Kenney: escena plana de nodos
con TRS, una primitiva por malla, POSITION / NORMAL / TEXCOORD_0 e indices.
"""

from __future__ import annotations

import json
import math
import struct

_COMPONENT = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
_NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


class Mesh:
    """Triangulos ya transformados a espacio de escena."""

    __slots__ = ("positions", "normals", "uvs", "triangles")

    def __init__(self):
        self.positions: list[tuple[float, float, float]] = []
        self.normals: list[tuple[float, float, float]] = []
        self.uvs: list[tuple[float, float]] = []
        self.triangles: list[tuple[int, int, int]] = []


def _read_accessor(gltf: dict, blob: bytes, index: int) -> list:
    acc = gltf["accessors"][index]
    fmt, size = _COMPONENT[acc["componentType"]]
    n = _NCOMP[acc["type"]]
    count = acc["count"]
    view = gltf["bufferViews"][acc.get("bufferView", 0)]
    base = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride") or n * size
    out = []
    for i in range(count):
        off = base + i * stride
        vals = struct.unpack_from("<" + fmt * n, blob, off)
        out.append(vals[0] if n == 1 else vals)
    return out


def _trs_matrix(node: dict) -> list[list[float]]:
    if "matrix" in node:
        m = node["matrix"]  # glTF guarda column-major
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    t = node.get("translation", [0.0, 0.0, 0.0])
    s = node.get("scale", [1.0, 1.0, 1.0])
    x, y, z, w = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    rot = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    return [
        [rot[r][0] * s[0], rot[r][1] * s[1], rot[r][2] * s[2], t[r]] for r in range(3)
    ] + [[0.0, 0.0, 0.0, 1.0]]


def _mul(a: list[list[float]], b: list[list[float]]) -> list[list[float]]:
    return [[sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def load_glb(path: str) -> Mesh:
    data = open(path, "rb").read()
    if data[:4] != b"glTF":
        raise ValueError(f"{path} no es un GLB")
    gltf: dict = {}
    blob = b""
    off = 12
    while off < len(data):
        length, tag = struct.unpack_from("<I4s", data, off)
        body = data[off + 8 : off + 8 + length]
        if tag == b"JSON":
            gltf = json.loads(body)
        elif tag.rstrip(b"\x00") == b"BIN":
            blob = body
        off += 8 + length

    mesh = Mesh()
    scene = gltf["scenes"][gltf.get("scene", 0)]

    def walk(node_index: int, parent: list[list[float]]) -> None:
        node = gltf["nodes"][node_index]
        world = _mul(parent, _trs_matrix(node))
        if "mesh" in node:
            for prim in gltf["meshes"][node["mesh"]]["primitives"]:
                if prim.get("mode", 4) != 4:
                    continue
                attrs = prim["attributes"]
                pos = _read_accessor(gltf, blob, attrs["POSITION"])
                nrm = (
                    _read_accessor(gltf, blob, attrs["NORMAL"])
                    if "NORMAL" in attrs
                    else [(0.0, 1.0, 0.0)] * len(pos)
                )
                uv = (
                    _read_accessor(gltf, blob, attrs["TEXCOORD_0"])
                    if "TEXCOORD_0" in attrs
                    else [(0.0, 0.0)] * len(pos)
                )
                idx = (
                    _read_accessor(gltf, blob, prim["indices"])
                    if "indices" in prim
                    else list(range(len(pos)))
                )
                base = len(mesh.positions)
                for (px, py, pz), (nx, ny, nz), (u, v) in zip(pos, nrm, uv):
                    mesh.positions.append(
                        (
                            world[0][0] * px + world[0][1] * py + world[0][2] * pz + world[0][3],
                            world[1][0] * px + world[1][1] * py + world[1][2] * pz + world[1][3],
                            world[2][0] * px + world[2][1] * py + world[2][2] * pz + world[2][3],
                        )
                    )
                    wx = world[0][0] * nx + world[0][1] * ny + world[0][2] * nz
                    wy = world[1][0] * nx + world[1][1] * ny + world[1][2] * nz
                    wz = world[2][0] * nx + world[2][1] * ny + world[2][2] * nz
                    ln = math.sqrt(wx * wx + wy * wy + wz * wz) or 1.0
                    mesh.normals.append((wx / ln, wy / ln, wz / ln))
                    mesh.uvs.append((u, v))
                for i in range(0, len(idx) - 2, 3):
                    mesh.triangles.append(
                        (base + idx[i], base + idx[i + 1], base + idx[i + 2])
                    )
        for child in node.get("children", []):
            walk(child, world)

    ident = [[1.0 if r == c else 0.0 for c in range(4)] for r in range(4)]
    for n in scene["nodes"]:
        walk(n, ident)
    return mesh
