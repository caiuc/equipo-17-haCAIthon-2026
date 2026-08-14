"""Lectura y escritura de PNG con solo la stdlib (zlib + struct).

Suficiente para lo que necesitamos: leer el atlas colormap.png de Kenney y
escribir sprites RGBA de 128x128. No cubre entrelazado Adam7 ni 16 bits.
"""

from __future__ import annotations

import struct
import zlib


class Image:
    """Bitmap RGBA de 8 bits por canal, guardado como bytearray plano."""

    __slots__ = ("width", "height", "pixels")

    def __init__(self, width: int, height: int, pixels: bytearray | None = None):
        self.width = width
        self.height = height
        self.pixels = pixels if pixels is not None else bytearray(width * height * 4)

    def get(self, x: int, y: int) -> tuple[int, int, int, int]:
        i = (y * self.width + x) * 4
        p = self.pixels
        return p[i], p[i + 1], p[i + 2], p[i + 3]

    def set(self, x: int, y: int, r: int, g: int, b: int, a: int = 255) -> None:
        i = (y * self.width + x) * 4
        p = self.pixels
        p[i] = r
        p[i + 1] = g
        p[i + 2] = b
        p[i + 3] = a


_CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def _unfilter(raw: bytes, width: int, height: int, bpp: int, stride: int) -> bytearray:
    out = bytearray(height * stride)
    pos = 0
    prev = bytearray(stride)
    for y in range(height):
        ftype = raw[pos]
        pos += 1
        line = bytearray(raw[pos : pos + stride])
        pos += stride
        if ftype == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                left = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                left = line[i - bpp] if i >= bpp else 0
                upleft = prev[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + _paeth(left, prev[i], upleft)) & 0xFF
        elif ftype != 0:
            raise ValueError(f"filtro PNG desconocido: {ftype}")
        out[y * stride : (y + 1) * stride] = line
        prev = line
    return out


def read_png(path: str) -> Image:
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("no es un PNG")
    pos = 8
    idat = bytearray()
    palette = b""
    trns = b""
    width = height = depth = ctype = 0
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        ctag = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if ctag == b"IHDR":
            width, height, depth, ctype, _comp, _filt, interlace = struct.unpack(
                ">IIBBBBB", body
            )
            if interlace:
                raise ValueError("PNG entrelazado no soportado")
            if depth != 8:
                raise ValueError(f"profundidad {depth} no soportada")
        elif ctag == b"PLTE":
            palette = body
        elif ctag == b"tRNS":
            trns = body
        elif ctag == b"IDAT":
            idat += body
        elif ctag == b"IEND":
            break

    nch = _CHANNELS[ctype]
    stride = width * nch
    raw = _unfilter(zlib.decompress(bytes(idat)), width, height, nch, stride)

    img = Image(width, height)
    out = img.pixels
    for i in range(width * height):
        s = i * nch
        d = i * 4
        if ctype == 6:
            out[d : d + 4] = raw[s : s + 4]
        elif ctype == 2:
            out[d : d + 3] = raw[s : s + 3]
            out[d + 3] = 255
        elif ctype == 0:
            v = raw[s]
            out[d] = out[d + 1] = out[d + 2] = v
            out[d + 3] = 255
        elif ctype == 4:
            v = raw[s]
            out[d] = out[d + 1] = out[d + 2] = v
            out[d + 3] = raw[s + 1]
        elif ctype == 3:
            k = raw[s]
            out[d : d + 3] = palette[k * 3 : k * 3 + 3]
            out[d + 3] = trns[k] if k < len(trns) else 255
    return img


def write_png(path: str, img: Image) -> None:
    stride = img.width * 4
    raw = bytearray()
    for y in range(img.height):
        raw.append(0)  # filtro None: el sprite es chico, no vale la pena buscar
        raw += img.pixels[y * stride : (y + 1) * stride]

    def chunk(tag: bytes, body: bytes) -> bytes:
        return (
            struct.pack(">I", len(body))
            + tag
            + body
            + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", img.width, img.height, 8, 6, 0, 0, 0)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(chunk(b"IHDR", ihdr))
        fh.write(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
        fh.write(chunk(b"IEND", b""))
