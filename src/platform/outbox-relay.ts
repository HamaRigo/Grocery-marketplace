import { eq, isNull } from 'drizzle-orm'
import { db } from './db'
import { outbox } from '../db/schema'
import { publishToStream } from './broker'

const POLL_MS    = 1_000
const BATCH_SIZE = 50

export function startOutboxRelay(): void {
  const tick = async () => {
    try {
      const pending = await db.select().from(outbox)
        .where(isNull(outbox.publishedAt))
        .limit(BATCH_SIZE)

      for (const row of pending) {
        await publishToStream(row.eventType, row.payload)
        await db.update(outbox)
          .set({ publishedAt: new Date() })
          .where(eq(outbox.id, row.id))
      }
    } catch (err: any) {
      console.error('[OutboxRelay]', err.message)
    }
    setTimeout(tick, POLL_MS)
  }
  setTimeout(tick, POLL_MS)
  console.log('[OutboxRelay] started')
}
