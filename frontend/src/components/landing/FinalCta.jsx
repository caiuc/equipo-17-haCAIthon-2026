import { Reveal } from "./Reveal"

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[var(--surface-dark)] py-24 text-center text-[var(--on-dark)] md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-160px] -z-0 mx-auto h-[420px] max-w-[700px] rounded-full opacity-25 blur-[110px]"
        style={{ background: "var(--accent)" }}
      />
      <Reveal className="relative mx-auto max-w-[720px] px-6">
        <h2 className="text-[32px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[42px]">
          La ingeniería existe para resolver problemas reales.
        </h2>
        <p className="mt-5 text-[17px] leading-[1.6] text-[var(--on-dark-soft)] md:text-[19px]">
          Miqui es nuestra propuesta para acercar el transporte rural a las
          personas que dependen de él todos los días.
        </p>
      </Reveal>
    </section>
  )
}
