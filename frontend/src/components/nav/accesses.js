import { Building2, Bus, LayoutGrid, MapPinned } from "lucide-react"

/**
 * Las vistas de la app, declaradas una sola vez.
 *
 * Las leen la navbar (escritorio y movil) y el indice /dashboard. Si la lista
 * viviera duplicada, agregar una vista obligaria a acordarse de tres archivos y
 * uno se quedaria atras — que es justo como /chofer termino sin ningun enlace.
 */
export const ACCESSES = [
  {
    to: "/app",
    icon: MapPinned,
    label: "Ver micros en vivo",
    tagline: "Sin cuenta",
    description: "El mapa con las micros en ruta y hace cuánto se supo de cada una.",
    needsLogin: false,
  },
  {
    to: "/chofer",
    icon: Bus,
    label: "Modo chofer",
    tagline: "Con tu cuenta de chofer",
    description: "Transmite tu posición mientras haces el recorrido.",
    needsLogin: true,
    // El simulador de la demo ocupa chofer1..4: entrar con uno de esos le cierra
    // el turno al de verdad a los pocos segundos.
    demo: "chofer6@bupesa.cl · demo1234",
  },
  {
    to: "/empresa",
    icon: Building2,
    label: "Panel de empresa",
    tagline: "Con tu cuenta de empresa",
    description: "Recorridos, paraderos, choferes y la flota en vivo.",
    needsLogin: true,
    demo: "admin@bupesa.cl · demo1234",
  },
]

/** El indice completo. Va aparte porque no es una vista mas: las contiene a todas. */
export const DASHBOARD_ACCESS = {
  to: "/dashboard",
  icon: LayoutGrid,
  label: "Todos los accesos",
  description: "El índice de las vistas de Miqui.",
}

export const ROLE_LABEL = {
  SUPERADMIN: "Superadmin",
  COMPANY_ADMIN: "Empresa",
  DRIVER: "Chofer",
  PASSENGER: "Pasajero",
}

const PANEL_BY_ROLE = {
  DRIVER: "/chofer",
  COMPANY_ADMIN: "/empresa",
}

// El superadmin todavia no tiene pantalla propia y el pasajero no necesita una:
// ambos caen en el mapa, que es lo unico que les sirve hoy — y por eso el boton
// tampoco les promete un panel que no existe.
export const panelPathFor = (role) => PANEL_BY_ROLE[role] ?? "/app"

export const panelLabelFor = (role) => (PANEL_BY_ROLE[role] ? "Ir a mi panel" : "Ver micros en vivo")

export const displayNameOf = (user) => user?.name ?? user?.email ?? ""

export const initialOf = (user) => (displayNameOf(user).trim()[0] ?? "?").toUpperCase()
