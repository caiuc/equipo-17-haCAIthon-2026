import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanyLogin } from "@/components/company/CompanyLogin"
import { DriversPanel } from "@/components/company/DriversPanel"
import { FleetPanel } from "@/components/company/FleetPanel"
import { RoutesPanel } from "@/components/company/RoutesPanel"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "routes", label: "Recorridos" },
  { id: "drivers", label: "Choferes" },
  { id: "fleet", label: "Flota en vivo" },
]

export default function CompanyApp() {
  const { user, checking, signIn, signOut } = useAuth()
  const [tab, setTab] = useState("routes")
  const [expired, setExpired] = useState(false)

  // El token dura 12h. Un 401 en cualquier panel es sesion vencida, no un fallo
  // de esa pantalla: se limpia la sesion y se vuelve al login con aviso.
  const handleAuthError = useCallback(() => {
    setExpired(true)
    signOut()
  }, [signOut])

  const handleSignIn = useCallback(
    async (email, password) => {
      setExpired(false)
      return signIn(email, password)
    },
    [signIn]
  )

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[14px] text-[var(--ink-soft)]">
        Revisando sesión…
      </main>
    )
  }

  if (!user) {
    return (
      <>
        {expired && (
          <p className="bg-[var(--accent-soft)] px-6 py-2 text-center text-[13px] text-[var(--accent-deep)]">
            Tu sesión venció. Vuelve a entrar.
          </p>
        )}
        <CompanyLogin onSignIn={handleSignIn} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Link to="/" className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              Miqui
            </Link>
            <span className="ml-2 text-[15px] text-[var(--ink-soft)]">Panel de empresa</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-soft)]">{user.name ?? user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut /> Cerrar sesión
            </Button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[1120px] gap-1 px-6">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-[14px] font-medium transition-colors",
                tab === item.id
                  ? "border-[var(--accent)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1120px] px-6 py-8">
        {tab === "routes" && <RoutesPanel onAuthError={handleAuthError} />}
        {tab === "drivers" && <DriversPanel onAuthError={handleAuthError} />}
        {tab === "fleet" && <FleetPanel onAuthError={handleAuthError} />}
      </main>
    </div>
  )
}
