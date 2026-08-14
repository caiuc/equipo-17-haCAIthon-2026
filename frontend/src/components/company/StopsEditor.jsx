import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { company } from "@/lib/api"
import { ErrorNotice, Field, Modal } from "./Primitives"

let nextKey = 0
const blankStop = () => ({ key: `s${nextKey++}`, name: "", lat: "", lng: "" })

const fromApi = (stops) =>
  stops.length >= 2
    ? stops.map((s) => ({ key: `s${nextKey++}`, name: s.name, lat: String(s.lat), lng: String(s.lng) }))
    : [blankStop(), blankStop()]

/**
 * PUT /stops es un reemplazo completo: el orden del array define el stopOrder.
 * Por eso se edita la lista entera en memoria y se guarda de una sola vez, y por
 * eso reordenar es parte del editor y no una accion aparte.
 */
export function StopsEditor({ route, onClose, onSaved, onAuthError }) {
  const [stops, setStops] = useState(() => fromApi(route.stops))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const patch = (index, field, value) =>
    setStops((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))

  const move = (index, delta) =>
    setStops((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const remove = (index) => setStops((prev) => prev.filter((_, i) => i !== index))

  const save = async () => {
    setError(null)

    if (stops.length < 2) {
      setError("Un recorrido necesita al menos dos paraderos: origen y destino.")
      return
    }

    const payload = []
    for (const stop of stops) {
      const lat = Number(stop.lat)
      const lng = Number(stop.lng)
      if (!stop.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        setError("Cada paradero necesita nombre, latitud y longitud.")
        return
      }
      payload.push({ name: stop.name.trim(), lat, lng })
    }

    setBusy(true)
    try {
      const saved = await company.replaceStops(route.id, payload)
      onSaved(saved)
    } catch (err) {
      if (err.status === 401) return onAuthError()
      setError(err.status === 404 ? "Este recorrido ya no existe." : err.message)
      setBusy(false)
    }
  }

  const roleOf = (index) => {
    if (index === 0) return "Origen"
    if (index === stops.length - 1) return "Destino"
    return `Parada ${index}`
  }

  return (
    <Modal wide title={`Paraderos de ${route.name}`} onClose={onClose}>
      <p className="mb-4 text-[13px] text-[var(--ink-soft)]">
        El orden de esta lista es el orden del recorrido: el <strong>primero es el origen</strong> y
        el <strong>último es el destino</strong>. Es lo que permite saber por dónde va la micro.
      </p>

      <div className="flex flex-col gap-3">
        {stops.map((stop, index) => (
          <div key={stop.key} className="rounded-xl border border-[var(--line)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
                {index + 1}. {roleOf(index)}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Subir"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Bajar"
                  disabled={index === stops.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar"
                  disabled={stops.length <= 2}
                  onClick={() => remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
              <Field
                label="Nombre"
                value={stop.name}
                onChange={(e) => patch(index, "name", e.target.value)}
                placeholder="Malloco"
              />
              <Field
                label="Lat"
                type="number"
                step="any"
                value={stop.lat}
                onChange={(e) => patch(index, "lat", e.target.value)}
                placeholder="-33.61"
              />
              <Field
                label="Lng"
                type="number"
                step="any"
                value={stop.lng}
                onChange={(e) => patch(index, "lng", e.target.value)}
                placeholder="-70.86"
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={() => setStops((prev) => [...prev, blankStop()])}
      >
        <Plus /> Agregar paradero
      </Button>

      <div className="mt-4 flex flex-col gap-3">
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
            {busy ? "Guardando…" : "Guardar paraderos"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
