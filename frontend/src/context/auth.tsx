import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
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

  const logout = async () => {
    await authApi.logout().catch(() => null)
    setUser(null)
  }

  const role     = user?.roles[0]?.role ?? null
  const tenantId = user?.roles.find(r => r.tenantId != null)?.tenantId ?? null

  return (
    <Ctx.Provider value={{ user, loading, role, tenantId, setUser, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
