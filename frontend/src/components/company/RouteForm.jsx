import { useState } from "react"
import { Button } from "@/components/ui/button"
import { company } from "@/lib/api"
import { ErrorNotice, Field, Modal } from "./Primitives"

/** Crea o edita un recorrido. `route` null = alta. */
export function RouteForm({ route, onClose, onSaved, onAuthError }) {
  const [form, setForm] = useState({
    name: route?.name ?? "",
    code: route?.code ?? "",
    originName: route?.originName ?? "",
    destinationName: route?.destinationName ?? "",
    active: route?.active ?? true,
  })
  const [error, setError] = useState(null)
  const [codeError, setCodeError] = useState(null)
  const [busy, setBusy] = useState(false)

  const patch = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setCodeError(null)
    setBusy(true)

    const input = {
      name: form.name.trim(),
      code: form.code.trim(),
      originName: form.originName.trim(),
      destinationName: form.destinationName.trim(),
      active: form.active,
    }

    try {
      const saved = route
        ? await company.updateRoute(route.id, input)
        : await company.createRoute(input)
      onSaved(saved)
    } catch (err) {
      if (err.status === 401) return onAuthError()
      // 409 es siempre el codigo duplicado: se muestra donde se escribe.
      if (err.status === 409) setCodeError(err.message)
      else if (err.status === 404) setError("Este recorrido ya no existe.")
      else setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={route ? "Editar recorrido" : "Nuevo recorrido"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Nombre"
          required
          value={form.name}
          onChange={(e) => patch("name", e.target.value)}
          placeholder="Peñaflor - Santiago"
        />
        <Field
          label="Código"
          required
          error={codeError}
          hint="Único dentro de tu empresa. Cada sentido es un recorrido aparte."
          value={form.code}
          onChange={(e) => patch("code", e.target.value)}
          placeholder="VIC-IDA"
        />
        <Field
          label="Origen"
          required
          value={form.originName}
          onChange={(e) => patch("originName", e.target.value)}
          placeholder="Terminal Peñaflor"
        />
        <Field
          label="Destino"
          required
          value={form.destinationName}
          onChange={(e) => patch("destinationName", e.target.value)}
          placeholder="Terminal San Borja"
        />
        <label className="flex items-center gap-2 text-[14px] text-[var(--ink)]">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={form.active}
            onChange={(e) => patch("active", e.target.checked)}
          />
          Recorrido activo
        </label>

        <ErrorNotice>{error}</ErrorNotice>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]"
          >
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
