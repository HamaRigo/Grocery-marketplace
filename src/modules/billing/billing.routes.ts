import { z } from 'zod'
import { FastifyPluginAsync } from 'fastify'
import { BillingService } from './billing.service'
import { SubscriptionsService } from './subscriptions.service'
import { onlyRole, adminOrTenantManager } from '../../platform/rbac'
import { validate } from '../../platform/validate'

const tenantIdParam = (req: any) => req.params.tenantId

const priceSchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency:    z.string().length(3).default('QAR'),
})

const refundSchema = z.object({
  amountMinor: z.number().int().positive().optional(),
})

export const billingRoutes: FastifyPluginAsync = async (app) => {
  // ── Commission settlements (admin) ────────────────────────────────────────
  app.get('/settlements', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId, from, to } = req.query as any
    return BillingService.listSettlements(tenantId, from, to)
  })

  app.post('/settlements/:id/pay', { onRequest: [app.authenticate] }, async (req) =>
    BillingService.markSettlementPaid((req.params as any).id)
  )

  // ── Subscriptions (admin, or the tenant's own manager) ────────────────────
  app.get('/subscriptions', { onRequest: [onlyRole('admin')] }, async () =>
    SubscriptionsService.listAll()
  )

  app.get('/subscriptions/:tenantId', { onRequest: [adminOrTenantManager(tenantIdParam)] }, async (req) =>
    BillingService.getSubscription((req.params as any).tenantId)
  )

  app.post('/subscriptions/:tenantId/checkout-session', { onRequest: [adminOrTenantManager(tenantIdParam)] }, async (req) =>
    SubscriptionsService.createCheckoutSession((req.params as any).tenantId)
  )

  app.post('/subscriptions/:tenantId/portal-session', { onRequest: [adminOrTenantManager(tenantIdParam)] }, async (req) =>
    SubscriptionsService.createPortalSession((req.params as any).tenantId)
  )

  app.patch('/subscriptions/:tenantId/price', { onRequest: [onlyRole('admin')] }, async (req) => {
    const { amountMinor, currency } = validate(priceSchema, req.body)
    return SubscriptionsService.setPrice((req.params as any).tenantId, amountMinor, currency ?? 'QAR')
  })

  // ── Refund (admin only — real orders can span any tenant) ─────────────────
  app.post('/refund/:orderId', { onRequest: [onlyRole('admin')] }, async (req) => {
    const { amountMinor } = validate(refundSchema, req.body ?? {})
    const admin = (req as any).sessionUser
    return BillingService.refund((req.params as any).orderId, amountMinor, admin?.userId)
  })
}
