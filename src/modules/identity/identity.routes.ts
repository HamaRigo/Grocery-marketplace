import { z } from 'zod'
import { FastifyPluginAsync } from 'fastify'
import { IdentityService } from './identity.service'
import { validate, S } from '../../platform/validate'
import { createSession, destroySession, getSession } from '../../platform/session'

const registerSchema = z.object({ email: S.email, password: S.password, phone: S.phone })
const loginSchema    = z.object({ email: S.email, password: z.string().min(1) })
const phoneSchema    = z.object({ phone: S.phone })

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 3600,
}

export const identityRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (req, reply) => {
    const { email, password, phone } = validate(registerSchema, req.body)
    const user = await IdentityService.register(email, password, phone)
    return reply.code(201).send({ userId: user.id })
  })

  app.post('/login', async (req, reply) => {
    const { email, password } = validate(loginSchema, req.body)
    const { user, roles } = await IdentityService.login(email, password)
    const sessionData = { userId: user.id, roles: roles.map(r => ({ role: r.role, tenantId: r.tenantId })) }
    const sid = await createSession(sessionData)
    reply.setCookie('sid', sid, COOKIE_OPTS)
    return sessionData
  })

  // Phone-only customer entry — no password required.
  app.post('/phone', async (req, reply) => {
    const { phone } = validate(phoneSchema, req.body)
    const { user, roles } = await IdentityService.loginOrCreateByPhone(phone)
    const sessionData = { userId: user.id, roles: roles.map(r => ({ role: r.role, tenantId: r.tenantId })) }
    const sid = await createSession(sessionData)
    reply.setCookie('sid', sid, COOKIE_OPTS)
    return sessionData
  })

  // Returns the current session user — used by the frontend on mount.
  app.get('/me', async (req, reply) => {
    const sid = (req.cookies as Record<string, string | undefined>).sid
    if (!sid) return reply.code(401).send({ error: 'Not authenticated' })
    const session = await getSession(sid)
    if (!session) return reply.code(401).send({ error: 'Session expired' })
    return session
  })

  app.post('/logout', async (req, reply) => {
    const sid = (req.cookies as Record<string, string | undefined>).sid
    if (sid) await destroySession(sid)
    reply.clearCookie('sid', { path: '/' })
    return { ok: true }
  })
}
