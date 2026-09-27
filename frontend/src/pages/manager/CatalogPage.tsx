import { useState, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { catalogApi, type Product } from '../../api/catalog'
import { inventoryApi, type InventoryRow } from '../../api/inventory'
import Badge from '../../components/Badge'
import { formatMinor } from '../../lib/money'

interface ProductForm { name: string; description: string; priceMinor: number }
const EMPTY: ProductForm = { name: '', description: '', priceMinor: 0 }

function LowStockBadge({ inv }: { inv?: InventoryRow }) {
  if (!inv) return null
  const available = inv.onHand - inv.reserved
  if (available <= 0)
    return <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded font-medium">Out of stock</span>
  if (inv.lowStockThreshold != null && available <= inv.lowStockThreshold)
    return <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded font-medium">Low stock ({available})</span>
  return null
}

export default function CatalogPage() {
  const { tenantId } = useParams<{ tenantId: string }>()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [stockEdit, setStockEdit] = useState<{ productId: string; onHand: string; threshold: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: () => catalogApi.listProducts(tenantId!),
    enabled: !!tenantId,
  })

  const { data: inventory } = useQuery({
    queryKey: ['inventory', tenantId],
    queryFn: () => inventoryApi.listByTenant(tenantId!),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  })

  const invMap = useMemo(() => {
    const m = new Map<string, InventoryRow>()
    inventory?.forEach(row => m.set(row.productId, row))
    return m
  }, [inventory])

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

  const { mutate: saveStock, isPending: savingStock } = useMutation({
    mutationFn: () => inventoryApi.setStock(
      tenantId!,
      stockEdit!.productId,
      Number(stockEdit!.onHand),
      stockEdit!.threshold !== '' ? Number(stockEdit!.threshold) : undefined,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', tenantId] })
      setStockEdit(null)
    },
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

  function openStockEdit(productId: string) {
    const inv = invMap.get(productId)
    setStockEdit({
      productId,
      onHand: String(inv?.onHand ?? 0),
      threshold: inv?.lowStockThreshold != null ? String(inv.lowStockThreshold) : '',
    })
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const result = await catalogApi.importCsv(tenantId, text)
      setImportResult(`Imported ${result.imported} products.`)
      qc.invalidateQueries({ queryKey: ['products', tenantId] })
    } catch (err) {
      setImportResult(`Import failed: ${(err as Error).message}`)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">{t('catalog.title')}</h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/plain" className="hidden" onChange={handleCsvUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 bg-surface-raised border border-line text-ink-muted rounded-lg text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {importing ? 'Importing…' : t('catalog.importCsv')}
          </button>
          <button onClick={openNew}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
            {t('catalog.addProduct')}
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${importResult.startsWith('Import failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-brand-700 dark:text-brand-500'}`}>
          {importResult}
          <p className="text-xs text-ink-muted mt-1">{t('catalog.csvHelp')}</p>
        </div>
      )}

      {isLoading && <p className="text-ink-muted">{t('common.loading')}</p>}

      <div className="bg-surface-raised rounded-card border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Name</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Price</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Stock</th>
              <th className="text-left px-4 py-3 font-medium text-ink-muted">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {products?.map((p: Product) => {
              const inv = invMap.get(p.id)
              return (
                <tr key={p.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {p.name}
                      <LowStockBadge inv={inv} />
                    </p>
                    {p.description && <p className="text-xs text-ink-muted truncate max-w-xs">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-700 dark:text-brand-500">
                    {formatMinor(p.priceMinor)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    <button
                      onClick={() => openStockEdit(p.id)}
                      className="text-xs hover:underline hover:text-indigo-600"
                      title="Edit stock"
                    >
                      {inv ? `${inv.onHand - inv.reserved} avail / ${inv.onHand} on hand` : '—'}
                    </button>
                  </td>
                  <td className="px-4 py-3"><Badge status={p.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)}
                      className="text-blue-600 hover:underline mr-3">Edit</button>
                    <button onClick={() => remove(p.id)}
                      className="text-red-500 hover:underline">Remove</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {products?.length === 0 && !isLoading && (
          <p className="text-center text-ink-faint py-8">No products yet.</p>
        )}
      </div>

      {/* Product form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface-raised rounded-card p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-ink mb-4">
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
                className="px-4 py-1.5 text-sm border rounded hover:bg-surface-muted">
                Cancel
              </button>
              <button onClick={() => save()} disabled={isPending}
                className="px-4 py-1.5 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50">
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock edit modal */}
      {stockEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface-raised rounded-card p-6 w-full max-w-xs shadow-xl">
            <h2 className="font-bold text-ink mb-4">Edit Stock</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">On hand</label>
                <input type="number" min={0}
                  value={stockEdit.onHand}
                  onChange={e => setStockEdit(s => s ? { ...s, onHand: e.target.value } : s)}
                  className="w-full border rounded px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Low-stock alert threshold <span className="text-ink-faint font-normal">(optional)</span></label>
                <input type="number" min={0} placeholder="e.g. 5"
                  value={stockEdit.threshold}
                  onChange={e => setStockEdit(s => s ? { ...s, threshold: e.target.value } : s)}
                  className="w-full border rounded px-3 py-1.5 text-sm" />
                <p className="text-xs text-ink-faint mt-1">Alert fires when available qty falls to this level.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setStockEdit(null)}
                className="px-4 py-1.5 text-sm border rounded hover:bg-surface-muted">
                Cancel
              </button>
              <button onClick={() => saveStock()} disabled={savingStock}
                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                {savingStock ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
