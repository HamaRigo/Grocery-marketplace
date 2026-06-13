import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'

export default function Layout() {
  const { role, tenantId, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/phone')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-green-600">Bakala</Link>

          <nav className="flex items-center gap-6 text-sm font-medium">
            {role === 'customer' && (
              <>
                <Link to="/stores" className="text-gray-700 hover:text-green-600">Stores</Link>
                <Link to="/orders" className="text-gray-700 hover:text-green-600">My Orders</Link>
              </>
            )}
            {role === 'manager' && (
              <>
                <Link to="/manager" className="text-gray-700 hover:text-green-600">Order Queue</Link>
                {tenantId && (
                  <Link to={`/manager/catalog/${tenantId}`} className="text-gray-700 hover:text-green-600">
                    Catalog
                  </Link>
                )}
              </>
            )}
            {role === 'admin' && (
              <>
                <Link to="/admin" className="text-gray-700 hover:text-green-600">Stores</Link>
                <Link to="/admin/reports" className="text-gray-700 hover:text-green-600">Reports</Link>
              </>
            )}
            <button
              onClick={handleLogout}
              className="text-red-500 hover:text-red-700"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
