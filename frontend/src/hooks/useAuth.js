import { useCallback, useEffect, useState } from "react"
import { ApiError, getToken, login as apiLogin, logout as apiLogout, me } from "@/lib/api"

/** El token dura 12h: un 401 no es un error de la pantalla, es la sesion vencida. */
export const isSessionExpired = (error) => error instanceof ApiError && error.status === 401

/**
 * Sesion del panel de empresa. El token vive en localStorage (lo maneja api.js),
 * asi que al montar se revalida contra /auth/me: un token viejo no debe pintar
 * un panel que despues falla en cada llamada.
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(() => Boolean(getToken()))

  useEffect(() => {
    if (!getToken()) return
    let cancelled = false

    me()
      .then((data) => {
        if (!cancelled) setUser(data)
      })
      .catch(() => {
        apiLogout()
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const logged = await apiLogin(email, password)
    setUser(logged)
    return logged
  }, [])

  const signOut = useCallback(() => {
    apiLogout()
    setUser(null)
  }, [])

  return { user, checking, signIn, signOut }
}
