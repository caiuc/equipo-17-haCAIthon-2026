import { useState } from "react"
import { Button } from "@/components/ui/button"
import { company } from "@/lib/api"
import { ErrorNotice, Field, Modal } from "./Primitives"

const DAY_TYPES = [
  { value: "WEEKDAY", label: "Días hábiles" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo y festivos" },
]

/** Un horario por tipo de dia, como maximo tres. Vacio = no se envia ese dia. */
export function SchedulesEditor({ route, onClose, onSaved, onAuthError }) {
  const [rows, setRows] = useState(() =>
    DAY_TYPES.map(({ value }) => {
      const found = route.schedules.find((s) => s.dayType === value)
      return { dayType: value, firstDeparture: found?.firstDeparture ?? "", lastDeparture: found?.lastDeparture ?? "" }
    })
  )
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const patch = (dayType, field, value) =>
    setRows((prev) => prev.map((r) => (r.dayType === dayType ? { ...r, [field]: value } : r)))

  const save = async () => {
    setError(null)
    const filled = rows.filter((r) => r.firstDeparture || r.lastDeparture)

    if (filled.some((r) => !/^\d{1,2}:\d{2}$/.test(r.firstDeparture) || !/^\d{1,2}:\d{2}$/.test(r.lastDeparture))) {
      setError("Cada día con horario necesita primera y última salida en formato HH:MM.")
      return
    }

    setBusy(true)
    try {
      const saved = await company.replaceSchedules(route.id, filled)
      onSaved(saved)
    } catch (err) {
      if (err.status === 401) return onAuthError()
      setError(err.status === 404 ? "Este recorrido ya no existe." : err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Horarios de ${route.name}`} onClose={onClose}>
      <p className="mb-4 text-[13px] text-[var(--ink-soft)]">
        Primera y última salida, referenciales. Deja un día en blanco si no hay servicio.
      </p>

      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.dayType}>
            <p className="mb-1.5 text-[13px] font-medium text-[var(--ink)]">
              {DAY_TYPES.find((d) => d.value === row.dayType).label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Primera"
                placeholder="6:30"
                value={row.firstDeparture}
                onChange={(e) => patch(row.dayType, "firstDeparture", e.target.value)}
              />
              <Field
                label="Última"
                placeholder="21:00"
                value={row.lastDeparture}
                onChange={(e) => patch(row.dayType, "lastDeparture", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <ErrorNotice>{error}</ErrorNotice>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy}
            onClick={save}
            className="bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]"
          >
            {busy ? "Guardando…" : "Guardar horarios"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
