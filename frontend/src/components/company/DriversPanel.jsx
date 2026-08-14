import { useEffect, useState } from "react"
import { AlertTriangle, Check, Copy, Pencil, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { company } from "@/lib/api"
import { EmptyState, ErrorNotice, Field, Modal, SelectField } from "./Primitives"

const STATUS = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  ACTIVE: { label: "Activo", variant: "default" },
  SUSPENDED: { label: "Suspendido", variant: "destructive" },
}

export function DriversPanel({ onAuthError }) {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    company
      .listDrivers()
      .then(setDrivers)
      .catch((err) => (err.status === 401 ? onAuthError() : setError(err.message)))
      .finally(() => setLoading(false))
  }, [onAuthError])

  if (loading) return <p className="text-[14px] text-[var(--ink-soft)]">Cargando choferes…</p>

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Choferes</h2>
        <Button
          onClick={() => setCreating(true)}
          className="bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]"
        >
          <Plus /> Dar de alta
        </Button>
      </div>

      <ErrorNotice>{error}</ErrorNotice>

      {drivers.length === 0 ? (
        <EmptyState>Aún no hay choferes dados de alta.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-[var(--line)] text-[12px] tracking-wide text-[var(--ink-soft)] uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Licencia</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                const status = STATUS[driver.driverStatus] ?? { label: "—", variant: "outline" }
                return (
                  <tr key={driver.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--ink)]">{driver.name}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{driver.email}</td>
                    <td className="px-4 py-3 text-[var(--ink-soft)]">{driver.licenseNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="icon-sm" aria-label="Editar" onClick={() => setEditing(driver)}>
                        <Pencil />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateDriverForm
          onAuthError={onAuthError}
          onClose={() => setCreating(false)}
          onCreated={(driver) => {
            setDrivers((prev) => [...prev, driver])
            setCreating(false)
            setCreated(driver)
          }}
        />
      )}

      {created && <TemporaryPasswordNotice driver={created} onClose={() => setCreated(null)} />}

      {editing && (
        <EditDriverForm
          driver={editing}
          onAuthError={onAuthError}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setDrivers((prev) => prev.map((d) => (d.id === saved.id ? saved : d)))
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function CreateDriverForm({ onClose, onCreated, onAuthError }) {
  const [form, setForm] = useState({ name: "", email: "", licenseNumber: "" })
  const [error, setError] = useState(null)
  const [emailError, setEmailError] = useState(null)
  const [busy, setBusy] = useState(false)

  const patch = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setEmailError(null)
    setBusy(true)

    const input = { name: form.name.trim(), email: form.email.trim() }
    if (form.licenseNumber.trim()) input.licenseNumber = form.licenseNumber.trim()

    try {
      onCreated(await company.createDriver(input))
    } catch (err) {
      if (err.status === 401) return onAuthError()
      if (err.status === 409) setEmailError(err.message)
      else setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Dar de alta un chofer" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre" required value={form.name} onChange={(e) => patch("name", e.target.value)} />
        <Field
          label="Correo"
          type="email"
          required
          error={emailError}
          hint="Con este correo entra a la app del chofer."
          value={form.email}
          onChange={(e) => patch("email", e.target.value)}
        />
        <Field
          label="Licencia (opcional)"
          value={form.licenseNumber}
          onChange={(e) => patch("licenseNumber", e.target.value)}
        />
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
            {busy ? "Creando…" : "Crear chofer"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * La clave temporal viaja en claro una sola vez: despues el backend solo guarda
 * el hash. Si se cierra esto sin anotarla, no hay forma de recuperarla.
 */
function TemporaryPasswordNotice({ driver, onClose }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(driver.temporaryPassword)
    setCopied(true)
  }

  return (
    <Modal title={`${driver.name} quedó creado`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="flex gap-2 rounded-lg border border-[var(--accent-deep)]/30 bg-[var(--accent-soft)] p-3 text-[13px] text-[var(--accent-deep)]">
          <AlertTriangle className="mt-px size-4 shrink-0" />
          <span>
            Esta clave se muestra <strong>una sola vez</strong>. Anótala o dictásela ahora al chofer:
            al cerrar esta ventana no se podrá volver a ver. Él deberá cambiarla al entrar.
          </span>
        </p>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-[var(--ink)]">Clave temporal</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--mist)] px-3 py-2.5 font-mono text-[18px] tracking-[0.12em] text-[var(--ink)] select-all">
              {driver.temporaryPassword}
            </code>
            <Button variant="outline" size="icon-lg" aria-label="Copiar clave" onClick={copy}>
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          {copied && <p className="mt-1.5 text-[12px] text-[var(--ink-soft)]">Copiada al portapapeles.</p>}
        </div>

        <p className="text-[13px] text-[var(--ink-soft)]">
          Entra con <strong className="text-[var(--ink)]">{driver.email}</strong>
        </p>

        <Button onClick={onClose} className="bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]">
          Ya la anoté
        </Button>
      </div>
    </Modal>
  )
}

function EditDriverForm({ driver, onClose, onSaved, onAuthError }) {
  const [form, setForm] = useState({
    name: driver.name,
    licenseNumber: driver.licenseNumber ?? "",
    driverStatus: driver.driverStatus ?? "PENDING",
  })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const patch = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      onSaved(
        await company.updateDriver(driver.id, {
          name: form.name.trim(),
          licenseNumber: form.licenseNumber.trim(),
          driverStatus: form.driverStatus,
        })
      )
    } catch (err) {
      if (err.status === 401) return onAuthError()
      setError(err.status === 404 ? "Este chofer ya no existe." : err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Editar a ${driver.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre" required value={form.name} onChange={(e) => patch("name", e.target.value)} />
        <Field
          label="Licencia"
          value={form.licenseNumber}
          onChange={(e) => patch("licenseNumber", e.target.value)}
        />
        <SelectField
          label="Estado"
          value={form.driverStatus}
          onChange={(e) => patch("driverStatus", e.target.value)}
        >
          <option value="PENDING">Pendiente</option>
          <option value="ACTIVE">Activo</option>
          <option value="SUSPENDED">Suspendido</option>
        </SelectField>
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
