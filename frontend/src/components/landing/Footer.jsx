export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] py-10">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-4 px-6 text-[13px] text-[var(--ink-soft)] md:flex-row">
        <span className="flex items-center gap-2 font-semibold tracking-[-0.02em] text-[var(--ink)]">
          <img src="/miqui-mark.svg" alt="" aria-hidden="true" className="h-6 w-auto" />
          miqui
        </span>
        <p>Transporte rural, visible.</p>
      </div>
    </footer>
  )
}
