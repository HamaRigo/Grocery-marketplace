import { FastifyRequest, FastifyReply } from 'fastify'

type Role = 'customer' | 'manager' | 'rider' | 'admin'
type UserJwt = { sub: string; roles: Array<{ role: Role; tenantId: string | null }> }

function getUser(req: FastifyRequest): UserJwt {
  return (req as any).user as UserJwt
}

/** Any authenticated user. */
export async function authenticated(req: FastifyRequest, reply: FastifyReply) {
  try { await req.jwtVerify() }
  catch { return reply.code(401).send({ error: 'Unauthorized' }) }
}

/** Platform-level role (admin, or any tenant customer). */
export function onlyRole(role: Role) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try { await req.jwtVerify() } catch { return reply.code(401).send({ error: 'Unauthorized' }) }
    if (!getUser(req).roles.some(r => r.role === role)) {
      return reply.code(403).send({ error: `Requires role: ${role}` })
    }
  }
}

/** Tenant-scoped role — user must have the role bound to a specific tenantId. */
export function onlyTenantRole(role: Role, getTenantId: (req: FastifyRequest) => string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try { await req.jwtVerify() } catch { return reply.code(401).send({ error: 'Unauthorized' }) }
    const tenantId = getTenantId(req)
    const ok = getUser(req).roles.some(r => r.role === role && r.tenantId === tenantId)
    if (!ok) return reply.code(403).send({ error: `Requires ${role} role for tenant ${tenantId}` })
  }
}

/** Admin OR the tenant's own manager. */
export function adminOrTenantManager(getTenantId: (req: FastifyRequest) => string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try { await req.jwtVerify() } catch { return reply.code(401).send({ error: 'Unauthorized' }) }
    const tenantId = getTenantId(req)
    const roles = getUser(req).roles
    const ok = roles.some(r => r.role === 'admin')
      || roles.some(r => r.role === 'manager' && r.tenantId === tenantId)
    if (!ok) return reply.code(403).send({ error: 'Forbidden' })
  }
}
