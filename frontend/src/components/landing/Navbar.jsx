import { Button } from "@/components/ui/button"

const LINKS = [
  { href: "#problema", label: "El problema" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#tecnologia", label: "Tecnología" },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
        <a href="#top" className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
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

        <Button
          render={<a href="#como-funciona" />}
          className="rounded-full bg-[var(--ink)] px-4 text-[13px] text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--ink)]/85 active:translate-y-0"
        >
          Ver cómo funciona
        </Button>
      </div>
    </header>
  )
}
