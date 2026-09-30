import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, ShoppingBag } from 'lucide-react'
import { useAuth } from '../context/auth'
import { authApi } from '../api/auth'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

const DEFAULT_COUNTRY_CODE = '+974'

function normalizeCountryCode(raw: string) {
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? `+${digits}` : ''
}

export default function PhonePage() {
  const { t } = useTranslation()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE)
  const [localNumber, setLocalNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fullPhone = `${normalizeCountryCode(countryCode)}${localNumber.replace(/[^\d]/g, '')}`

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await authApi.phoneLogin(fullPhone)
      setUser(session)
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface relative overflow-hidden flex items-center justify-center p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 10%, rgb(22 163 74 / 0.18), transparent 45%), radial-gradient(ellipse at 90% 90%, rgb(22 163 74 / 0.12), transparent 40%), linear-gradient(180deg, rgb(var(--surface-muted)), rgb(var(--surface)))',
        }}
      />

      <Card className="relative w-full max-w-sm shadow-lift page-enter" padding="lg">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-brand-700 dark:text-brand-500">{t('brand.name')}</h1>
          <p className="text-ink-muted text-sm mt-1">Fresh groceries delivered to you</p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-danger/30 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-danger">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Your phone number</label>
            <div className="flex gap-2">
              <input
                type="tel"
                inputMode="tel"
                required
                value={countryCode}
                onChange={e => setCountryCode(normalizeCountryCode(e.target.value) || '+')}
                onBlur={() => setCountryCode(c => normalizeCountryCode(c) || DEFAULT_COUNTRY_CODE)}
                aria-label="Country code"
                className="w-[5.5rem] shrink-0 rounded-2xl border border-line bg-surface-raised px-3 py-3 text-base text-center text-ink focus:outline-none focus:ring-2 focus:ring-brand-600/40 focus:border-brand-500"
              />
              <input
                type="tel"
                inputMode="numeric"
                required
                value={localNumber}
                onChange={e => setLocalNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                placeholder="XXXX XXXX"
                aria-label="Phone number"
                className="min-w-0 flex-1 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-brand-600/40 focus:border-brand-500"
              />
            </div>
            <p className="text-xs text-ink-faint mt-1.5">Default is Qatar (+974). Change the code if needed.</p>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={loading}
            disabled={localNumber.replace(/\s/g, '').length < 6 || !normalizeCountryCode(countryCode)}
            leftIcon={<Phone className="h-4 w-4" />}
          >
            {loading ? 'Connecting…' : 'Start ordering'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-line text-center">
          <Link to="/login" className="text-xs text-ink-faint hover:text-ink">
            Store manager or admin? Sign in here
          </Link>
        </div>
      </Card>
    </div>
  )
}
