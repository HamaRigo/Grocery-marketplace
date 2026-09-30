import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight, Heart, MapPin, Search, Sparkles, Truck, LocateFixed,
} from 'lucide-react'
import { storesApi, type Store } from '../../api/stores'
import { useAuth } from '../../context/auth'
import StoreCard from '../../components/StoreCard'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Chip from '../../components/ui/Chip'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonCard } from '../../components/ui/Skeleton'
import LocationMap, { DEFAULT_CENTER, type MapPoint } from '../../components/map/LocationMap'
import { STORE_CATEGORIES, inferStoreCategory, type StoreCategory } from '../../lib/categories'
import { reverseGeocodeZone } from '../../lib/geocode'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const asked = useRef(false)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [zoneName, setZoneName] = useState<string | null>(null)
  const [category, setCategory] = useState<StoreCategory | 'all'>('all')

  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores', lat, lng],
    queryFn: () => storesApi.list(lat ? Number(lat) : undefined, lng ? Number(lng) : undefined),
    staleTime: 5 * 60_000,
  })

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: storesApi.getFavorites,
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  const favoriteIds = new Set(favorites?.map(f => f.store?.id).filter(Boolean))

  const { mutate: toggleFavorite } = useMutation({
    mutationFn: (store: Store) =>
      favoriteIds.has(store.id)
        ? storesApi.removeFavorite(store.id)
        : storesApi.addFavorite(store.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setZoneName(null)
    navigator.geolocation.getCurrentPosition(pos => {
      setLat(String(pos.coords.latitude))
      setLng(String(pos.coords.longitude))
    })
  }, [])

  useEffect(() => {
    if (asked.current) return
    asked.current = true
    useMyLocation()
  }, [useMyLocation])

  useEffect(() => {
    if (!lat || !lng) return
    let cancelled = false
    setZoneName(null)
    reverseGeocodeZone(Number(lat), Number(lng), i18n.language).then(name => {
      if (!cancelled) setZoneName(name)
    })
    return () => { cancelled = true }
  }, [lat, lng, i18n.language])

  const filtered = (stores ?? []).filter(s =>
    category === 'all' ? true : inferStoreCategory(s.name) === category
  ).slice(0, 6)

  const mapCenter: MapPoint = lat && lng
    ? { lat: Number(lat), lng: Number(lng) }
    : DEFAULT_CENTER

  const markers = (stores ?? [])
    .filter(s => s.lat != null && s.lng != null)
    .slice(0, 20)
    .map(s => ({
      id: s.id,
      position: { lat: s.lat!, lng: s.lng! },
      title: s.name,
    }))

  const locationLabel = !lat || !lng
    ? t('home.locating')
    : zoneName ?? t('home.findingArea')

  return (
    <div className="space-y-10">
      {/* Hero — columns follow document dir so Arabic mirrors the layout */}
      <section className="relative overflow-hidden rounded-[1.5rem] border border-line bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 text-white shadow-lift">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, white 0%, transparent 35%), radial-gradient(circle at 85% 70%, rgb(134 239 172 / 0.5) 0%, transparent 40%)',
          }}
        />
        <div className="relative flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:items-center">
          <div className="min-w-0 lg:flex-[1.1]">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 shrink-0" /> {t('home.eyebrow')}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">
              {t('brand.name')}
            </h1>
            <p className="mt-3 max-w-md text-base sm:text-lg text-white/85">
              {t('home.tagline')}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/stores">
                <Button
                  size="lg"
                  variant="onBrand"
                  rightIcon={<ArrowRight className="h-4 w-4 rtl:rotate-180" />}
                >
                  {t('home.findStores')}
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative min-w-0 lg:flex-[0.9]">
            <LocationMap
              center={mapCenter}
              markers={markers}
              selected={lat && lng ? mapCenter : null}
              height="14rem"
              className="border-white/20 shadow-pop"
              showLocate={false}
              onSelect={point => {
                navigate('/stores?view=split')
              }}
            />
            <div className="absolute top-3 inset-inline-4 sm:inset-inline-start-auto sm:inset-inline-end-4 sm:w-56">
              <button type="button" onClick={useMyLocation} className="w-full text-start">
                <Card padding="sm" className="shadow-lift border-brand-200/50 hover:border-brand-400 transition-colors">
                  <p className="text-xs text-ink-faint flex items-center gap-1">
                    <LocateFixed className="h-3 w-3 text-brand-600 shrink-0" /> {t('home.deliveryNearYou')}
                  </p>
                  <p className="text-sm font-semibold text-ink mt-0.5 truncate">
                    {locationLabel}
                  </p>
                </Card>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">{t('home.shopByCategory')}</h2>
            <p className="text-sm text-ink-muted">{t('home.shopByCategoryHint')}</p>
          </div>
          <Link to="/stores" className="text-sm font-medium text-brand-700 hover:underline inline-flex items-center gap-1 shrink-0">
            {t('home.allStores')} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={category === 'all'} onClick={() => setCategory('all')} icon={<Search className="h-3.5 w-3.5" />}>
            {t('home.all')}
          </Chip>
          {STORE_CATEGORIES.map(c => (
            <Chip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              icon={<c.Icon className="h-3.5 w-3.5" />}
            >
              {t(`home.categories.${c.id}`)}
            </Chip>
          ))}
        </div>
      </section>

      {/* Nearby stores */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink">{t('home.nearbyStores')}</h2>
            <p className="text-sm text-ink-muted flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 shrink-0" /> {t('home.deliveryReady')}
            </p>
          </div>
          {user && favoriteIds.size > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted shrink-0">
              <Heart className="h-3.5 w-3.5 text-danger fill-danger" /> {t('home.favoritesCount', { count: favoriteIds.size })}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <EmptyState
            icon={<StoreEmptyIcon />}
            title={t('home.noStoresTitle')}
            description={t('home.noStoresDesc')}
            actionLabel={t('home.openMap')}
            onAction={() => navigate('/stores')}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              showFavorite={!!user}
              favorited={favoriteIds.has(store.id)}
              onToggleFavorite={() => toggleFavorite(store)}
            />
          ))}
        </div>
      </section>

      {/* Promo */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-brand-50 to-surface-raised dark:from-brand-100/40 border-brand-200/60">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">{t('home.sameDayTitle')}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t('home.sameDayDesc')}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-surface-muted to-surface-raised">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-ink-inverse">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">{t('home.favoritesTitle')}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t('home.favoritesDesc')}</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}

function StoreEmptyIcon() {
  return <MapPin className="h-6 w-6" />
}
