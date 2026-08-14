import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { NavMobileMenu } from "@/components/nav/NavMobileMenu"
import { SessionMenu } from "@/components/nav/SessionMenu"
import { useAuth } from "@/hooks/useAuth"

const LINKS = [
  { href: "#problema", label: "El problema" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#tecnologia", label: "Tecnología" },
]

export function Navbar() {
  // Una sola sesion para toda la navbar: el menu de escritorio y el de telefono
  // comparten este /auth/me en vez de pedirlo cada uno por su lado.
  const { user, checking, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-2 px-4 sm:px-6">
        <a
          href="#top"
          className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.02em] text-[var(--ink)]"
        >
          <img src="/miqui-mark.svg" alt="" aria-hidden="true" className="h-7 w-auto" />
          miqui
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative text-[14px] text-[var(--ink-soft)] transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-[var(--ink)] after:transition-all after:duration-300 hover:text-[var(--ink)] hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Las vistas de la app y la sesion viven en el menu, no sueltas en la
              barra: sin el, a /chofer solo se llegaba escribiendo la URL. */}
          <div className="hidden md:flex">
            <SessionMenu user={user} checking={checking} onSignOut={signOut} />
          </div>

          <Button
            render={<Link to="/app" />}
            className="rounded-full bg-[var(--accent)] px-4 text-[13px] text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--accent-deep)] active:translate-y-0"
          >
            {/* Dos etiquetas y no una con parte oculta: el boton usa flex con
                gap, y un fragmento escondido dejaba igual su hueco. */}
            <span className="sm:hidden">Ver micros</span>
            <span className="hidden sm:inline">Ver micros en vivo</span>
          </Button>

          <NavMobileMenu links={LINKS} user={user} checking={checking} onSignOut={signOut} />
        </div>
      </div>
    </header>
  )
}
