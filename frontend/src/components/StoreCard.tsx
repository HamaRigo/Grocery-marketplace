import { Heart, MapPin, ShoppingBag, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Store } from '../api/stores'
import Badge from './Badge'
import Button from './ui/Button'
import Card from './ui/Card'
import { getCategoryMeta, inferStoreCategory } from '../lib/categories'

interface StoreCardProps {
  store: Store
  favorited?: boolean
  onToggleFavorite?: () => void
  showFavorite?: boolean
  distanceLabel?: string
}

export default function StoreCard({
  store,
  favorited,
  onToggleFavorite,
  showFavorite,
  distanceLabel,
}: StoreCardProps) {
  const category = inferStoreCategory(store.name)
  const { Icon, label } = getCategoryMeta(category)

  return (
    <Card hover padding="none" className="overflow-hidden page-enter">
      <div className="h-24 bg-gradient-to-br from-brand-100 via-brand-50 to-surface-muted relative">
        <div className="absolute inset-0 opacity-40"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgb(22 163 74 / 0.25), transparent 50%), radial-gradient(circle at 80% 60%, rgb(22 163 74 / 0.15), transparent 45%)' }}
        />
        <div className="absolute bottom-3 left-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised border border-line shadow-soft text-brand-600">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        {showFavorite && onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised/90 border border-line text-ink-muted hover:text-danger transition-colors"
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`h-4 w-4 ${favorited ? 'fill-danger text-danger' : ''}`} />
          </button>
        )}
      </div>

      <div className="p-5 pt-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-semibold text-ink leading-tight">{store.name}</h3>
            <p className="text-xs text-ink-faint mt-0.5 flex items-center gap-1">
              <Icon className="h-3 w-3" /> {label}
            </p>
          </div>
          <Badge status={store.status} />
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-ink-muted mb-4">
          <span className="inline-flex items-center gap-1 rounded-pill bg-surface-muted px-2 py-1">
            <Truck className="h-3 w-3" /> {store.dispatchPolicy}
          </span>
          {distanceLabel && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-surface-muted px-2 py-1">
              <MapPin className="h-3 w-3" /> {distanceLabel}
            </span>
          )}
        </div>

        {store.status === 'active' && (
          <div className="flex gap-2">
            <Link to={`/stores/${store.id}`} className="flex-1">
              <Button className="w-full" size="sm" leftIcon={<ShoppingBag className="h-3.5 w-3.5" />}>
                Browse
              </Button>
            </Link>
            <Link to={`/curbside/${store.id}`} className="flex-1">
              <Button className="w-full" size="sm" variant="outline">
                Curbside
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}
