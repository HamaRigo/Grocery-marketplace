import { z } from 'zod'
import { FastifyPluginAsync } from 'fastify'
import { IdentityService } from './identity.service'
import { validate, S } from '../../platform/validate'

const registerSchema  = z.object({ email: S.email, password: S.password, phone: S.phone })
const loginSchema     = z.object({ email: S.email, password: z.string().min(1) })
const phoneSchema     = z.object({ phone: S.phone })

export const identityRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (req, reply) => {
    const { email, password, phone } = validate(registerSchema, req.body)
    const user = await IdentityService.register(email, password, phone)
    return reply.code(201).send({ userId: user.id })
  })

  app.post('/login', async (req, reply) => {
    const { email, password } = validate(loginSchema, req.body)
    const { user, roles } = await IdentityService.login(email, password)
    const token = app.jwt.sign(
      { sub: user.id, roles: roles.map(r => ({ role: r.role, tenantId: r.tenantId })) },
      { expiresIn: '7d' }
    )
    return { token, userId: user.id }
  })

  // Phone-only entry for customers — no password required.
  app.post('/phone', async (req, reply) => {
    const { phone } = validate(phoneSchema, req.body)
    const { user, roles } = await IdentityService.loginOrCreateByPhone(phone)
    const token = app.jwt.sign(
      { sub: user.id, roles: roles.map(r => ({ role: r.role, tenantId: r.tenantId })) },
      { expiresIn: '30d' }
    )
    return { token, userId: user.id, phone: user.phone }
  })
}
