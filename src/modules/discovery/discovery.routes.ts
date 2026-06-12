import { FastifyPluginAsync } from 'fastify'
import { DiscoveryService } from './discovery.service'

export const discoveryRoutes: FastifyPluginAsync = async (app) => {
  // Replaces the haversine fallback in tenant routes
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
}
