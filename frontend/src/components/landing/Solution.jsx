import { Reveal } from "./Reveal"

const FEATURES = [
  {
    title: "Para pasajeros",
    description:
      "Revisa el estado del servicio antes de salir de tu casa: si la micro ya pasó, cuánto falta, o si hoy no circula.",
  },
  {
    title: "Para conductores",
    description:
      "Comparte tu ubicación con un toque, sin cambiar cómo manejas ni tu recorrido de siempre.",
  },
  {
    title: "Para la comunidad",
    description:
      "Reportes entre vecinos y conductores mantienen la información al día, incluso cuando la señal falla.",
  },
]

export function Solution() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-[1120px] px-6">
        <Reveal>
          <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--ink-soft)] uppercase">
            La solución
          </p>
          <h2 className="mt-4 max-w-[24ch] text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--ink)] md:text-[46px]">
            Una app que junta a pasajeros y conductores
          </h2>
          <p className="mt-6 max-w-[62ch] text-[17px] leading-[1.6] text-[var(--ink-soft)] md:text-[19px]">
            Miqui es el punto de encuentro entre quien maneja la micro y quien
            la espera, para acercar a las personas a un servicio de transporte
            de calidad.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 100}>
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--mist)] p-8 transition-colors hover:bg-[var(--mist)]/70">
                <h3 className="text-[19px] font-semibold text-[var(--ink)]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
