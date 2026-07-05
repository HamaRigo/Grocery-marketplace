import { FastifyPluginAsync } from 'fastify'
import { CartService } from './cart.service'
import { validate, S } from '../../platform/validate'

export const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:tenantId', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).sessionUser
    return CartService.get(user.userId, (req.params as any).tenantId)
  })

  app.post('/:tenantId/lines', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).sessionUser
    const { tenantId } = req.params as any
    return CartService.upsertLine(user.userId, tenantId, validate(S.cartLine, req.body))
  })

  app.delete('/:tenantId/lines/:productId', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).sessionUser
    const { tenantId, productId } = req.params as any
    return CartService.removeLine(user.userId, tenantId, productId)
  })

  app.delete('/:tenantId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).sessionUser
    await CartService.clear(user.userId, (req.params as any).tenantId)
    return reply.send({ ok: true })
  })
}
