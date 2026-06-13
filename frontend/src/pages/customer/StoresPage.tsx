import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { storesApi, type Store } from '../../api/stores'
import Badge from '../../components/Badge'

export default function StoresPage() {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')

  const { data: stores, isLoading, error, refetch } = useQuery({
    queryKey: ['stores', lat, lng],
    queryFn: () => storesApi.list(lat ? Number(lat) : undefined, lng ? Number(lng) : undefined),
  })

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition(pos => {
      setLat(String(pos.coords.latitude))
      setLng(String(pos.coords.longitude))
    })
  }

  return (
    <div>
      <div className="flex items-end gap-3 mb-6">
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

      {isLoading && <p className="text-gray-500">Loading stores…</p>}
      {error && <p className="text-red-500">{(error as Error).message}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stores?.map((store: Store) => (
          <div key={store.id} className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{store.name}</h3>
              <Badge status={store.status} />
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Dispatch: {store.dispatchPolicy} · Commission: {store.commissionBps / 100}%
            </p>
            {store.status === 'active' && (
              <Link to={`/stores/${store.id}`}
                className="block text-center text-sm bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700">
                Browse
              </Link>
            )}
          </div>
        ))}
      </div>

      {stores?.length === 0 && (
        <p className="text-gray-500 text-center py-12">No stores found. Try a different location.</p>
      )}
    </div>
  )
}
