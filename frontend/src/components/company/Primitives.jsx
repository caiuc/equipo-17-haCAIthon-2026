import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Field({ label, hint, error, className, ...props }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-left", className)}>
      <span className="text-[13px] font-medium text-[var(--ink)]">{label}</span>
      <input
        className={cn(
          "h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-[14px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]",
          error && "border-[var(--accent-deep)]"
        )}
        {...props}
      />
      {error ? (
        <span className="text-[12px] text-[var(--accent-deep)]">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-[var(--ink-soft)]">{hint}</span>
      ) : null}
    </label>
  )
}

export function SelectField({ label, className, children, ...props }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-left", className)}>
      <span className="text-[13px] font-medium text-[var(--ink)]">{label}</span>
      <select
        className="h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

/** Mensaje de error del servidor. Nunca se reescribe: se muestra tal cual llega. */
export function ErrorNotice({ children }) {
  if (!children) return null
  return (
    <p className="rounded-lg border border-[var(--accent-deep)]/30 bg-[var(--accent-soft)] px-3 py-2 text-[13px] text-[var(--accent-deep)]">
      {children}
    </p>
  )
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10">
      <div
        className={cn(
          "w-full rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-[14px] text-[var(--ink-soft)]">
      {children}
    </p>
  )
}
