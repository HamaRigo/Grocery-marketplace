import { inArray, isNull } from 'drizzle-orm'
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

      if (!pending.length) { setTimeout(tick, POLL_MS); return }

      // Publish all rows; collect IDs of those that succeed
      const publishedIds: string[] = []
      await Promise.allSettled(
        pending.map(async row => {
          await publishToStream(row.eventType, row.payload)
          publishedIds.push(row.id)
        })
      )

      // Single batch UPDATE instead of one UPDATE per row
      if (publishedIds.length) {
        await db.update(outbox)
          .set({ publishedAt: new Date() })
          .where(inArray(outbox.id, publishedIds))
      }
    } catch (err: any) {
      console.error('[OutboxRelay]', err.message)
    }
    setTimeout(tick, POLL_MS)
  }
  setTimeout(tick, POLL_MS)
  console.log('[OutboxRelay] started')
}
