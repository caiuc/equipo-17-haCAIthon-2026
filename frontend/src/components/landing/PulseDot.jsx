export function PulseDot({ className = "" }) {
  return (
    <span className={`relative inline-flex size-2.5 ${className}`}>
      <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)] opacity-60" />
      <span className="relative inline-flex size-2.5 rounded-full bg-[var(--accent)]" />
    </span>
  )
}
