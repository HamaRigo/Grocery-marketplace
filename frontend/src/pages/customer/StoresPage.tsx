import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, List, Map as MapIcon, Navigation, Search, X } from 'lucide-react'
import { storesApi, type Store } from '../../api/stores'
import { useAuth } from '../../context/auth'
import StoreCard from '../../components/StoreCard'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Chip from '../../components/ui/Chip'
import EmptyState from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { SkeletonCard, PageSpinner } from '../../components/ui/Skeleton'
import LocationMap, { DEFAULT_CENTER, type MapPoint } from '../../components/map/LocationMap'
import { STORE_CATEGORIES, inferStoreCategory, type StoreCategory } from '../../lib/categories'

type ViewMode = 'split' | 'map' | 'list'

export default function StoresPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const asked = useRef(false)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<StoreCategory | 'all'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'split'
  )

  const { data: stores, isLoading, error } = useQuery({
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

  const selectLocation = useCallback((point: MapPoint) => {
    setLat(point.lat.toFixed(6))
    setLng(point.lng.toFixed(6))
  }, [])

  const selectedLocation = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null
  const mapCenter = selectedLocation ?? DEFAULT_CENTER

  const filtered = useMemo(() => {
    let list = stores ?? []
    if (favoritesOnly) list = list.filter(s => favoriteIds.has(s.id))
    if (category !== 'all') list = list.filter(s => inferStoreCategory(s.name) === category)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q))
    }
    return list
  }, [stores, favoritesOnly, favoriteIds, category, query])

  const markers = filtered
    .filter(s => s.lat != null && s.lng != null)
    .map(s => ({
      id: s.id,
      position: { lat: s.lat!, lng: s.lng! },
      title: s.name,
      color: selectedStoreId === s.id ? '#15803d' : '#16a34a',
    }))

  const selectedStore = filtered.find(s => s.id === selectedStoreId) ?? null
  const showMap = view === 'map' || view === 'split'
  const showList = view === 'list' || view === 'split'

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">Stores near you</h1>
          <p className="text-sm text-ink-muted mt-1">
            Drop a pin on the map or search — we&apos;ll find grocery spots around that location.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-2xl border border-line p-1 bg-surface-raised">
            {([
              { id: 'split' as const, label: 'Split', icon: null, hideMobile: true },
              { id: 'map' as const, label: 'Map', icon: <MapIcon className="h-3.5 w-3.5" /> },
              { id: 'list' as const, label: 'List', icon: <List className="h-3.5 w-3.5" /> },
            ]).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setView(opt.id)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                  opt.hideMobile ? 'hidden md:inline-flex' : '',
                  view === opt.id ? 'bg-brand-600 text-white' : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                {opt.icon}{opt.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" leftIcon={<Navigation className="h-3.5 w-3.5" />} onClick={useMyLocation}>
            Locate me
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search stores…"
          leftIcon={<Search className="h-4 w-4" />}
          className="flex-1"
        />
        {user && (
          <Chip
            active={favoritesOnly}
            onClick={() => setFavoritesOnly(v => !v)}
            icon={<Heart className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />}
          >
            Favorites
          </Chip>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Chip active={category === 'all'} onClick={() => setCategory('all')}>All</Chip>
        {STORE_CATEGORIES.map(c => (
          <Chip
            key={c.id}
            active={category === c.id}
            onClick={() => setCategory(c.id)}
            icon={<c.Icon className="h-3.5 w-3.5" />}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      <div className={`grid gap-5 ${view === 'split' ? 'lg:grid-cols-[1.15fr_0.85fr]' : ''}`}>
        {showMap && (
          <div className="relative">
            <LocationMap
              center={mapCenter}
              selected={selectedLocation}
              markers={markers}
              onSelect={selectLocation}
              onMarkerClick={id => {
                setSelectedStoreId(id)
                if (view === 'map') setView('list')
              }}
              interactiveSelect
              showLocate
              onLocate={useMyLocation}
              height={view === 'map' ? '28rem' : '22rem'}
            />
            {selectedLocation && (
              <p className="mt-2 text-xs text-ink-faint">
                Searching near {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)} — click map to move the pin.
              </p>
            )}

            {selectedStore && (
              <Card className="absolute left-3 right-3 bottom-10 z-20 shadow-lift sm:left-auto sm:right-3 sm:w-72" padding="sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-ink">{selectedStore.name}</p>
                    <p className="text-xs text-ink-faint capitalize">{selectedStore.dispatchPolicy}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedStoreId(null)} className="text-ink-faint hover:text-ink" aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Link to={`/stores/${selectedStore.id}`}>
                  <Button size="sm" className="w-full">Open store</Button>
                </Link>
              </Card>
            )}
          </div>
        )}

        {showList && (
          <div>
            {isLoading && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}
            {error && <p className="text-danger text-sm">{(error as Error).message}</p>}
            {!isLoading && filtered.length === 0 && (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="No stores found"
                description="Try a different pin, clear filters, or turn off favorites."
                actionLabel="Clear filters"
                onAction={() => { setCategory('all'); setFavoritesOnly(false); setQuery('') }}
              />
            )}
            <div className={`grid gap-4 ${view === 'list' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'}`}>
              {filtered.map(store => (
                <div
                  key={store.id}
                  onMouseEnter={() => setSelectedStoreId(store.id)}
                  className={selectedStoreId === store.id ? 'ring-2 ring-brand-500 rounded-card' : ''}
                >
                  <StoreCard
                    store={store}
                    showFavorite={!!user}
                    favorited={favoriteIds.has(store.id)}
                    onToggleFavorite={() => toggleFavorite(store)}
                  />
                </div>
              ))}
            </div>
            {isLoading && <PageSpinner />}
          </div>
        )}
      </div>
    </div>
  )
}
