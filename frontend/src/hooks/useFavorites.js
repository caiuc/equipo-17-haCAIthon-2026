import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "miqui.favorites"

/** Lee el set de favoritos guardado. localStorage vacio o corrupto = sin favoritos. */
function readFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

/**
 * Recorridos favoritos, solo locales (por dispositivo, sin cuenta). Mismo
 * patron que el deviceId del voto de ocupacion en lib/api.js. Favoritos
 * sincronizados a una cuenta de pasajero quedan fuera de este alcance.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState(() => readFavorites())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
  }, [favorites])

  const isFavorite = useCallback((routeId) => favorites.has(routeId), [favorites])

  const toggleFavorite = useCallback((routeId) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(routeId)) next.delete(routeId)
      else next.add(routeId)
      return next
    })
  }, [])

  return { favorites, isFavorite, toggleFavorite }
}
