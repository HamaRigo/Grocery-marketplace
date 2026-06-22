import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/auth'
import ProtectedRoute from './components/ProtectedRoute'
import PhonePage from './pages/PhonePage'
import LoginPage from './pages/LoginPage'
import CurbsidePage from './pages/customer/CurbsidePage'
import StoresPage from './pages/customer/StoresPage'
import StorePage from './pages/customer/StorePage'
import CartPage from './pages/customer/CartPage'
import OrdersPage from './pages/customer/OrdersPage'
import TrackPage from './pages/customer/TrackPage'
import OrderQueuePage from './pages/manager/OrderQueuePage'
import CatalogPage from './pages/manager/CatalogPage'
import SlotsPage from './pages/manager/SlotsPage'
import AdminStoresPage from './pages/admin/StoresPage'
import ReportsPage from './pages/admin/ReportsPage'
import RiderPage from './pages/rider/RiderPage'
import ActiveJobPage from './pages/rider/ActiveJobPage'

function RoleHome() {
  const { role } = useAuth()
  if (role === 'admin')   return <Navigate to="/admin"   replace />
  if (role === 'manager') return <Navigate to="/manager" replace />
  if (role === 'rider')   return <Navigate to="/rider"   replace />
  return <Navigate to="/stores" replace />
}

function PublicRoute({ element }: { element: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : element
}

export default function App() {
  return (
    <Routes>
      {/* Fully public — no account required */}
      <Route path="/curbside/:tenantId" element={<CurbsidePage />} />

      {/* Public entry points — redirect away if already logged in */}
      <Route path="/phone" element={<PublicRoute element={<PhonePage />} />} />
      <Route path="/login" element={<PublicRoute element={<LoginPage />} />} />

      {/* Authenticated app */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<RoleHome />} />

        <Route path="/stores"           element={<StoresPage />} />
        <Route path="/stores/:id"       element={<StorePage />} />
        <Route path="/cart/:tenantId"   element={<CartPage />} />
        <Route path="/orders"           element={<OrdersPage />} />
        <Route path="/orders/:id/track" element={<TrackPage />} />

        <Route path="/manager"                   element={<OrderQueuePage />} />
        <Route path="/manager/catalog/:tenantId" element={<CatalogPage />} />
        <Route path="/manager/slots/:tenantId"   element={<SlotsPage />} />

        <Route path="/admin"         element={<AdminStoresPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />

        <Route path="/rider"              element={<RiderPage />} />
        <Route path="/rider/job/:jobId"   element={<ActiveJobPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/phone" replace />} />
    </Routes>
  )
}
