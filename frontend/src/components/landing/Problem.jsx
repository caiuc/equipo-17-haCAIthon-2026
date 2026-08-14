import { Reveal } from "./Reveal"

const COMPARISON = [
  {
    place: "Santiago",
    tone: "muted",
    points: [
      "App Red muestra el recorrido en tiempo real",
      "Los paraderos informan tiempos de espera",
      "Se sabe si la micro ya pasó",
    ],
  },
  {
    place: "Zonas rurales",
    tone: "accent",
    points: [
      "Los horarios existen, pero no se cumplen",
      "El paradero no informa nada",
      "Nadie sabe si la micro pasó, o si vendrá",
    ],
  },
]

export function Problem() {
  return (
    <section
      id="problema"
      className="bg-[var(--surface-dark)] py-24 text-[var(--on-dark)] md:py-32"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <Reveal>
          <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--on-dark-soft)] uppercase">
            El problema
          </p>
          <h2 className="mt-4 max-w-[22ch] text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] md:text-[46px]">
            En Santiago existe Red. En el campo, no existe nada.
          </h2>
          <p className="mt-6 max-w-[62ch] text-[17px] leading-[1.6] text-[var(--on-dark-soft)] md:text-[19px]">
            En sectores rurales, las micros no siguen horarios confiables y la
            gente en los paraderos no tiene forma de saber si el bus ya pasó,
            cuánto falta, o si viene.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {COMPARISON.map((col, i) => (
            <Reveal key={col.place} delay={i * 120}>
              <div
                className={`rounded-[24px] border p-8 ${
                  col.tone === "accent"
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/[0.08]"
                    : "border-[var(--line-dark)] bg-white/[0.03]"
                }`}
              >
                <h3 className="text-[20px] font-semibold">{col.place}</h3>
                <ul className="mt-5 space-y-3">
                  {col.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-[15px] leading-[1.5] text-[var(--on-dark-soft)]"
                    >
                      <span
                        className={`mt-2 size-1.5 shrink-0 rounded-full ${
                          col.tone === "accent" ? "bg-[var(--accent)]" : "bg-[var(--on-dark-soft)]"
                        }`}
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
