import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { storesApi, type Store } from '../../api/stores'
import { useAuth } from '../../context/auth'
import Badge from '../../components/Badge'

export default function StoresPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const { data: stores, isLoading, error, refetch } = useQuery({
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
    navigator.geolocation.getCurrentPosition(pos => {
      setLat(String(pos.coords.latitude))
      setLng(String(pos.coords.longitude))
    })
  }, [])

  const displayedStores = showFavoritesOnly
    ? stores?.filter(s => favoriteIds.has(s.id))
    : stores

  return (
    <div>
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Latitude</label>
          <input value={lat} onChange={e => setLat(e.target.value)}
            placeholder="36.81"
            className="border rounded px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Longitude</label>
          <input value={lng} onChange={e => setLng(e.target.value)}
            placeholder="10.17"
            className="border rounded px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <button onClick={useMyLocation}
          className="px-3 py-1.5 text-sm border border-green-500 text-green-600 rounded hover:bg-green-50">
          Use my location
        </button>
        <button onClick={() => refetch()}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
          Search
        </button>
      </div>

      {user && (
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setShowFavoritesOnly(v => !v)}
            className={`px-3 py-1.5 text-sm rounded-full border font-medium transition-colors ${
              showFavoritesOnly
                ? 'bg-red-50 border-red-400 text-red-600'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            {showFavoritesOnly ? '♥ Favorites' : '♡ Favorites'}
          </button>
          {showFavoritesOnly && favoriteIds.size === 0 && (
            <span className="text-sm text-gray-400">No favorites yet — heart a store below.</span>
          )}
        </div>
      )}

      {isLoading && <p className="text-gray-500">Loading stores…</p>}
      {error && <p className="text-red-500">{(error as Error).message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayedStores?.map((store: Store) => (
          <div key={store.id} className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{store.name}</h3>
              <div className="flex items-center gap-2">
                <Badge status={store.status} />
                {user && (
                  <button
                    onClick={() => toggleFavorite(store)}
                    className="text-lg leading-none hover:scale-110 transition-transform"
                    title={favoriteIds.has(store.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {favoriteIds.has(store.id) ? '♥' : '♡'}
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Dispatch: {store.dispatchPolicy} · Commission: {store.commissionBps / 100}%
            </p>
            {store.status === 'active' && (
              <div className="flex gap-2">
                <Link to={`/stores/${store.id}`}
                  className="flex-1 text-center text-sm bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700">
                  Browse
                </Link>
                <Link to={`/curbside/${store.id}`}
                  className="flex-1 text-center text-sm border border-green-600 text-green-700 rounded-lg py-1.5 hover:bg-green-50">
                  Curbside
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {displayedStores?.length === 0 && !isLoading && (
        <p className="text-gray-500 text-center py-12">No stores found. Try a different location.</p>
      )}
    </div>
  )
}
