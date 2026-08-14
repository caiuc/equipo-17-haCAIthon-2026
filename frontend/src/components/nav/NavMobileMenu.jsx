import { useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight, LogOut, Menu } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  ACCESSES,
  DASHBOARD_ACCESS,
  ROLE_LABEL,
  displayNameOf,
  initialOf,
  panelLabelFor,
  panelPathFor,
} from "./accesses"

const SECTION_CLASS = "px-4 pt-4 pb-1 text-[12px] font-medium tracking-wide text-[var(--ink-soft)]"

function AccessRow({ access, onNavigate }) {
  const Icon = access.icon
  return (
    <Link
      to={access.to}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors active:bg-[var(--mist)]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mist)]">
        <Icon className="size-4 text-[var(--ink)]" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[16px] text-[var(--ink)]">{access.label}</span>
        {access.tagline && (
          <span className="text-[13px] text-[var(--ink-soft)]">{access.tagline}</span>
        )}
      </span>
      <ChevronRight className="ml-auto size-4 shrink-0 text-[var(--ink-soft)]" />
    </Link>
  )
}

/**
 * Navegacion de la navbar en telefono.
 *
 * Hasta ahora los enlaces estaban bajo `md:flex`, asi que en un telefono — que
 * es el dispositivo real de este caso de uso — la navbar no llevaba a ninguna
 * parte. Aqui van las mismas vistas y la misma sesion que en escritorio.
 */
export function NavMobileMenu({ links, user, checking, onSignOut }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const handleSignOut = () => {
    onSignOut()
    close()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={user ? "Abrir menú (sesión abierta)" : "Abrir menú"}
            className="relative rounded-full text-[var(--ink)] md:hidden"
          />
        }
      >
        <Menu className="size-5" />
        {/* En telefono la barra no tiene sitio para el nombre: el punto avisa
            que hay sesion abierta sin obligar a abrir el menu para saberlo. */}
        {user && (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--accent)]" />
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[88%] max-w-sm gap-0 overflow-y-auto bg-[var(--paper)] p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            <img src="/miqui-mark.svg" alt="" aria-hidden="true" className="h-6 w-auto" />
            miqui
          </SheetTitle>
        </SheetHeader>

        {checking ? (
          <p className="px-4 py-3 text-[14px] text-[var(--ink-soft)]">Revisando sesión…</p>
        ) : user ? (
          <div className="mx-4 mt-2 rounded-2xl border border-[var(--line)] bg-white p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[15px] font-semibold text-[var(--accent-deep)]">
                {initialOf(user)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[var(--ink)]">
                  {displayNameOf(user)}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="shrink-0">
                    {ROLE_LABEL[user.role] ?? user.role}
                  </Badge>
                  <span className="truncate text-[13px] text-[var(--ink-soft)]">{user.email}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                render={<Link to={panelPathFor(user.role)} onClick={close} />}
                className="h-11 flex-1 rounded-xl bg-[var(--ink)] text-[15px] text-white"
              >
                {panelLabelFor(user.role)}
              </Button>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="h-11 rounded-xl px-4 text-[15px]"
              >
                <LogOut className="size-4" />
                Salir
              </Button>
            </div>
          </div>
        ) : null}

        <p className={SECTION_CLASS}>{user ? "Vistas" : "Entrar a"}</p>
        <nav className="px-1">
          {ACCESSES.map((access) => (
            <AccessRow key={access.to} access={access} onNavigate={close} />
          ))}
          <AccessRow access={DASHBOARD_ACCESS} onNavigate={close} />
        </nav>

        {links?.length > 0 && (
          <>
            <p className={SECTION_CLASS}>Sobre Miqui</p>
            <nav className="flex flex-col px-1 pb-6">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className="rounded-xl px-3 py-2.5 text-[15px] text-[var(--ink-soft)] transition-colors active:bg-[var(--mist)]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
