import { FastifyPluginAsync } from 'fastify'
import { CartService } from './cart.service'

export const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:tenantId', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).user
    return CartService.get(user.sub, (req.params as any).tenantId)
  })

  app.post('/:tenantId/lines', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).user
    const { tenantId } = req.params as any
    return CartService.upsertLine(user.sub, tenantId, req.body as any)
  })

  app.delete('/:tenantId/lines/:productId', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).user
    const { tenantId, productId } = req.params as any
    return CartService.removeLine(user.sub, tenantId, productId)
  })

  app.delete('/:tenantId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    await CartService.clear(user.sub, (req.params as any).tenantId)
    return reply.send({ ok: true })
  })
}
