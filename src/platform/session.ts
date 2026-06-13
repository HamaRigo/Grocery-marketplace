import { randomUUID } from 'crypto'
import { redis } from './redis'

export type SessionRole = { role: string; tenantId: string | null }
export interface SessionUser {
  userId: string
  roles: SessionRole[]
}

const TTL = 30 * 24 * 3600 // 30 days
const key = (sid: string) => `session:${sid}`

export async function createSession(user: SessionUser): Promise<string> {
  const sid = randomUUID()
  await redis.set(key(sid), JSON.stringify(user), 'EX', TTL)
  return sid
}

export async function getSession(sid: string): Promise<SessionUser | null> {
  const raw = await redis.get(key(sid))
  if (!raw) return null
  return JSON.parse(raw) as SessionUser
}

export async function destroySession(sid: string): Promise<void> {
  await redis.del(key(sid))
}
