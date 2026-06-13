import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/auth'
import ProtectedRoute from './components/ProtectedRoute'
import PhonePage from './pages/PhonePage'
import LoginPage from './pages/LoginPage'
import StoresPage from './pages/customer/StoresPage'
import StorePage from './pages/customer/StorePage'
import CartPage from './pages/customer/CartPage'
import OrdersPage from './pages/customer/OrdersPage'
import TrackPage from './pages/customer/TrackPage'
import OrderQueuePage from './pages/manager/OrderQueuePage'
import CatalogPage from './pages/manager/CatalogPage'
import AdminStoresPage from './pages/admin/StoresPage'
import ReportsPage from './pages/admin/ReportsPage'

function RoleHome() {
  const { role } = useAuth()
  if (role === 'admin')   return <Navigate to="/admin" replace />
  if (role === 'manager') return <Navigate to="/manager" replace />
  return <Navigate to="/stores" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public entry points */}
      <Route path="/phone" element={<PhonePage />} />
      <Route path="/login" element={<LoginPage />} />

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

        <Route path="/admin"         element={<AdminStoresPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/phone" replace />} />
    </Routes>
  )
}
