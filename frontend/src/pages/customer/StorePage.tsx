import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Search, ShoppingCart, Truck, X } from 'lucide-react'
import { catalogApi, type Product } from '../../api/catalog'
import { cartApi } from '../../api/cart'
import { storesApi } from '../../api/stores'
import { formatMinor } from '../../lib/money'
import Badge from '../../components/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Chip from '../../components/ui/Chip'
import EmptyState from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { SkeletonCard, PageSpinner } from '../../components/ui/Skeleton'
import LocationMap from '../../components/map/LocationMap'
import { getCategoryMeta, inferStoreCategory } from '../../lib/categories'

export default function StorePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [added, setAdded] = useState<string | null>(null)

  const { data: store } = useQuery({
    queryKey: ['store', id],
    queryFn: () => storesApi.get(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories', id],
    queryFn: () => catalogApi.listCategories(id!),
    enabled: !!id,
    staleTime: 10 * 60_000,
  })

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', id, q, categoryId, maxPrice],
    queryFn: () => catalogApi.listProducts(
      id!, q || undefined, categoryId || undefined,
      maxPrice ? Number(maxPrice) : undefined,
    ),
    enabled: !!id,
    staleTime: 60_000,
  })

  const { data: cart } = useQuery({
    queryKey: ['cart', id],
    queryFn: () => cartApi.get(id!),
    enabled: !!id,
  })

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      // For a specific store page, we might just want to center the map
      // and maybe show the distance, but for now we'll just log it or
      // handle it via a state if needed.
      // However, LocationMap needs a 'center' prop to move.
      // Since StorePage uses 'storePoint' as center, we'd need to
      // manage a local 'userLocation' state to override it.
    })
  }, [])

  const cartCount = cart?.lines?.reduce((s, l) => s + l.qty, 0) ?? 0

  const { mutate: addToCart, error: addError, isError: addFailed } = useMutation({
    mutationFn: (product: Product) =>
      cartApi.addLine(id!, {
        productId: product.id,
        name: product.name,
        priceMinor: product.priceMinor,
        qty: 1,
      }),
    onSuccess: (cart, product) => {
      qc.setQueryData(['cart', id], cart)
      setAdded(product.id)
      setTimeout(() => setAdded(null), 1500)
    },
  })

  const hasFilters = !!(q || categoryId || maxPrice)
  const storeCategory = inferStoreCategory(store?.name ?? '')
  const { Icon, label } = getCategoryMeta(storeCategory)
  const storePoint = store?.lat != null && store?.lng != null
    ? { lat: store.lat, lng: store.lng }
    : null

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-card border border-line bg-surface-raised shadow-soft">
        <div className="relative h-36 sm:h-44 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
          <div className="absolute inset-0 opacity-25"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white, transparent 40%)' }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised text-brand-600 border border-line shadow-lift">
                <Icon className="h-7 w-7" />
              </div>
              <div className="text-white pb-0.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{store?.name ?? 'Store'}</h1>
                <p className="text-sm text-white/80 flex items-center gap-2 mt-0.5">
                  <span>{label}</span>
                  {store && <Badge status={store.status} className="bg-white/20 text-white border-0" />}
                </p>
              </div>
            </div>
            <Link to={`/cart/${id}`}>
              <Button variant="onBrand" leftIcon={<ShoppingCart className="h-4 w-4" />}>
                Cart{cartCount > 0 ? ` (${cartCount})` : ''}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_14rem] sm:items-center">
          <div className="flex flex-wrap gap-2 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-1.5">
              <Truck className="h-3.5 w-3.5 text-brand-600" /> {store?.dispatchPolicy ?? '—'}
            </span>
            {store && (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-1.5">
                Commission {store.commissionBps / 100}%
              </span>
            )}
          </div>
          {storePoint && (
            <LocationMap
              center={storePoint}
              markers={[{ id: store!.id, position: storePoint, title: store!.name }]}
              height="7rem"
              zoom={15}
              showLocate
              onLocate={useMyLocation}
            />
          )}
        </div>
      </section>

      <div className="sticky top-[4.25rem] z-20 -mx-1 rounded-2xl border border-line bg-surface-raised/95 backdrop-blur-md p-3 shadow-soft space-y-3">
        {addFailed && (
          <div className="rounded-xl border border-danger/30 bg-red-50 dark:bg-red-950/30 p-2.5 text-sm text-danger">
            {(addError as Error)?.message || 'Could not add to cart. Please sign in again.'}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search products…"
            leftIcon={<Search className="h-4 w-4" />}
            className="flex-1 min-w-[12rem]"
          />
          <Input
            type="number"
            min={0}
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            placeholder="Max $"
            className="w-28"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => { setQ(''); setCategoryId(''); setMaxPrice('') }}>
              Clear
            </Button>
          )}
        </div>
        {categories && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <Chip active={!categoryId} onClick={() => setCategoryId('')}>All</Chip>
            {categories.map(c => (
              <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p: Product) => (
          <Card key={p.id} hover padding="md" className="flex flex-col">
            <div className="mb-3 flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br from-surface-muted to-brand-50 dark:to-brand-100/20 text-brand-600/40">
              <span className="text-3xl font-extrabold opacity-30">{p.name.slice(0, 1)}</span>
            </div>
            <h3 className="font-semibold text-ink">{p.name}</h3>
            {p.description && (
              <p className="mt-1 text-xs text-ink-muted line-clamp-2 flex-1">{p.description}</p>
            )}
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="font-bold text-brand-700 dark:text-brand-500">{formatMinor(p.priceMinor)}</span>
              <Button
                size="sm"
                onClick={() => addToCart(p)}
                disabled={p.status !== 'active'}
                leftIcon={added === p.id ? <Check className="h-3.5 w-3.5" /> : undefined}
              >
                {added === p.id ? 'Added' : 'Add'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {products?.length === 0 && !isLoading && (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No products found"
          description="Try another search or clear filters."
        />
      )}

      {isLoading && !products && <PageSpinner />}
    </div>
  )
}
