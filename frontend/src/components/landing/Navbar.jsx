import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

const LINKS = [
  { href: "#problema", label: "El problema" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#tecnologia", label: "Tecnología" },
]

// Las vistas reales de la app. Van separadas de los anclas de la landing porque
// son navegacion de verdad, no scroll: sin esto no habia forma de llegar al
// mapa sin escribir la URL a mano.
const VISTAS = [
  { to: "/app", label: "Ver el mapa" },
  { to: "/empresa", label: "Panel de empresa" },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
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

          <span className="h-4 w-px bg-[var(--line)]" aria-hidden="true" />

          {VISTAS.map((vista) => (
            <Link
              key={vista.to}
              to={vista.to}
              className="relative text-[14px] text-[var(--ink-soft)] transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-[var(--ink)] after:transition-all after:duration-300 hover:text-[var(--ink)] hover:after:w-full"
            >
              {vista.label}
            </Link>
          ))}
        </nav>

        <Button
          render={<Link to="/app" />}
          className="rounded-full bg-[var(--accent)] px-4 text-[13px] text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--accent-deep)] active:translate-y-0"
        >
          Ver micros en vivo
        </Button>
      </div>
    </header>
  )
}
