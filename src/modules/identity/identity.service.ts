import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../platform/db'
import { emit, Events } from '../../platform/events'
import { users, userRoles } from '../../db/schema'

export const IdentityService = {
  async register(email: string, password: string, phone?: string) {
    const passwordHash = await bcrypt.hash(password, 10)
    const [user] = await db.insert(users).values({ email, phone, passwordHash }).returning()
    await db.insert(userRoles).values({ userId: user.id, role: 'customer', tenantId: null })
    emit(Events.UserRegistered, {
      eventId: randomUUID(), occurredAt: new Date().toISOString(),
      payload: { userId: user.id, email },
    })
    return user
  },

  async login(email: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email))
    if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id))
    return { user, roles }
  },

  // Find or create a customer by phone number — no password required.
  // Staff accounts (admin/manager) always use email+password login.
  async loginOrCreateByPhone(phone: string) {
    const syntheticEmail = `${phone}@phone.bakala`
    let [user] = await db.select().from(users).where(eq(users.email, syntheticEmail))
    if (!user) {
      // New phone customer — store an unguessable password hash they will never use
      const passwordHash = await bcrypt.hash(randomUUID(), 10)
      ;[user] = await db.insert(users).values({ email: syntheticEmail, phone, passwordHash }).returning()
      await db.insert(userRoles).values({ userId: user.id, role: 'customer', tenantId: null })
      emit(Events.UserRegistered, {
        eventId: randomUUID(), occurredAt: new Date().toISOString(),
        payload: { userId: user.id, phone },
      })
    }
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id))
    return { user, roles }
  },
}
