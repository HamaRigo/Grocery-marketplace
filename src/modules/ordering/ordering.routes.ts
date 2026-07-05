import { z } from 'zod'
import { randomUUID } from 'crypto'
import { FastifyPluginAsync } from 'fastify'
import { checkoutSaga, curbsideCheckoutSaga } from './ordering.saga'
import { OrderingService } from './ordering.service'
import { CartService } from '../cart/cart.service'
import { emit, Events } from '../../platform/events'
import { validate, parsePagination, S } from '../../platform/validate'
import { authenticated, onlyRole, onlyTenantRole, adminOrTenantManager } from '../../platform/rbac'
import { redis } from '../../platform/redis'

const checkoutSchema = z.object({
  tenantId:        z.string().uuid(),
  currency:        z.string().length(3).default('QAR'),
  addressGeo:      S.latLng,
  scheduledSlotId: z.string().uuid().optional(),
})

const vehicleSchema = z.object({
  make:  z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  color: z.string().min(1).max(30),
  plate: z.string().max(20).optional(),
})

const curbsideSchema = z.object({
  tenantId:      z.string().uuid(),
  guestName:     z.string().min(1).max(100),
  vehicle:       vehicleSchema,
  paymentMethod: z.enum(['cash', 'card']),
  currency:      z.string().length(3).default('QAR'),
  items: z.array(z.object({
    productId:  z.string().uuid(),
    name:       z.string(),
    priceMinor: z.number().int().positive(),
    qty:        z.number().int().positive(),
  })).min(1),
})

const reviewSchema = z.object({
  storeRating: S.rating,
  riderRating: S.rating.optional(),
  comment:     z.string().max(500).optional(),
})

export const orderingRoutes: FastifyPluginAsync = async (app) => {
  // ── Guest curbside (no auth) ──────────────────────────────────────────────

  app.post('/curbside', async (req, reply) => {
    const input = validate(curbsideSchema, req.body)
    if (!input.items.length) return reply.code(400).send({ error: 'Cart is empty' })

    // Fraud detection: max 3 curbside orders per name+plate per hour
    const plate = (input.vehicle.plate ?? 'no-plate').toLowerCase().replace(/\s/g, '')
    const nameKey = input.guestName.toLowerCase().trim().replace(/\s+/g, '-')
    const rlKey = `curbside:rl:${nameKey}:${plate}`
    const count = await redis.incr(rlKey)
    if (count === 1) await redis.expire(rlKey, 3600)
    if (count > 3) return reply.code(429).send({ error: 'Too many curbside orders. Please try again later.' })

    const order = await curbsideCheckoutSaga({ ...input, currency: input.currency ?? 'QAR' })
    return reply.code(201).send(order)
  })

  app.post('/:id/checkin', async (req, reply) => {
    const order = await OrderingService.checkIn((req.params as any).id)
    return reply.send({ ok: true, orderId: order.id })
  })

  // ── Customer ──────────────────────────────────────────────────────────────

  app.post('/checkout', { onRequest: [onlyRole('customer')] }, async (req, reply) => {
    const user = (req as any).sessionUser
    const { tenantId, currency, addressGeo, scheduledSlotId } = validate(checkoutSchema, req.body)
    const items = await CartService.get(user.userId, tenantId)
    if (!items.length) return reply.code(400).send({ error: 'Cart is empty' })
    const order = await checkoutSaga({ tenantId, customerId: user.userId, currency: currency ?? 'QAR', addressGeo: addressGeo as any, items, scheduledSlotId })
    await CartService.clear(user.userId, tenantId)
    return reply.code(201).send(order)
  })

  app.get('/mine', { onRequest: [onlyRole('customer')] }, async (req) => {
    const user = (req as any).sessionUser
    const { limit, offset } = parsePagination(req.query as any)
    return OrderingService.listByCustomer(user.userId, limit, offset)
  })

  app.post('/:id/review', { onRequest: [onlyRole('customer')] }, async (req, reply) => {
    const { storeRating, riderRating, comment } = validate(reviewSchema, req.body)
    const result = await OrderingService.submitReview((req.params as any).id, (req as any).sessionUser.userId, storeRating, riderRating, comment)
    return reply.code(201).send(result)
  })

  // ── Admin: orders + payments across every tenant ──────────────────────────

  app.get('/admin', { onRequest: [onlyRole('admin')] }, async (req) => {
    const { paymentStatus } = req.query as any
    const { limit, offset } = parsePagination(req.query as any)
    return OrderingService.listAllForAdmin(paymentStatus || undefined, limit, offset)
  })

  // ── Shared: order detail + cancel ─────────────────────────────────────────

  app.get('/:id', { onRequest: [authenticated] }, async (req) =>
    OrderingService.get((req.params as any).id)
  )

  app.post('/:id/cancel', { onRequest: [authenticated] }, async (req, reply) => {
    await OrderingService.cancel((req.params as any).id, (req as any).sessionUser.userId)
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
    // setStatus and get run in parallel — status write doesn't need the order data
    const [, order] = await Promise.all([
      OrderingService.setStatus(id, newStatus, req.sessionUser?.userId ?? 'manager'),
      OrderingService.get(id),
    ])
    emit(eventName as any, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      tenantId: order.tenantId,
      // Include fulfillmentType so the OrderReady listener skips a DB round-trip
      payload: { orderId: id, fulfillmentType: order.fulfillmentType },
    })
    return reply.send({ ok: true })
  }

  const tenantFromOrder = (req: any) => req._order?.tenantId   // set below via preHandler

  app.post('/:id/accept',    { onRequest: [authenticated] }, managerTransition('accepted',  Events.OrderAccepted))
  app.post('/:id/reject',    { onRequest: [authenticated] }, managerTransition('rejected',  Events.OrderRejected))
  app.post('/:id/preparing', { onRequest: [authenticated] }, managerTransition('preparing', Events.OrderPreparing))
  app.post('/:id/ready',     { onRequest: [authenticated] }, managerTransition('ready',     Events.OrderReady))

  app.post('/:id/handoff', { onRequest: [authenticated] }, async (req, reply) => {
    const result = await OrderingService.handoff((req.params as any).id, (req as any).sessionUser?.userId ?? 'manager')
    return reply.send(result)
  })
}
