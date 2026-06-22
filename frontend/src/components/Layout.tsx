import { useCallback, useRef, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/auth'
import { notificationsApi } from '../api/notifications'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'ع'  },
]

const RTL_LANGS = new Set(['ar'])

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export default function Layout() {
  const { role, tenantId, logout } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const isRtl = RTL_LANGS.has(i18n.language)

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/phone')
  }, [logout, navigate])

  const changeLang = useCallback((code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
  }, [i18n])

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const { mutate: markRead } = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter(n => !n.read).length

  function openBell() {
    setBellOpen(v => !v)
    if (unreadCount > 0) markRead()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-green-600">
            {isRtl ? 'بقالة' : 'Bakala'}
          </Link>

          <nav className="flex items-center gap-5 text-sm font-medium">
            {role === 'customer' && (
              <>
                <Link to="/stores" className="text-gray-700 hover:text-green-600">{t('nav.stores')}</Link>
                <Link to="/orders" className="text-gray-700 hover:text-green-600">{t('nav.myOrders')}</Link>
              </>
            )}
            {role === 'manager' && (
              <>
                <Link to="/manager" className="text-gray-700 hover:text-green-600">{t('nav.orderQueue')}</Link>
                {tenantId && (
                  <Link to={`/manager/catalog/${tenantId}`} className="text-gray-700 hover:text-green-600">
                    {t('nav.catalog')}
                  </Link>
                )}
                {tenantId && (
                  <Link to={`/manager/slots/${tenantId}`} className="text-gray-700 hover:text-green-600">
                    {t('nav.slots', 'Slots')}
                  </Link>
                )}
              </>
            )}
            {role === 'admin' && (
              <>
                <Link to="/admin" className="text-gray-700 hover:text-green-600">{t('nav.storesAdmin')}</Link>
                <Link to="/admin/reports" className="text-gray-700 hover:text-green-600">{t('nav.reports')}</Link>
              </>
            )}
            {role === 'rider' && (
              <Link to="/rider" className="text-gray-700 hover:text-green-600">{t('nav.myDeliveries')}</Link>
            )}

            {/* Language switcher */}
            <div className="flex items-center gap-1 border rounded px-2 py-1 text-xs text-gray-500">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`px-1 transition-colors ${
                    i18n.language === l.code
                      ? 'font-bold text-green-600'
                      : 'hover:text-gray-800'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Notification bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={openBell}
                className="relative text-gray-600 hover:text-green-600"
                aria-label={t('notifications.title')}
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className={`absolute -top-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none ${
                    isRtl ? '-left-1' : '-right-1'
                  }`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className={`absolute mt-2 w-80 bg-white border rounded-xl shadow-xl z-50 overflow-hidden ${
                  isRtl ? 'left-0' : 'right-0'
                }`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm text-gray-800">{t('notifications.title')}</span>
                    <button onClick={() => setBellOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">
                      {t('common.close')}
                    </button>
                  </div>
                  <ul className="max-h-72 overflow-y-auto divide-y">
                    {notifications.length === 0 ? (
                      <li className="px-4 py-5 text-sm text-gray-400 text-center">{t('notifications.empty')}</li>
                    ) : notifications.map(n => (
                      <li key={n.id} className={`px-4 py-3 text-sm ${n.read ? 'text-gray-500' : 'text-gray-800 font-medium bg-green-50'}`}>
                        <p>{n.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="text-red-500 hover:text-red-700">
              {t('nav.logout')}
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
