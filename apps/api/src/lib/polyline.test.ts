import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline } from './polyline.js';

describe('decodePolyline', () => {
  it('decodifica el ejemplo canonico de la documentacion de Google', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('una cadena vacia es un trazado vacio, no un error', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('una cadena cortada devuelve lo que alcanzo a leer y no lanza', () => {
    // Un pathPolyline corrupto NO puede dejar una micro fuera del mapa: el
    // llamador cae a interpolar entre paraderos.
    const cortada = '_p~iF~ps|U_ulLnnqC_mqN'.slice(0, -1);
    expect(() => decodePolyline(cortada)).not.toThrow();
    expect(decodePolyline(cortada).length).toBeLessThanOrEqual(3);
  });

  it('no se cuelga con basura que no es una polilinea', () => {
    expect(() => decodePolyline('no soy una polilinea!!!')).not.toThrow();
  });
});

describe('encodePolyline', () => {
  it('reproduce el ejemplo canonico', () => {
    expect(
      encodePolyline([
        { lat: 38.5, lng: -120.2 },
        { lat: 40.7, lng: -120.95 },
        { lat: 43.252, lng: -126.453 },
      ]),
    ).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('ida y vuelta conserva las coordenadas hasta los cinco decimales', () => {
    // Un tramo real del corredor Penaflor - San Borja: latitudes negativas y
    // saltos de pocos metros, que es donde un codec mal hecho se rompe.
    const camino = [
      { lat: -33.6182, lng: -70.90739 },
      { lat: -33.61799, lng: -70.90701 },
      { lat: -33.60586, lng: -70.87853 },
      { lat: -33.4545, lng: -70.67987 },
    ];

    for (const [i, punto] of decodePolyline(encodePolyline(camino)).entries()) {
      expect(punto.lat).toBeCloseTo(camino[i]?.lat ?? 0, 5);
      expect(punto.lng).toBeCloseTo(camino[i]?.lng ?? 0, 5);
    }
  });

  it('un trazado vacio se codifica como cadena vacia', () => {
    expect(encodePolyline([])).toBe('');
  });
});
