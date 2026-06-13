import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { catalogApi, type Product } from '../../api/catalog'
import { cartApi } from '../../api/cart'
import { storesApi } from '../../api/stores'

export default function StorePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [added, setAdded] = useState<string | null>(null)

  const { data: store } = useQuery({
    queryKey: ['store', id],
    queryFn: () => storesApi.get(id!),
    enabled: !!id,
  })

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', id, q],
    queryFn: () => catalogApi.listProducts(id!, q || undefined),
    enabled: !!id,
  })

  const { mutate: addToCart } = useMutation({
    mutationFn: (product: Product) =>
      cartApi.addLine(id!, {
        productId: product.id,
        name: product.name,
        priceMinor: product.priceMinor,
        qty: 1,
      }),
    onSuccess: (_, product) => {
      qc.invalidateQueries({ queryKey: ['cart', id] })
      setAdded(product.id)
      setTimeout(() => setAdded(null), 1500)
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{store?.name}</h1>
        </div>
        <Link to={`/cart/${id}`}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
          View Cart
        </Link>
      </div>

      <input
        value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search products…"
        className="mb-6 w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {isLoading && <p className="text-gray-500">Loading products…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p: Product) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-medium text-gray-900 mb-1">{p.name}</h3>
            {p.description && (
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">{p.description}</p>
            )}
            <div className="flex items-center justify-between mt-3">
              <span className="font-semibold text-green-700">
                ${(p.priceMinor / 100).toFixed(2)}
              </span>
              <button
                onClick={() => addToCart(p)}
                disabled={p.status !== 'active'}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
              >
                {added === p.id ? 'Added!' : '+ Cart'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {products?.length === 0 && !isLoading && (
        <p className="text-gray-500 text-center py-12">No products found.</p>
      )}
    </div>
  )
}
