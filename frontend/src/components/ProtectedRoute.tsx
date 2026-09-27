import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import Layout from './Layout'
import { PageSpinner } from './ui/Skeleton'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <PageSpinner />
      </div>
    )
  }

  if (!user) return <Navigate to="/phone" replace />
  return <Layout />
}
