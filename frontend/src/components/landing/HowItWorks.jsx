import { PulseDot } from "./PulseDot"
import { Reveal } from "./Reveal"

const STEPS = [
  {
    n: "01",
    title: "El conductor activa el viaje",
    description:
      "Al salir con la micro, abre miqui y activa su recorrido. Nada nuevo que aprender ni instalar en el bus.",
  },
  {
    n: "02",
    title: "La ubicación se envía por intervalos",
    description:
      "Cada 30 a 60 segundos, la app envía la ubicación por mensajería, no en tiempo real, para que funcione incluso con señal débil.",
  },
  {
    n: "03",
    title: "Los pasajeros ven el estado",
    description:
      "En el paradero, la app muestra hace cuánto pasó la micro o una estimación de cuándo llega.",
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-[var(--mist)] py-24 md:py-32">
      <div className="mx-auto max-w-[1120px] px-6">
        <Reveal>
          <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--ink-soft)] uppercase">
            Cómo funciona
          </p>
          <h2 className="mt-4 max-w-[24ch] text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--ink)] md:text-[46px]">
            Tres pasos, sin depender de GPS en tiempo real
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 100}>
              <div className="relative">
                <span className="text-[15px] font-semibold text-[var(--accent)]">
                  {step.n}
                </span>
                <h3 className="mt-3 text-[19px] font-semibold text-[var(--ink)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-[var(--ink-soft)]">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={300} className="mt-16 w-fit">
          <div className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-white px-5 py-3 text-[14px] text-[var(--ink-soft)]">
            <PulseDot />
            Próxima ubicación en 47s
          </div>
        </Reveal>
      </div>
    </section>
  )
}
