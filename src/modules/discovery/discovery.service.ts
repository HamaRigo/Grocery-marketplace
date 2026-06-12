import { Client } from '@elastic/elasticsearch'

const es = new Client({ node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200' })

const STORES_IDX   = 'bakala_stores'
const PRODUCTS_IDX = 'bakala_products'

export const DiscoveryService = {
  async ensureIndices() {
    if (!await es.indices.exists({ index: STORES_IDX })) {
      await es.indices.create({
        index: STORES_IDX,
        mappings: { properties: {
          tenantId: { type: 'keyword' },
          name:     { type: 'text' },
          status:   { type: 'keyword' },
          center:   { type: 'geo_point' },
          radiusKm: { type: 'integer' },
        }},
      })
    }
    if (!await es.indices.exists({ index: PRODUCTS_IDX })) {
      await es.indices.create({
        index: PRODUCTS_IDX,
        mappings: { properties: {
          tenantId:    { type: 'keyword' },
          categoryId:  { type: 'keyword' },
          name:        { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          priceMinor:  { type: 'integer' },
          status:      { type: 'keyword' },
        }},
      })
    }
  },

  async indexStore(store: { id: string; name: string; status: string; lat?: number; lng?: number; radiusKm?: number }) {
    await es.index({
      index: STORES_IDX, id: store.id,
      document: {
        tenantId: store.id, name: store.name, status: store.status, radiusKm: store.radiusKm,
        center: store.lat != null ? { lat: store.lat, lon: store.lng } : undefined,
      },
      refresh: true,
    })
  },

  async indexProduct(p: { id: string; tenantId: string; name: string; description?: string | null; priceMinor: number; status: string; categoryId?: string | null }) {
    await es.index({ index: PRODUCTS_IDX, id: p.id, document: p, refresh: true })
  },

  async removeProduct(productId: string) {
    await es.delete({ index: PRODUCTS_IDX, id: productId }).catch(() => {})
  },

  async searchStores(lat: number, lng: number, radiusKm = 10, q?: string) {
    const must: object[] = [{ term: { status: 'active' } }]
    if (q) must.push({ match: { name: q } })
    const { hits } = await es.search({
      index: STORES_IDX,
      query: {
        bool: {
          must,
          filter: { geo_distance: { distance: `${radiusKm}km`, center: { lat, lon: lng } } },
        },
      },
    })
    return hits.hits.map(h => h._source)
  },

  async searchProducts(tenantId: string, q?: string, categoryId?: string) {
    const must: object[] = [{ term: { tenantId } }, { term: { status: 'active' } }]
    if (q)          must.push({ multi_match: { query: q, fields: ['name^2', 'description'] } })
    if (categoryId) must.push({ term: { categoryId } })
    const { hits } = await es.search({ index: PRODUCTS_IDX, query: { bool: { must } } })
    return hits.hits.map(h => h._source)
  },
}
