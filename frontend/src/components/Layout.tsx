import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Bell, ClipboardList, LayoutDashboard, LogOut, Moon, Package,
  ShoppingBag, Store, Sun, Tags, CreditCard, BarChart3, Bike,
} from 'lucide-react'
import { useAuth } from '../context/auth'
import { notificationsApi } from '../api/notifications'
import { useTheme } from '../hooks/useTheme'
import Button from './ui/Button'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'ع' },
]
const RTL_LANGS = new Set(['ar'])

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-100 dark:text-brand-800'
      : 'text-ink-muted hover:text-ink hover:bg-surface-muted',
  ].join(' ')
}

export default function Layout() {
  const { role, tenantId, logout } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { dark, toggle } = useTheme()
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

  useEffect(() => {
    if (!bellOpen) return
    const onDoc = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [bellOpen])

  function openBell() {
    setBellOpen(v => !v)
    if (unreadCount > 0) markRead()
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-surface-raised/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop transition-transform group-hover:scale-105">
              <ShoppingBag className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-brand-700 dark:text-brand-500">
              {t('brand.name')}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
            {role === 'customer' && (
              <>
                <NavLink to="/" end className={navClass}><Store className="h-4 w-4" />{t('nav.home', 'Home')}</NavLink>
                <NavLink to="/stores" className={navClass}><MapIcon />{t('nav.stores')}</NavLink>
                <NavLink to="/orders" className={navClass}><Package className="h-4 w-4" />{t('nav.myOrders')}</NavLink>
              </>
            )}
            {role === 'manager' && (
              <>
                <NavLink to="/manager" end className={navClass}><ClipboardList className="h-4 w-4" />{t('nav.orderQueue')}</NavLink>
                {tenantId && <NavLink to={`/manager/catalog/${tenantId}`} className={navClass}><Tags className="h-4 w-4" />{t('nav.catalog')}</NavLink>}
                {tenantId && <NavLink to={`/manager/slots/${tenantId}`} className={navClass}><LayoutDashboard className="h-4 w-4" />{t('nav.slots', 'Slots')}</NavLink>}
                <NavLink to="/manager/subscription" className={navClass}><CreditCard className="h-4 w-4" />{t('nav.subscription')}</NavLink>
              </>
            )}
            {role === 'admin' && (
              <>
                <NavLink to="/admin" end className={navClass}><Store className="h-4 w-4" />{t('nav.storesAdmin')}</NavLink>
                <NavLink to="/admin/orders" className={navClass}><Package className="h-4 w-4" />{t('nav.orders', 'Orders')}</NavLink>
                <NavLink to="/admin/reports" className={navClass}><BarChart3 className="h-4 w-4" />{t('nav.reports')}</NavLink>
              </>
            )}
            {role === 'rider' && (
              <NavLink to="/rider" className={navClass}><Bike className="h-4 w-4" />{t('nav.myDeliveries')}</NavLink>
            )}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center rounded-xl border border-line p-0.5 text-xs text-ink-faint">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => changeLang(l.code)}
                  className={`rounded-lg px-2 py-1 transition-colors ${
                    i18n.language === l.code ? 'bg-brand-600 text-white font-semibold' : 'hover:text-ink'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? 'Light mode' : 'Dark mode'}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <div className="relative" ref={bellRef}>
              <Button variant="ghost" size="icon" onClick={openBell} aria-label={t('notifications.title')}>
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className={`absolute top-1 ${isRtl ? 'left-1' : 'right-1'} flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>

              {bellOpen && (
                <div className={`absolute mt-2 w-80 overflow-hidden rounded-card border border-line bg-surface-raised shadow-lift z-50 ${isRtl ? 'left-0' : 'right-0'}`}>
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <span className="text-sm font-semibold text-ink">{t('notifications.title')}</span>
                    <button type="button" onClick={() => setBellOpen(false)} className="text-xs text-ink-faint hover:text-ink">
                      {t('common.close')}
                    </button>
                  </div>
                  <ul className="max-h-72 overflow-y-auto divide-y divide-line">
                    {notifications.length === 0 ? (
                      <li className="px-4 py-8 text-center text-sm text-ink-faint">{t('notifications.empty')}</li>
                    ) : notifications.map(n => (
                      <li key={n.id} className={`px-4 py-3 text-sm ${n.read ? 'text-ink-muted' : 'bg-brand-50/60 text-ink font-medium dark:bg-brand-100/30'}`}>
                        <p>{n.message}</p>
                        <p className="mt-0.5 text-xs text-ink-faint">{new Date(n.createdAt).toLocaleString()}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button variant="ghost" size="sm" onClick={handleLogout} leftIcon={<LogOut className="h-3.5 w-3.5" />} className="text-danger hover:text-danger hidden sm:inline-flex">
              {t('nav.logout')}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label={t('nav.logout')} className="text-danger sm:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile bottom-ish secondary nav strip */}
        <div className="md:hidden border-t border-line overflow-x-auto">
          <div className="flex gap-1 px-3 py-2">
            {role === 'customer' && (
              <>
                <NavLink to="/" end className={navClass}><Store className="h-4 w-4" />Home</NavLink>
                <NavLink to="/stores" className={navClass}><MapIcon />Map</NavLink>
                <NavLink to="/orders" className={navClass}><Package className="h-4 w-4" />Orders</NavLink>
              </>
            )}
            {role === 'manager' && (
              <>
                <NavLink to="/manager" end className={navClass}>Queue</NavLink>
                {tenantId && <NavLink to={`/manager/catalog/${tenantId}`} className={navClass}>Catalog</NavLink>}
                <NavLink to="/manager/subscription" className={navClass}>Plan</NavLink>
              </>
            )}
            {role === 'admin' && (
              <>
                <NavLink to="/admin" end className={navClass}>Stores</NavLink>
                <NavLink to="/admin/orders" className={navClass}>Orders</NavLink>
                <NavLink to="/admin/reports" className={navClass}>Reports</NavLink>
              </>
            )}
            {role === 'rider' && <NavLink to="/rider" className={navClass}>Jobs</NavLink>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 page-enter">
        <Outlet />
      </main>
    </div>
  )
}

function MapIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" x2="9" y1="3" y2="18" />
      <line x1="15" x2="15" y1="6" y2="21" />
    </svg>
  )
}
