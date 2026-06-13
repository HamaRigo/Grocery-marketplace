import { FastifyRequest, FastifyReply } from 'fastify'
import { getSession, type SessionUser } from './session'

type Role = 'customer' | 'manager' | 'rider' | 'admin'

async function resolve(req: FastifyRequest, reply: FastifyReply): Promise<SessionUser | null> {
  const sid = (req.cookies as Record<string, string | undefined>).sid
  if (!sid) { reply.code(401).send({ error: 'Unauthorized' }); return null }
  const session = await getSession(sid)
  if (!session) { reply.code(401).send({ error: 'Session expired' }); return null }
  return session
}

/** Any authenticated user. Attaches sessionUser to the request. */
export async function authenticated(req: FastifyRequest, reply: FastifyReply) {
  const session = await resolve(req, reply)
  if (session) (req as any).sessionUser = session
}

/** Platform-level role. */
export function onlyRole(role: Role) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await resolve(req, reply)
    if (!session) return
    if (!session.roles.some(r => r.role === role)) {
      return reply.code(403).send({ error: `Requires role: ${role}` })
    }
    ;(req as any).sessionUser = session
  }
}

/** Tenant-scoped role. */
export function onlyTenantRole(role: Role, getTenantId: (req: FastifyRequest) => string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await resolve(req, reply)
    if (!session) return
    const tenantId = getTenantId(req)
    const ok = session.roles.some(r => r.role === role && r.tenantId === tenantId)
    if (!ok) return reply.code(403).send({ error: `Requires ${role} for tenant ${tenantId}` })
    ;(req as any).sessionUser = session
  }
}

/** Admin OR the tenant's own manager. */
export function adminOrTenantManager(getTenantId: (req: FastifyRequest) => string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const session = await resolve(req, reply)
    if (!session) return
    const tenantId = getTenantId(req)
    const ok = session.roles.some(r => r.role === 'admin')
      || session.roles.some(r => r.role === 'manager' && r.tenantId === tenantId)
    if (!ok) return reply.code(403).send({ error: 'Forbidden' })
    ;(req as any).sessionUser = session
  }
}
