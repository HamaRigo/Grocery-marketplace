import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import Layout from './Layout'

export default function ProtectedRoute() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <Layout />
}
