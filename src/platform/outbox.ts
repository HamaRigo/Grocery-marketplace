import { db } from './db'
import { outbox } from '../db/schema'
import { on, Events } from './events'

export function registerOutboxWriters(): void {
  for (const eventType of Object.values(Events)) {
    on(eventType, async (event) => {
      await db.insert(outbox)
        .values({ aggregate: eventType, eventType, payload: event as any, occurredAt: new Date() })
        .catch(err => console.error('[Outbox] write failed:', err.message))
    })
  }
}
