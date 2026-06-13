import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import Layout from './Layout'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/phone" replace />
  return <Layout />
}
