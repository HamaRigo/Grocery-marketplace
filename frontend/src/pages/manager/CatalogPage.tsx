import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { catalogApi, type Product } from '../../api/catalog'
import Badge from '../../components/Badge'

interface ProductForm { name: string; description: string; priceMinor: number }
const EMPTY: ProductForm = { name: '', description: '', priceMinor: 0 }

export default function CatalogPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY)
  const [showForm, setShowForm] = useState(false)

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: () => catalogApi.listProducts(tenantId!),
    enabled: !!tenantId,
  })

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      editing
        ? catalogApi.updateProduct(tenantId!, editing.id, form)
        : catalogApi.createProduct(tenantId!, { ...form, categoryId: undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', tenantId] })
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY)
    },
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => catalogApi.deleteProduct(tenantId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', tenantId] }),
  })

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, description: p.description ?? '', priceMinor: p.priceMinor })
    setShowForm(true)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catalog</h1>
        <button onClick={openNew}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
          + Add product
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Price</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {products?.map((p: Product) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  {p.description && <p className="text-xs text-gray-500 truncate max-w-xs">{p.description}</p>}
                </td>
                <td className="px-4 py-3 font-medium text-green-700">
                  ${(p.priceMinor / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3"><Badge status={p.status} /></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(p)}
                    className="text-blue-600 hover:underline mr-3">Edit</button>
                  <button onClick={() => remove(p.id)}
                    className="text-red-500 hover:underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products?.length === 0 && !isLoading && (
          <p className="text-center text-gray-400 py-8">No products yet.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-gray-900 mb-4">
              {editing ? 'Edit product' : 'New product'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price ($)</label>
                <input type="number" min={0} step={0.01}
                  value={(form.priceMinor / 100).toFixed(2)}
                  onChange={e => setForm(f => ({ ...f, priceMinor: Math.round(Number(e.target.value) * 100) }))}
                  className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => save()} disabled={isPending}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
