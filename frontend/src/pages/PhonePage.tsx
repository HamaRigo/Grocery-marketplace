import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { authApi } from '../api/auth'

const DEFAULT_COUNTRY_CODE = '+974'

function normalizeCountryCode(raw: string) {
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? `+${digits}` : ''
}

export default function PhonePage() {
  const { setUser } = useAuth()
  const navigate    = useNavigate()
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE)
  const [localNumber, setLocalNumber] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const fullPhone = `${normalizeCountryCode(countryCode)}${localNumber.replace(/[^\d]/g, '')}`

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await authApi.phoneLogin(fullPhone)
      setUser(session)
      navigate('/stores')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-600 mb-1">Bakala</h1>
          <p className="text-gray-500 text-sm">Fresh groceries delivered to you</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your phone number
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                inputMode="tel"
                required
                value={countryCode}
                onChange={e => setCountryCode(normalizeCountryCode(e.target.value) || '+')}
                onBlur={() => setCountryCode(c => normalizeCountryCode(c) || DEFAULT_COUNTRY_CODE)}
                aria-label="Country code"
                className="w-[5.5rem] shrink-0 border-2 rounded-xl px-3 py-3 text-base text-center focus:outline-none focus:border-green-500"
              />
              <input
                type="tel"
                inputMode="numeric"
                required
                value={localNumber}
                onChange={e => setLocalNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                placeholder="XXXX XXXX"
                aria-label="Phone number"
                className="min-w-0 flex-1 border-2 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-green-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Default is Qatar (+974). Change the code if needed.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || localNumber.replace(/\s/g, '').length < 6 || !normalizeCountryCode(countryCode)}
            className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold text-base hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'Connecting…' : 'Start ordering →'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t text-center">
          <Link to="/login" className="text-xs text-gray-400 hover:text-gray-600">
            Store manager or admin? Sign in here
          </Link>
        </div>
      </div>
    </div>
  )
}
