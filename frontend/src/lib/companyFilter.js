// Filtro de empresas del buscador, persistido en localStorage.
//
// Mismo criterio que los favoritos: alguien que siempre toma la misma empresa no
// tiene por que volver a filtrar cada vez que abre la app. Y como es una
// preferencia de visualizacion y no un dato de cuenta, no justifica pedir login.
//
// Se guardan IDS de empresa (no slugs): es lo que traen las micros en
// `bus.company.id` y los recorridos en `route.company.id`, asi que comparar es
// directo y no hay que mapear nada.

const FILTRO_KEY = "miqui.companyFilter"

export const getCompanyFilter = () => {
  try {
    const crudo = localStorage.getItem(FILTRO_KEY)
    if (!crudo) return []
    const guardado = JSON.parse(crudo)
    // Si alguien edito el storage a mano, un valor raro no puede romper el mapa:
    // se cae al filtro vacio, que muestra todo.
    return Array.isArray(guardado) ? guardado.filter((id) => typeof id === "string") : []
  } catch {
    return []
  }
}

export const setCompanyFilter = (ids) => {
  try {
    // Lista vacia = sin filtro. Se borra la clave en vez de guardar "[]" para que
    // el storage no acumule basura de una preferencia que ya no existe.
    if (ids.length === 0) localStorage.removeItem(FILTRO_KEY)
    else localStorage.setItem(FILTRO_KEY, JSON.stringify(ids))
  } catch {
    // Modo incognito o storage lleno: el filtro sigue funcionando en memoria.
  }
}
