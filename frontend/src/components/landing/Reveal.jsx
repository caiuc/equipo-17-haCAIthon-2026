import { useInView } from "@/lib/useInView"

export function Reveal({ children, delay = 0, className = "" }) {
  const [ref, inView] = useInView()

  return (
    <div
      ref={ref}
      className={`reveal transition-all duration-700 ease-out ${
        inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  )
}
