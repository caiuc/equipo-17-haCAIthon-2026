import { Link } from "react-router-dom"
import { ArrowRight, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ACCESSES,
  ROLE_LABEL,
  displayNameOf,
  initialOf,
  panelLabelFor,
  panelPathFor,
} from "@/components/nav/accesses"
import { useAuth } from "@/hooks/useAuth"

/**
 * Indice de accesos: la misma lista que despliega la navbar, aqui con espacio
 * para explicar cada vista y con las cuentas de la demo a la vista.
 */
export default function DashboardPage() {
  const { user, checking, signOut } = useAuth()

  return (
    <div className="min-h-svh w-full bg-gradient-to-b from-white to-[var(--mist)]">
      <div className="border-b border-[var(--line)] bg-white/50 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <Link to="/" className="text-[14px] text-[var(--ink-soft)] hover:text-[var(--ink)]">
            ← Miqui
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[var(--ink)]">Accesos</h1>
          <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
            Todas las vistas de Miqui en un solo lugar.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {checking ? (
          <p className="mb-6 text-[14px] text-[var(--ink-soft)]">Revisando sesión…</p>
        ) : user ? (
          <div className="mb-8 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[16px] font-semibold text-[var(--accent-deep)]">
                {initialOf(user)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--ink)]">{displayNameOf(user)}</p>
                <p className="truncate text-[13px] text-[var(--ink-soft)]">{user.email}</p>
              </div>
              <Badge variant="secondary" className="ml-auto shrink-0">
                {ROLE_LABEL[user.role] ?? user.role}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                render={<Link to={panelPathFor(user.role)} />}
                className="h-10 rounded-xl bg-[var(--ink)] px-4 text-[14px] text-white"
              >
                {panelLabelFor(user.role)}
              </Button>
              <Button
                variant="outline"
                onClick={signOut}
                className="h-10 rounded-xl px-4 text-[14px]"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        ) : (
          <p className="mb-8 rounded-2xl border border-[var(--line)] bg-white p-5 text-[14px] leading-relaxed text-[var(--ink-soft)] shadow-sm">
            Ver las micros <strong className="font-medium text-[var(--ink)]">no necesita
            cuenta</strong>: entras al mapa y listo. La sesión es solo para choferes y empresas,
            con la cuenta que entrega la empresa.
          </p>
        )}

        <div className="space-y-4">
          {ACCESSES.map((access) => {
            const Icon = access.icon
            return (
              <Link
                key={access.to}
                to={access.to}
                className="group block rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition-all hover:border-[var(--accent)] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-[var(--ink)]">{access.label}</h2>
                      <Badge variant={access.needsLogin ? "outline" : "secondary"}>
                        {access.tagline}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{access.description}</p>
                    {access.demo && (
                      <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
                        Demo: <code className="text-[var(--ink)]">{access.demo}</code>
                      </p>
                    )}
                  </div>
                  <Icon className="size-6 shrink-0 text-[var(--accent)] opacity-60 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-[12px] font-medium text-[var(--accent)]">
                  Abrir
                  <ArrowRight className="size-3.5" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
