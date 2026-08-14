/**
 * Que voto este dispositivo sobre cada turno.
 *
 * El servidor identifica el voto por `x-device-id` pero no lo devuelve: la
 * ocupacion que responde es el veredicto agregado, no "lo que votaste tu". Sin
 * guardarlo aca, los botones no pueden mostrar cual apretaste y el voto no se
 * puede deshacer con conocimiento de causa.
 *
 * Vive en localStorage por el mismo motivo que los favoritos: quien esta apurado
 * en un paradero no se va a crear una cuenta para poder corregir un reporte.
 */

const VOTES_KEY = "miqui.occupancyVotes"

export const getVotes = () => {
  try {
    const raw = localStorage.getItem(VOTES_KEY)
    if (!raw) return {}
    const saved = JSON.parse(raw)
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {}
  } catch {
    // Storage lleno, deshabilitado o editado a mano: no puede romper la vista.
    return {}
  }
}

export const saveVote = (tripId, full) => {
  const votes = { ...getVotes(), [tripId]: full }
  try {
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes))
  } catch {
    // Si no se puede persistir, el voto igual vale en esta sesion.
  }
  return votes
}
