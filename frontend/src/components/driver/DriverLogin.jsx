import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ErrorNotice } from "@/components/company/Primitives"

/**
 * Mismo flujo que el login de empresa, con controles del tamano que exige un
 * telefono montado en el parabrisas: campos de 56 px y texto de 17 px, que es
 * el minimo que no obliga a acercar la cara a la pantalla.
 */
export function DriverLogin({ onSignIn }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSignIn(email.trim(), password)
    } catch (err) {
      // El servidor responde lo mismo ante correo inexistente y clave mala: su
      // mensaje se muestra tal cual, precisarlo delataria que cuentas existen.
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="text-[15px] text-[var(--ink-soft)] hover:text-[var(--ink)]">
          ← Miqui
        </Link>

        <h1 className="mt-6 text-[30px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Modo chofer
        </h1>
        <p className="mt-2 text-[16px] text-[var(--ink-soft)]">
          Entra con la cuenta que te dio tu empresa para transmitir tu recorrido.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-medium text-[var(--ink)]">Correo</span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="chofer1@bupesa.cl"
              className="h-14 rounded-xl border border-[var(--line)] bg-white px-4 text-[17px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-medium text-[var(--ink)]">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-14 rounded-xl border border-[var(--line)] bg-white px-4 text-[17px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
            />
          </label>

          <ErrorNotice>{error}</ErrorNotice>

          <Button
            type="submit"
            disabled={busy}
            className="h-16 w-full rounded-2xl bg-[var(--accent)] text-[18px] font-semibold text-white hover:bg-[var(--accent-deep)]"
          >
            {busy ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  )
}
