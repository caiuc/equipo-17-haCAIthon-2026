import { Reveal } from "./Reveal"

export function TechNote() {
  return (
    <section id="tecnologia" className="py-24 md:py-32">
      <div className="mx-auto max-w-[1120px] px-6">
        <Reveal>
          <div className="grid gap-12 rounded-[28px] border border-[var(--line)] bg-white p-10 md:grid-cols-[0.9fr_1.1fr] md:p-14">
            <div>
              <p className="text-[13px] font-medium tracking-[0.08em] text-[var(--ink-soft)] uppercase">
                Por qué no en tiempo real
              </p>
              <h2 className="mt-4 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-[var(--ink)] md:text-[34px]">
                Ubicación por intervalos, no streaming constante
              </h2>
            </div>

            <div className="space-y-5 text-[16px] leading-[1.65] text-[var(--ink-soft)]">
              <p>
                El GPS en tiempo real exige buena señal constante, algo que no
                siempre existe en el trayecto de una micro rural. Por eso
                enviamos la ubicación por mensajería cada 30 segundos a un
                minuto, en vez de mantener una conexión abierta todo el
                viaje.
              </p>
              <p>
                Es una decisión de ingeniería: reduce la complejidad de
                infraestructura, tolera cortes de señal y es suficiente para
                responder la pregunta que de verdad importa en el
                paradero: ¿ya pasó, cuánto falta, o viene?
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
