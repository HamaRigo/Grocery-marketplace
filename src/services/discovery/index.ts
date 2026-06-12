/**
 * Standalone Discovery Service
 * Owns: Elasticsearch-backed store + product search read model.
 * Rebuilt from domain events: StoreApproved, ProductUpdated, PriceChanged, ProductDelisted.
 */
import 'dotenv/config'
import Fastify from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../../platform/db'
import { stores, serviceAreas, products } from '../../db/schema'
import { DiscoveryService } from '../../modules/discovery/discovery.service'
import { ensureConsumerGroup, readBatch, ack } from '../../platform/broker'

const GROUP    = 'discovery-svc'
const CONSUMER = `discovery-${process.pid}`

// ── Event consumer loop ──────────────────────────────────────────────────────

async function startConsumer() {
  await ensureConsumerGroup(GROUP)
  console.log('[DiscoverySvc] consumer started')

  while (true) {
    const batch = await readBatch(GROUP, CONSUMER)
    for (const msg of batch) {
      try {
        switch (msg.type) {
          case 'StoreApproved':
          case 'StoreProfileUpdated': {
            const { storeId } = (msg.data as any).payload ?? {}
            if (!storeId) break
            const [store] = await db.select().from(stores).where(eq(stores.id, storeId))
            if (!store) break
            const [area] = await db.select().from(serviceAreas).where(eq(serviceAreas.tenantId, storeId))
            const geo = area?.geoData as any
            await DiscoveryService.indexStore({ id: store.id, name: store.name, status: store.status, lat: geo?.lat, lng: geo?.lng, radiusKm: geo?.radiusKm })
            break
          }
          case 'ProductUpdated':
          case 'PriceChanged': {
            const payload = (msg.data as any).payload ?? {}
            const id = payload.productId ?? payload.id
            if (!id) break
            const [p] = await db.select().from(products).where(eq(products.id, id))
            if (p) await DiscoveryService.indexProduct(p)
            break
          }
          case 'ProductDelisted': {
            const { productId } = (msg.data as any).payload ?? {}
            if (productId) await DiscoveryService.removeProduct(productId)
            break
          }
        }
      } catch (err: any) {
        console.error('[DiscoverySvc] error:', err.message)
      }
      await ack(GROUP, msg.id)
    }
  }
}

// ── HTTP server ──────────────────────────────────────────────────────────────

async function main() {
  await DiscoveryService.ensureIndices()

  const app = Fastify({ logger: { level: 'info' } })

  app.get('/stores', async (req, reply) => {
    const { lat, lng, radius, q } = req.query as any
    if (!lat || !lng) return reply.code(400).send({ error: 'lat and lng required' })
    return DiscoveryService.searchStores(parseFloat(lat), parseFloat(lng), radius ? parseFloat(radius) : 10, q)
  })

  app.get('/products/:tenantId', async (req) => {
    const { tenantId } = req.params as any
    const { q, categoryId } = req.query as any
    return DiscoveryService.searchProducts(tenantId, q, categoryId)
  })

  app.get('/health', async () => ({ ok: true }))

  startConsumer().catch(console.error)

  const port = parseInt(process.env.DISCOVERY_PORT ?? '3002', 10)
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`[DiscoverySvc] :${port}`)
}

main().catch(err => { console.error(err); process.exit(1) })
