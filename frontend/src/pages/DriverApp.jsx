import { useCallback, useState } from "react"
import { Link } from "react-router-dom"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ErrorNotice } from "@/components/company/Primitives"
import { DriverLogin } from "@/components/driver/DriverLogin"
import { RoutePicker } from "@/components/driver/RoutePicker"
import { ShiftPanel } from "@/components/driver/ShiftPanel"
import { useAuth } from "@/hooks/useAuth"
import { useDriverShift } from "@/hooks/useDriverShift"

export default function DriverApp() {
  const { user, checking, signIn, signOut } = useAuth()
  const [expired, setExpired] = useState(false)
  const [notice, setNotice] = useState(null)

  const isDriver = user?.role === "DRIVER"

  // El token dura 12h. Un 401 en cualquier llamada es sesion vencida, no un
  // fallo de esta pantalla: se vuelve al login diciendo por que.
  const handleAuthError = useCallback(() => {
    setExpired(true)
    signOut()
  }, [signOut])

  const { routes, trip, checking: checkingShift, error, startShift, endShift, forgetShift } =
    useDriverShift({ enabled: isDriver, onAuthError: handleAuthError })

  const handleSignIn = useCallback(
    async (email, password) => {
      setExpired(false)
      setNotice(null)
      return signIn(email, password)
    },
    [signIn]
  )

  // El turno se cerro por fuera (otro dispositivo, o el panel de la empresa).
  // Insistir con los POST solo llenaria la pantalla de errores contra un turno
  // que ya no existe: se suelta y se dice.
  const handleTripGone = useCallback(
    (message) => {
      setNotice(message ?? "Tu turno ya no está en curso.")
      forgetShift()
    },
    [forgetShift]
  )

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[16px] text-[var(--ink-soft)]">
        Revisando sesión…
      </main>
    )
  }

  if (!user) {
    return (
      <>
        {expired && (
          <p className="bg-[var(--accent-soft)] px-5 py-2.5 text-center text-[15px] text-[var(--accent-deep)]">
            Tu sesión venció. Vuelve a entrar.
          </p>
        )}
        <DriverLogin onSignIn={handleSignIn} />
      </>
    )
  }

  if (!isDriver) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5 py-10">
        <h1 className="text-[24px] font-semibold text-[var(--ink)]">Esta cuenta no es de chofer</h1>
        <p className="text-[16px] text-[var(--ink-soft)]">
          Entraste con {user.email}. Para transmitir un recorrido necesitas la cuenta de chofer que
          crea tu empresa.
        </p>
        <Button
          onClick={signOut}
          className="h-14 w-full rounded-2xl bg-[var(--ink)] text-[17px] font-semibold text-white"
        >
          Salir
        </Button>
        <Link to="/" className="text-center text-[15px] text-[var(--ink-soft)]">
          Volver a Miqui
        </Link>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <Link to="/" className="text-[16px] font-semibold text-[var(--ink)]">
              Miqui
            </Link>
            <span className="ml-2 text-[16px] text-[var(--ink-soft)]">Chofer</span>
            <p className="truncate text-[13px] text-[var(--ink-soft)]">{user.name ?? user.email}</p>
          </div>
          <Button
            variant="outline"
            onClick={signOut}
            className="h-11 shrink-0 rounded-xl px-4 text-[15px]"
          >
            <LogOut className="size-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-5">
        {notice && (
          <p className="mb-4 rounded-xl bg-[var(--mist)] px-4 py-3 text-[15px] text-[var(--ink)]">
            {notice}
          </p>
        )}

        <div className="mb-4">
          <ErrorNotice>{error}</ErrorNotice>
        </div>

        {checkingShift ? (
          <p className="text-[16px] text-[var(--ink-soft)]">Buscando si tienes un turno abierto…</p>
        ) : trip ? (
          <ShiftPanel
            key={trip.id}
            trip={trip}
            onEnd={endShift}
            onAuthError={handleAuthError}
            onTripGone={handleTripGone}
          />
        ) : (
          <RoutePicker routes={routes} onStart={startShift} />
        )}
      </main>
    </div>
  )
}
