import { FastifyPluginAsync } from 'fastify'
import { InventoryService } from './inventory.service'

export const inventoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:tenantId', { onRequest: [app.authenticate] }, async (req) =>
    InventoryService.listByTenant((req.params as any).tenantId)
  )

  app.get('/:tenantId/:productId', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId, productId } = req.params as any
    return InventoryService.get(tenantId, productId)
  })

  app.put('/:tenantId/:productId', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId, productId } = req.params as any
    const { onHand } = req.body as any
    return InventoryService.setStock(tenantId, productId, onHand)
  })

  app.patch('/:tenantId/:productId/adjust', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId, productId } = req.params as any
    const { delta } = req.body as any
    await InventoryService.adjustStock(tenantId, productId, delta)
    return reply.send({ ok: true })
  })
}
