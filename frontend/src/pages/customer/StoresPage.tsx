import { useState, useCallback, useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { storesApi, type Store } from '../../api/stores'
import { useAuth } from '../../context/auth'
import Badge from '../../components/Badge'

interface MapPoint {
  lat: number
  lng: number
}

interface Tile {
  key: string
  url: string
  left: number
  top: number
}

const DEFAULT_LOCATION: MapPoint = { lat: 36.81, lng: 10.17 }
const TILE_SIZE = 256
const MAP_ZOOM = 12
const MAP_WORLD_SIZE = TILE_SIZE * 2 ** MAP_ZOOM

function lngToWorldX(lng: number) {
  return ((lng + 180) / 360) * MAP_WORLD_SIZE
}

function latToWorldY(lat: number) {
  const latRad = lat * Math.PI / 180
  return (0.5 - Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) / (4 * Math.PI)) * MAP_WORLD_SIZE
}

function worldXToLng(x: number) {
  return (x / MAP_WORLD_SIZE) * 360 - 180
}

function worldYToLat(y: number) {
  const n = Math.PI - (2 * Math.PI * y) / MAP_WORLD_SIZE
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

function clampLat(lat: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat))
}

function normalizeLng(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

function LocationMapPicker({
  selected,
  onSelect,
  onUseCurrentLocation,
}: {
  selected: MapPoint | null
  onSelect: (point: MapPoint) => void
  onUseCurrentLocation: () => void
}) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 288 })
  const [center, setCenter] = useState<MapPoint>(selected ?? DEFAULT_LOCATION)

  useEffect(() => {
    if (!mapRef.current) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })

    observer.observe(mapRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (selected) setCenter(selected)
  }, [selected?.lat, selected?.lng])

  const centerWorld = {
    x: lngToWorldX(center.lng),
    y: latToWorldY(clampLat(center.lat)),
  }
  const topLeft = {
    x: centerWorld.x - size.width / 2,
    y: centerWorld.y - size.height / 2,
  }
  const selectedScreen = selected
    ? {
        left: lngToWorldX(selected.lng) - topLeft.x,
        top: latToWorldY(clampLat(selected.lat)) - topLeft.y,
      }
    : null
  const tiles: Tile[] = []
  const tileCount = 2 ** MAP_ZOOM
  const startTileX = Math.floor(topLeft.x / TILE_SIZE) - 1
  const endTileX = Math.floor((topLeft.x + size.width) / TILE_SIZE) + 1
  const startTileY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE) - 1)
  const endTileY = Math.min(tileCount - 1, Math.floor((topLeft.y + size.height) / TILE_SIZE) + 1)

  for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
    for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount
      tiles.push({
        key: `${tileX}-${tileY}`,
        url: `https://tile.openstreetmap.org/${MAP_ZOOM}/${wrappedX}/${tileY}.png`,
        left: tileX * TILE_SIZE - topLeft.x,
        top: tileY * TILE_SIZE - topLeft.y,
      })
    }
  }

  const selectPoint = useCallback((point: MapPoint) => {
    const next = { lat: clampLat(point.lat), lng: normalizeLng(point.lng) }
    setCenter(next)
    onSelect(next)
  }, [onSelect])

  const handleMapClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const worldX = topLeft.x + event.clientX - rect.left
    const worldY = topLeft.y + event.clientY - rect.top

    selectPoint({
      lat: worldYToLat(worldY),
      lng: worldXToLng(worldX),
    })
  }, [selectPoint, topLeft.x, topLeft.y])

  const pan = useCallback((dx: number, dy: number) => {
    const nextWorld = {
      x: centerWorld.x + dx,
      y: Math.max(0, Math.min(MAP_WORLD_SIZE, centerWorld.y + dy)),
    }
    setCenter({
      lat: worldYToLat(nextWorld.y),
      lng: normalizeLng(worldXToLng(nextWorld.x)),
    })
  }, [centerWorld.x, centerWorld.y])

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div>
          <p className="text-sm font-medium text-gray-800">Delivery location</p>
          <p className="text-xs text-gray-500">Click the map to choose where to search nearby stores.</p>
        </div>
        <button
          type="button"
          onClick={onUseCurrentLocation}
          className="px-3 py-1.5 text-sm border border-green-500 text-green-600 rounded hover:bg-green-50"
        >
          Use my location
        </button>
      </div>

      <div
        ref={mapRef}
        onClick={handleMapClick}
        className="relative h-72 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 cursor-crosshair shadow-sm"
      >
        {tiles.map(tile => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ width: TILE_SIZE, height: TILE_SIZE, left: tile.left, top: tile.top }}
          />
        ))}

        {selectedScreen && (
          <div
            className="absolute h-8 w-8 -translate-x-1/2 -translate-y-full"
            aria-label="Selected location"
            style={{ left: selectedScreen.left, top: selectedScreen.top }}
          >
            <div className="h-8 w-8 rounded-full border-4 border-white bg-green-600 shadow-lg" />
            <div className="absolute left-1/2 top-7 h-3 w-3 -translate-x-1/2 rotate-45 bg-green-600 border-b border-r border-white" />
          </div>
        )}

        <div className="absolute right-3 top-3 grid grid-cols-3 gap-1 rounded bg-white/95 p-1 shadow">
          <span />
          <button type="button" onClick={event => { event.stopPropagation(); pan(0, -TILE_SIZE / 2) }} className="h-8 w-8 rounded border text-xs hover:bg-gray-50" aria-label="Pan map up">N</button>
          <span />
          <button type="button" onClick={event => { event.stopPropagation(); pan(-TILE_SIZE / 2, 0) }} className="h-8 w-8 rounded border text-xs hover:bg-gray-50" aria-label="Pan map left">W</button>
          <button type="button" onClick={event => { event.stopPropagation(); setCenter(selected ?? DEFAULT_LOCATION) }} className="h-8 w-8 rounded border text-xs hover:bg-gray-50" aria-label="Center map">C</button>
          <button type="button" onClick={event => { event.stopPropagation(); pan(TILE_SIZE / 2, 0) }} className="h-8 w-8 rounded border text-xs hover:bg-gray-50" aria-label="Pan map right">E</button>
          <span />
          <button type="button" onClick={event => { event.stopPropagation(); pan(0, TILE_SIZE / 2) }} className="h-8 w-8 rounded border text-xs hover:bg-gray-50" aria-label="Pan map down">S</button>
          <span />
        </div>

        <div className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[10px] text-gray-500">
          OpenStreetMap
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500">
          {selected
            ? `Selected: ${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`
            : 'No location selected'}
        </p>
        <button
          type="button"
          onClick={() => selectPoint(center)}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          Search this location
        </button>
      </div>
    </div>
  )
}

export default function StoresPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

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
    navigator.geolocation.getCurrentPosition(pos => {
      setLat(String(pos.coords.latitude))
      setLng(String(pos.coords.longitude))
    })
  }, [])

  const selectedLocation = lat && lng
    ? { lat: Number(lat), lng: Number(lng) }
    : null

  const selectLocation = useCallback((point: MapPoint) => {
    setLat(point.lat.toFixed(6))
    setLng(point.lng.toFixed(6))
  }, [])

  const displayedStores = showFavoritesOnly
    ? stores?.filter(s => favoriteIds.has(s.id))
    : stores

  return (
    <div>
      <LocationMapPicker
        selected={selectedLocation}
        onSelect={selectLocation}
        onUseCurrentLocation={useMyLocation}
      />

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
