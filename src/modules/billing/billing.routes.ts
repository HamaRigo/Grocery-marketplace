import { FastifyPluginAsync } from 'fastify'
import { BillingService } from './billing.service'

export const billingRoutes: FastifyPluginAsync = async (app) => {
  // ── Commission settlements (admin) ────────────────────────────────────────
  app.get('/settlements', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId, from, to } = req.query as any
    return BillingService.listSettlements(tenantId, from, to)
  })

  app.post('/settlements/:id/pay', { onRequest: [app.authenticate] }, async (req) =>
    BillingService.markSettlementPaid((req.params as any).id)
  )

  // ── Subscriptions ─────────────────────────────────────────────────────────
  app.get('/subscriptions/:tenantId', { onRequest: [app.authenticate] }, async (req) =>
    BillingService.getSubscription((req.params as any).tenantId)
  )

  app.put('/subscriptions/:tenantId', { onRequest: [app.authenticate] }, async (req) => {
    const { plan } = req.body as any
    return BillingService.upsertSubscription((req.params as any).tenantId, plan)
  })

  app.post('/subscriptions/:tenantId/charge', { onRequest: [app.authenticate] }, async (req) =>
    BillingService.chargeSubscription((req.params as any).tenantId)
  )

  app.delete('/subscriptions/:tenantId', { onRequest: [app.authenticate] }, async (req) =>
    BillingService.cancelSubscription((req.params as any).tenantId)
  )

  // ── Refund (admin / manager) ──────────────────────────────────────────────
  app.post('/refund/:orderId', { onRequest: [app.authenticate] }, async (req) =>
    BillingService.refund((req.params as any).orderId)
  )
}
