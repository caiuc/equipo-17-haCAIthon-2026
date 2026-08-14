import { useDriverBroadcast } from "@/hooks/useDriverBroadcast"
import { BroadcastStatus } from "./BroadcastStatus"
import { EndShiftButton } from "./EndShiftButton"
import { ForegroundWarning } from "./ForegroundWarning"
import { LocationPermissionNotice } from "./LocationPermissionNotice"
import { OccupancyControls } from "./OccupancyControls"

const hora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "—"

/**
 * Turno en curso. El orden de la pantalla es el orden de urgencia: primero si
 * falta el permiso de ubicacion (sin eso no hay nada que transmitir), despues el
 * indicador de transmision, y al final lo irreversible.
 */
export function ShiftPanel({ trip, onEnd, onAuthError, onTripGone }) {
  const broadcast = useDriverBroadcast({ tripId: trip.id, onAuthError, onTripGone })

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {trip.routeName}
        </h2>
        <p className="mt-1 text-[15px] text-[var(--ink-soft)]">
          Turno iniciado a las {hora(trip.startedAt)}
        </p>
      </div>

      <LocationPermissionNotice permission={broadcast.permission} />

      <BroadcastStatus
        permission={broadcast.permission}
        geoError={broadcast.geoError}
        fix={broadcast.fix}
        lastSuccessStamp={broadcast.lastSuccessStamp}
        everSent={broadcast.everSent}
        pendingCount={broadcast.pendingCount}
        lastBatchSize={broadcast.lastBatchSize}
        failures={broadcast.failures}
        sendError={broadcast.sendError}
        clockSkew={broadcast.clockSkew}
      />

      <OccupancyControls tripId={trip.id} onAuthError={onAuthError} />

      <ForegroundWarning screenLocked={broadcast.screenLocked} />

      <EndShiftButton onEnd={onEnd} />
    </section>
  )
}
