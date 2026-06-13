import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { authApi } from '../api/auth'

export default function PhonePage() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [phone, setPhone]   = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await authApi.phoneLogin(phone)
      login(token)
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
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+216 XX XXX XXX"
              className="w-full border-2 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              We'll create your account automatically.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || phone.trim().length < 6}
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
