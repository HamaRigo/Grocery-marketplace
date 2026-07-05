import { z } from 'zod'
import Stripe from 'stripe'
import { FastifyPluginAsync } from 'fastify'
import { onlyRole } from '../../platform/rbac'
import { validate } from '../../platform/validate'
import { PaymentsService } from './payments.service'

const createIntentSchema = z.object({ orderId: z.string().uuid() })

export const paymentsRoutes: FastifyPluginAsync = async (app) => {
  // Stripe webhook signature verification needs the exact raw request bytes.
  // Scoping this content-type parser to this plugin (Fastify's encapsulation
  // model) keeps every other route on the default JSON parser.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body
    try {
      done(null, body.length ? JSON.parse(body.toString('utf8')) : {})
    } catch (err) {
      done(err as Error, undefined)
    }
  })

  app.post('/create-payment-intent', { onRequest: [onlyRole('customer')] }, async (req) => {
    const { orderId } = validate(createIntentSchema, req.body)
    const user = (req as any).sessionUser
    return PaymentsService.createIntentForOrder(orderId, user.userId)
  })

  app.post('/webhook', { config: { rateLimit: false } }, async (req, reply) => {
    const signature = req.headers['stripe-signature']
    if (typeof signature !== 'string') return reply.code(400).send({ error: 'Missing Stripe signature' })
    try {
      await PaymentsService.handleWebhookEvent((req as any).rawBody, signature)
    } catch (err) {
      // A bad signature can never succeed on retry — reject it outright rather
      // than falling through to the global 500 handler, which Stripe would retry.
      if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
        return reply.code(400).send({ error: 'Invalid webhook signature' })
      }
      throw err
    }
    return reply.send({ received: true })
  })
}
