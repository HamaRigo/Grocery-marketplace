import { z } from 'zod'
import { randomUUID } from 'crypto'
import { FastifyPluginAsync } from 'fastify'
import { checkoutSaga } from './ordering.saga'
import { OrderingService } from './ordering.service'
import { CartService } from '../cart/cart.service'
import { emit, Events } from '../../platform/events'
import { validate, parsePagination, S } from '../../platform/validate'
import { authenticated, onlyRole, onlyTenantRole, adminOrTenantManager } from '../../platform/rbac'

const checkoutSchema = z.object({
  tenantId:   z.string().uuid(),
  currency:   z.string().length(3).default('USD'),
  addressGeo: S.latLng,
})

const reviewSchema = z.object({
  storeRating: S.rating,
  riderRating: S.rating.optional(),
  comment:     z.string().max(500).optional(),
})

export const orderingRoutes: FastifyPluginAsync = async (app) => {
  // ── Customer ──────────────────────────────────────────────────────────────

  app.post('/checkout', { onRequest: [onlyRole('customer')] }, async (req, reply) => {
    const user = (req as any).user
    const { tenantId, currency, addressGeo } = validate(checkoutSchema, req.body)
    const items = await CartService.get(user.sub, tenantId)
    if (!items.length) return reply.code(400).send({ error: 'Cart is empty' })
    const order = await checkoutSaga({ tenantId, customerId: user.sub, currency, addressGeo: addressGeo as any, items })
    await CartService.clear(user.sub, tenantId)
    return reply.code(201).send(order)
  })

  app.get('/mine', { onRequest: [onlyRole('customer')] }, async (req) => {
    const user = (req as any).user
    const { limit, offset } = parsePagination(req.query as any)
    return OrderingService.listByCustomer(user.sub, limit, offset)
  })

  app.post('/:id/review', { onRequest: [onlyRole('customer')] }, async (req, reply) => {
    const { storeRating, riderRating, comment } = validate(reviewSchema, req.body)
    const result = await OrderingService.submitReview((req.params as any).id, (req as any).user.sub, storeRating, riderRating, comment)
    return reply.code(201).send(result)
  })

  // ── Shared: order detail + cancel ─────────────────────────────────────────

  app.get('/:id', { onRequest: [authenticated] }, async (req) =>
    OrderingService.get((req.params as any).id)
  )

  app.post('/:id/cancel', { onRequest: [authenticated] }, async (req, reply) => {
    await OrderingService.cancel((req.params as any).id, (req as any).user.sub)
    return reply.send({ ok: true })
  })

  // ── Manager: queue + lifecycle ────────────────────────────────────────────

  app.get('/', { onRequest: [authenticated] }, async (req) => {
    const { tenantId, status } = req.query as any
    const { limit, offset } = parsePagination(req.query as any)
    return OrderingService.listByTenant(tenantId, status, limit, offset)
  })

  const managerTransition = (
    newStatus: typeof import('../../db/schema').orders.$inferSelect['status'],
    eventName: string,
  ) => async (req: any, reply: any) => {
    const { id } = req.params
    const order = await OrderingService.get(id)
    await OrderingService.setStatus(id, newStatus, req.user.sub)
    emit(eventName as any, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: order.tenantId, payload: { orderId: id },
    })
    return reply.send({ ok: true })
  }

  const tenantFromOrder = (req: any) => req._order?.tenantId   // set below via preHandler

  app.post('/:id/accept',    { onRequest: [authenticated] }, managerTransition('accepted',  Events.OrderAccepted))
  app.post('/:id/reject',    { onRequest: [authenticated] }, managerTransition('rejected',  Events.OrderRejected))
  app.post('/:id/preparing', { onRequest: [authenticated] }, managerTransition('preparing', Events.OrderPreparing))
  app.post('/:id/ready',     { onRequest: [authenticated] }, managerTransition('ready',     Events.OrderReady))
}
