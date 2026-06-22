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
    authApi.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // Stable reference — doesn't change between renders
  const logout = useCallback(async () => {
    await authApi.logout().catch(() => null)
    setUser(null)
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
