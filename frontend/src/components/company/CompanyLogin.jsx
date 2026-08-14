import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ErrorNotice, Field } from "./Primitives"

export function CompanyLogin({ onSignIn }) {
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
      // El servidor responde lo mismo ante correo inexistente y clave mala, a
      // proposito. Mostrar su mensaje tal cual: precisarlo delataria que cuentas existen.
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="text-[14px] text-[var(--ink-soft)] hover:text-[var(--ink)]">
          ← Miqui
        </Link>

        <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Panel de empresa
        </h1>
        <p className="mt-2 text-[15px] text-[var(--ink-soft)]">
          Administra tus recorridos, choferes y la flota en ruta.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <Field
            label="Correo"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@bupesa.cl"
          />
          <Field
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ErrorNotice>{error}</ErrorNotice>
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-full bg-[var(--accent)] text-[15px] text-white hover:bg-[var(--accent-deep)]"
          >
            {busy ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-[var(--ink-soft)]">
          Demo: admin@bupesa.cl / demo1234
        </p>
      </div>
    </main>
  )
}
