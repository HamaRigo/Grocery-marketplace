import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import fws from '@fastify/websocket'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'

import { identityRoutes }    from './modules/identity/identity.routes'
import { tenantRoutes }      from './modules/tenant/tenant.routes'
import { catalogRoutes }     from './modules/catalog/catalog.routes'
import { inventoryRoutes }   from './modules/inventory/inventory.routes'
import { cartRoutes }        from './modules/cart/cart.routes'
import { orderingRoutes }    from './modules/ordering/ordering.routes'
import { fulfillmentRoutes } from './modules/fulfillment/fulfillment.routes'
import { trackingRoutes }    from './modules/tracking/tracking.routes'
import { billingRoutes }     from './modules/billing/billing.routes'
import { reportingRoutes }   from './modules/reporting/reporting.routes'
import { healthRoutes }      from './modules/health/health.routes'
import { discoveryRoutes }   from './modules/discovery/discovery.routes'
import { registerListeners }              from './platform/listeners'
import { registerNotificationListeners }  from './modules/notifications/notifications.service'
import { registerOutboxWriters }          from './platform/outbox'
import { type SessionUser }              from './platform/session'

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: SessionUser | null
  }
}

export async function buildServer() {
  const app = Fastify({ logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' } })

  const allowedOrigin = process.env.FRONTEND_URL ?? 'http://localhost:5173'

  await app.register(cors, {
    origin: allowedOrigin,
    credentials: true,
  })
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' })
  await app.register(cookie)
  await app.register(fws)

  app.decorateRequest('sessionUser', null)

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err)
    reply.code((err as any).statusCode ?? 500).send({ error: err.message })
  })

  await app.register(identityRoutes,    { prefix: '/auth' })
  await app.register(tenantRoutes,      { prefix: '/stores' })
  await app.register(catalogRoutes,     { prefix: '/catalog' })
  await app.register(inventoryRoutes,   { prefix: '/inventory' })
  await app.register(cartRoutes,        { prefix: '/cart' })
  await app.register(orderingRoutes,    { prefix: '/orders' })
  await app.register(fulfillmentRoutes, { prefix: '/fulfillment' })
  await app.register(trackingRoutes,    { prefix: '/tracking' })
  await app.register(billingRoutes,     { prefix: '/billing' })
  await app.register(reportingRoutes,   { prefix: '/reports' })
  await app.register(healthRoutes)
  await app.register(discoveryRoutes,   { prefix: '/discovery' })

  registerListeners()
  registerNotificationListeners()
  registerOutboxWriters()

  return app
}
