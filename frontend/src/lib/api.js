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

/**
 * `companyIds` va repetido en la query string (?companyId=a&companyId=b): el
 * backend lo normaliza a array y hace OR entre empresas.
 */
export const searchRoutes = ({ q, companyIds, zoneId } = {}) => {
  const query = new URLSearchParams()
  if (q) query.set("q", q)
  if (zoneId) query.set("zoneId", zoneId)
  for (const id of companyIds ?? []) query.append("companyId", id)
  const qs = query.toString()
  return request(`/api/routes${qs ? `?${qs}` : ""}`)
}

export const getRoute = (routeId) => request(`/api/routes/${routeId}`)

/** Fichas de empresas: nombre, color, telefono. Alimenta el filtro por empresa. */
export const listCompanies = () => request("/api/companies")

/** Arbol region -> zonas, para los selectores encadenados del filtro. */
export const listRegions = () => request("/api/regions")

/**
 * Fichas publicas de las empresas, cacheadas en memoria por toda la sesion.
 *
 * Son ocho filas que cambian una vez al mes: pedirlas en cada seleccion de micro
 * seria gastar datos moviles del pasajero para releer lo mismo. Se guarda la
 * promesa y no el resultado, asi dos selecciones seguidas mientras la primera
 * sigue en vuelo comparten una sola peticion. Un fallo NO se cachea: se borra
 * para que la siguiente seleccion vuelva a intentar.
 */
let companiesRequest = null

export const getCompanies = () => {
  companiesRequest ??= request("/api/companies").catch((err) => {
    companiesRequest = null
    throw err
  })
  return companiesRequest
}

/**
 * Estado en vivo de un recorrido. Consultar cada LIVE_POLL_INTERVAL_MS.
 * `stopId` es opcional: sin el, distanceMeters viene null en todas las micros.
 */
export const getRouteLive = (routeId, stopId) =>
  request(`/api/routes/${routeId}/live${stopId ? `?stopId=${encodeURIComponent(stopId)}` : ""}`)

/**
 * Todas las micros vivas del mapa, de todas las empresas.
 * `bbox` va en orden OGC: oeste,sur,este,norte. Los filtros vacios no se mandan
 * — el backend valida `bbox` estricto y un string a medias devolveria 400.
 */
export const getLiveBuses = (filters = {}) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== "") query.set(key, String(value))
  }
  const qs = query.toString()
  return request(`/api/live/buses${qs ? `?${qs}` : ""}`)
}

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
  listRegions: () => request("/api/company/regions", { auth: true }),
  /** Upsert case-insensitive: crear "Talagante" dos veces devuelve la misma zona. */
  createZone: (regionId, name) =>
    request(`/api/company/regions/${regionId}/zones`, {
      method: "POST",
      body: { name },
      auth: true,
    }),
  listDrivers: () => request("/api/company/drivers", { auth: true }),
  createDriver: (input) => request("/api/company/drivers", { method: "POST", body: input, auth: true }),
  updateDriver: (id, input) =>
    request(`/api/company/drivers/${id}`, { method: "PATCH", body: input, auth: true }),
  liveTrips: () => request("/api/company/trips/live", { auth: true }),
}

// --- App del chofer ---

export const driver = {
  listRoutes: () => request("/api/driver/routes", { auth: true }),
  /** Turno abierto del chofer, o null. Es lo que permite retomar tras recargar. */
  activeTrip: () => request("/api/driver/trips/active", { auth: true }),
  /** 409 si ya hay un turno abierto; el turno viene en `details.trip` para adoptarlo. */
  startTrip: (routeId) =>
    request("/api/driver/trips/start", { method: "POST", body: { routeId }, auth: true }),
  endTrip: (tripId) => request(`/api/driver/trips/${tripId}/end`, { method: "POST", auth: true }),
  /**
   * Una posicion suelta o el lote acumulado sin senal. La rama de `positions`
   * es la que hace que un corte de senal no pierda el recorrido: se manda todo
   * junto cuando la senal vuelve.
   */
  sendPositions: (tripId, positions) =>
    request(`/api/driver/trips/${tripId}/positions`, {
      method: "POST",
      body: positions.length === 1 ? positions[0] : { positions },
      auth: true,
    }),
  reportOccupancy: (tripId, full) =>
    request(`/api/driver/trips/${tripId}/occupancy`, { method: "POST", body: { full }, auth: true }),
}
