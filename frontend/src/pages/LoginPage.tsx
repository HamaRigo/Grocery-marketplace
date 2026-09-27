import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, Mail, ShoppingBag } from 'lucide-react'
import { useAuth } from '../context/auth'
import { authApi } from '../api/auth'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export default function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await authApi.login(email, password)
      setUser(session)
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 80% 0%, rgb(22 163 74 / 0.14), transparent 40%), linear-gradient(180deg, rgb(var(--surface-muted)), rgb(var(--surface)))',
        }}
      />
      <Card className="relative w-full max-w-sm shadow-lift page-enter" padding="lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-ink">Bakala Shop</h1>
            <p className="text-sm text-ink-faint">Staff sign in</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-danger/30 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-danger">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            leftIcon={<Mail className="h-4 w-4" />}
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            leftIcon={<Lock className="h-4 w-4" />}
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-center text-ink-muted">
          Customer?{' '}
          <Link to="/phone" className="text-brand-700 font-medium hover:underline">Order with your phone</Link>
        </p>

        <div className="mt-6 rounded-2xl bg-surface-muted p-3 text-xs text-ink-muted space-y-1">
          <p className="font-semibold text-ink">Demo staff accounts</p>
          <p>Admin: admin@bakala.shop / admin123</p>
          <p>Manager: manager@demo.store / manager123</p>
        </div>
      </Card>
    </div>
  )
}
