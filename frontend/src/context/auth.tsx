import { createContext, useContext, useState, type ReactNode } from 'react'

interface JwtPayload {
  sub: string
  roles: Array<{ role: string; tenantId: string | null }>
  exp: number
}

interface AuthCtx {
  token: string | null
  user: JwtPayload | null
  role: string | null
  tenantId: string | null
  login: (token: string) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

function decode(token: string): JwtPayload | null {
  try {
    const [, b64] = token.split('.')
    return JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = localStorage.getItem('token')
  const storedUser = stored ? decode(stored) : null

  const [token, setToken] = useState<string | null>(
    storedUser && storedUser.exp * 1000 > Date.now() ? stored : null
  )
  const [user, setUser] = useState<JwtPayload | null>(
    token ? storedUser : null
  )

  const login = (t: string) => {
    localStorage.setItem('token', t)
    setToken(t)
    setUser(decode(t))
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const role = user?.roles[0]?.role ?? null
  const tenantId = user?.roles.find(r => r.tenantId != null)?.tenantId ?? null

  return (
    <Ctx.Provider value={{ token, user, role, tenantId, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
