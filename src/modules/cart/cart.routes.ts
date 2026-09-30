import { FastifyPluginAsync } from 'fastify'
import { CartService } from './cart.service'
import { validate, S } from '../../platform/validate'

function cartPayload(tenantId: string, lines: Awaited<ReturnType<typeof CartService.get>>) {
  return { tenantId, lines }
}

export const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:tenantId', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).sessionUser
    const { tenantId } = req.params as { tenantId: string }
    const lines = await CartService.get(user.userId, tenantId)
    return cartPayload(tenantId, lines)
  })

  app.post('/:tenantId/lines', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).sessionUser
    const { tenantId } = req.params as { tenantId: string }
    const lines = await CartService.upsertLine(user.userId, tenantId, validate(S.cartLine, req.body))
    return cartPayload(tenantId, lines)
  })

  app.delete('/:tenantId/lines/:productId', { onRequest: [app.authenticate] }, async (req) => {
    const user = (req as any).sessionUser
    const { tenantId, productId } = req.params as { tenantId: string; productId: string }
    const lines = await CartService.removeLine(user.userId, tenantId, productId)
    return cartPayload(tenantId, lines)
  })

  app.delete('/:tenantId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).sessionUser
    await CartService.clear(user.userId, (req.params as any).tenantId)
    return reply.send({ ok: true })
  })
}
