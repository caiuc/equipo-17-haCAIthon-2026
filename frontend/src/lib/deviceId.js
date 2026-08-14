const STORAGE_KEY = "equipo17-device-id"

// Identidad estable para votar ocupacion sin cuenta (§POST /trips/{id}/occupancy).
export function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
