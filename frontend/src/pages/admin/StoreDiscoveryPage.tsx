import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Plus, Loader2, Globe, Navigation } from 'lucide-react'
import LocationMap, { type MapPoint } from '../../components/map/LocationMap'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { useTranslation } from 'react-i18next'

interface OsmStore {
  osmId: number
  name: string
  lat: number
  lng: number
  tags: any
}

export default function StoreDiscoveryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [center, setCenter] = useState<MapPoint>({ lat: 36.81, lng: 10.17 })
  const [radius, setRadius] = useState(5)
  const [stores, setStores] = useState<OsmStore[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])

  // Initialize with user's location
  useEffect(() => {

  // Initialize with user's location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          setSelectedPoint({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          setLocationLoading(false)
        },
        () => {
          console.error('Geolocation denied or failed')
          setLocationLoading(false)
        },
        { timeout: 10000 }
      )
    } else {
      setLocationLoading(false)
    }
  }, [])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      // Use Nominatim API for forward geocoding (Address -> Coordinates)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      )
      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()

      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        const newPoint = { lat: parseFloat(lat), lng: parseFloat(lon) }
        setCenter(newPoint)
        setSelectedPoint(newPoint)
      } else {
        alert('No location found for this search query.')
      }
    } catch (e) {
      console.error('Search error:', e)
      alert('An error occurred while searching for the location.')
    } finally {
      setSearchLoading(false)
    }
  }

  const discoverStores = useCallback(async (lat: number, lng: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/discovery/osm-stores?lat=${lat}&lng=${lng}&radius=${radius}`)
      if (!res.ok) throw new Error('Failed to fetch stores')
      const data = await res.json()
      setStores(data)
    } catch (e) {
      console.error('Discovery error:', e)
    } finally {
      setLoading(false)
    }
  }, [radius])

  const importStore = async (store: OsmStore) => {
    try {
      const res = await fetch('/api/discovery/import-osm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: store.name,
          lat: store.lat,
          lng: store.lng
        })
      })
      if (!res.ok) throw new Error('Failed to import store')

      // Remove from list after successful import
      setStores(prev => prev.filter(s => s.osmId !== store.osmId))
      alert(`Store ${store.name} imported successfully!`)
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    }
  }

  const handleMapSelect = (point: MapPoint) => {
    setSelectedPoint(point)
    setCenter(point)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Store Discovery</h1>
          <p className="text-sm text-ink-muted">Discover new stores from OpenStreetMap and add them to your marketplace.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/stores')}>
          Back to Stores
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-ink-faint mb-1 block">Search Radius (km)</label>
              <Input
                type="number"
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                min={1} max={50}
              />
            </div>
            <Button
              onClick={() => discoverStores(center.lat, center.lng)}
              disabled={loading}
              rightIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            >
              {loading ? 'Searching...' : 'Discover Stores'}
            </Button>
          </div>

          <div className="relative">
            <LocationMap
              center={center}
              selected={selectedPoint}
              onSelect={handleMapSelect}
              interactiveSelect={true}
              height="500px"
              className="shadow-lift"
            />
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur p-2 rounded-lg border border-line text-[10px] text-ink-faint">
              Click on the map to change search center
            </div>
          </div>
        </div>

        <div className="flex flex-col h-[600px]">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-600" />
            <h2 className="font-semibold text-ink">Suggested Stores ({stores.length})</h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {stores.length === 0 && !loading && (
              <div className="text-center py-10 text-ink-muted">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>No stores found in this area.</p>
                <p className="text-xs">Try increasing the radius or moving the map.</p>
              </div>
            )}

            {stores.map(store => (
              <Card key={store.osmId} padding="sm" className="hover:border-brand-400 transition-colors group">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{store.name}</p>
                    <p className="text-[10px] text-ink-faint">OSM ID: {store.osmId}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => alert(`Importing ${store.name}...`)}
                    className="shrink-0"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
