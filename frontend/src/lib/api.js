/**
 * Cliente del API de Miqui.
 *
 * En dev, Vite proxea /api al backend (ver vite.config.js), asi que las llamadas
 * son relativas y no hay CORS. En produccion el front y el API salen por el mismo
 * CloudFront, asi que tambien son relativas: VITE_API_URL solo hace falta si
 * alguien apunta a un backend de otro origen.
 *
 * Contrato completo: GET /api/openapi.yaml
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")

const TOKEN_KEY = "miqui.token"
const DEVICE_KEY = "miqui.deviceId"

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

// --- Sesion ---

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

/**
 * Identidad anonima para el reporte de ocupacion: un voto por dispositivo.
 * Vive en localStorage igual que los favoritos, para no exigir cuenta a alguien
 * que esta apurado en un paradero.
 */
export const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

// --- Transporte ---

async function request(path, { method = "GET", body, auth = false, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(auth && getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (res.status === 204) return null

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    // El backend siempre responde { error: { message, details? } }.
    throw new ApiError(res.status, payload?.error?.message ?? `Error ${res.status}`, payload?.error?.details)
  }

  return payload
}

// --- Publico (sin cuenta) ---

export const searchRoutes = (q) =>
  request(`/api/routes${q ? `?q=${encodeURIComponent(q)}` : ""}`)

export const getRoute = (routeId) => request(`/api/routes/${routeId}`)

/**
 * Estado en vivo de un recorrido. Consultar cada LIVE_POLL_MS.
 * `stopId` es opcional: sin el, distanceMeters viene null en todas las micros.
 */
export const getRouteLive = (routeId, stopId) =>
  request(`/api/routes/${routeId}/live${stopId ? `?stopId=${encodeURIComponent(stopId)}` : ""}`)

/** Reporte colaborativo de ocupacion. Anonimo: se identifica por dispositivo. */
export const reportOccupancy = (tripId, full) =>
  request(`/api/trips/${tripId}/occupancy`, {
    method: "POST",
    body: { full },
    auth: true,
    headers: { "x-device-id": getDeviceId() },
  })

// --- Auth ---

export const login = async (email, password) => {
  const data = await request("/api/auth/login", { method: "POST", body: { email, password } })
  setToken(data.token)
  return data.user
}

export const me = () => request("/api/auth/me", { auth: true })

export const logout = () => clearToken()

// --- Panel de empresa ---

export const company = {
  listRoutes: () => request("/api/company/routes", { auth: true }),
  createRoute: (input) => request("/api/company/routes", { method: "POST", body: input, auth: true }),
  updateRoute: (id, input) =>
    request(`/api/company/routes/${id}`, { method: "PATCH", body: input, auth: true }),
  deleteRoute: (id) => request(`/api/company/routes/${id}`, { method: "DELETE", auth: true }),
  /** Reemplazo completo: el orden del array define el stopOrder. */
  replaceStops: (id, stops) =>
    request(`/api/company/routes/${id}/stops`, { method: "PUT", body: { stops }, auth: true }),
  replaceSchedules: (id, schedules) =>
    request(`/api/company/routes/${id}/schedules`, { method: "PUT", body: { schedules }, auth: true }),
  listDrivers: () => request("/api/company/drivers", { auth: true }),
  createDriver: (input) => request("/api/company/drivers", { method: "POST", body: input, auth: true }),
  updateDriver: (id, input) =>
    request(`/api/company/drivers/${id}`, { method: "PATCH", body: input, auth: true }),
  liveTrips: () => request("/api/company/trips/live", { auth: true }),
}
