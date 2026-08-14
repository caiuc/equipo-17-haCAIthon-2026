import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { company } from "@/lib/api"
import { ErrorNotice, Field, Modal, SelectField } from "./Primitives"

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

  const [regions, setRegions] = useState([])
  const [regionId, setRegionId] = useState("")
  const [zoneId, setZoneId] = useState(route?.zone?.id ?? "")
  const [newZoneName, setNewZoneName] = useState("")
  const [creatingZone, setCreatingZone] = useState(false)
  const [zoneError, setZoneError] = useState(null)

  useEffect(() => {
    company
      .listRegions()
      .then((data) => {
        setRegions(Array.isArray(data) ? data : [])
        // Precarga la region que ya tiene la zona asignada, si el recorrido trae una.
        if (route?.zone?.id) {
          const owner = data.find((r) => r.zones.some((z) => z.id === route.zone.id))
          if (owner) setRegionId(owner.id)
        }
      })
      .catch(() => {
        // Sin regiones cargadas el campo de zona simplemente queda vacio: no
        // bloquea crear o editar el recorrido.
      })
  }, [route?.zone?.id])

  const zonesOfRegion = regions.find((r) => r.id === regionId)?.zones ?? []

  const createZone = async () => {
    const name = newZoneName.trim()
    if (!name || !regionId) return
    setCreatingZone(true)
    setZoneError(null)
    try {
      const zone = await company.createZone(regionId, name)
      setRegions((prev) =>
        prev.map((r) => (r.id === regionId ? { ...r, zones: [...r.zones, zone] } : r)),
      )
      setZoneId(zone.id)
      setNewZoneName("")
    } catch (err) {
      if (err.status === 401) return onAuthError()
      setZoneError(err.message)
    } finally {
      setCreatingZone(false)
    }
  }

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
      zoneId: zoneId || null,
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
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Región"
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value)
                setZoneId("")
              }}
            >
              <option value="">Sin asignar</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Zona / ciudad"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              disabled={!regionId}
            >
              <option value="">Sin asignar</option>
              {zonesOfRegion.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </SelectField>
          </div>
          {regionId && (
            <div className="flex items-center gap-2">
              <input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="¿No está tu zona? Créala aquí"
                className="h-9 flex-1 rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!newZoneName.trim() || creatingZone}
                onClick={createZone}
              >
                {creatingZone ? "Creando…" : "Crear"}
              </Button>
            </div>
          )}
          <ErrorNotice>{zoneError}</ErrorNotice>
        </div>

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
