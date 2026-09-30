import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { authApi, type SessionUser } from '../api/auth'

interface AuthCtx {
  user: SessionUser | null
  loading: boolean
  role: string | null
  tenantId: string | null
  setUser: (u: SessionUser | null) => void
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Check existing session on mount (e.g. page refresh).
  useEffect(() => {
    if (localStorage.getItem('auth_logged_out') === 'true') {
      setUser(null)
      setLoading(false)
      return
    }

    authApi.me()
      .then(user => {
        if (user) {
          // If we are logged in, ensure the logout flag is cleared
          localStorage.removeItem('auth_logged_out')
          setUser(user)
        } else {
          setUser(null)
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // Stable reference — doesn't change between renders
  const logout = useCallback(async () => {
    setUser(null)
    localStorage.setItem('auth_logged_out', 'true')
    try {
      await authApi.logout()
    } catch (e) {
      console.error('Logout failed:', e)
    }
    window.location.href = '/'
  }, [])

  // Derived values memoized so they only recompute when user changes
  const role     = useMemo(() => user?.roles[0]?.role ?? null, [user])
  const tenantId = useMemo(() => user?.roles.find(r => r.tenantId != null)?.tenantId ?? null, [user])

  // Memoized context value prevents all consumers from re-rendering on unrelated state changes
  const ctxValue = useMemo(
    () => ({ user, loading, role, tenantId, setUser, logout }),
    [user, loading, role, tenantId, logout]
  )

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
