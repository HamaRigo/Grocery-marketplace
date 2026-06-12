import { redis } from './redis'

const STREAM = 'bakala:events'

export async function publishToStream(type: string, payload: unknown): Promise<void> {
  await redis.xadd(STREAM, '*', 'type', type, 'data', JSON.stringify(payload))
    .catch(err => console.error('[Broker] publish failed:', err.message))
}

export async function ensureConsumerGroup(group: string): Promise<void> {
  await redis.xgroup('CREATE', STREAM, group, '$', 'MKSTREAM')
    .catch(err => { if (!err.message.includes('BUSYGROUP')) throw err })
}

export interface StreamMsg { id: string; type: string; data: unknown }

export async function readBatch(group: string, consumer: string, count = 20): Promise<StreamMsg[]> {
  const result = await redis.xreadgroup(
    'GROUP', group, consumer,
    'COUNT', count, 'BLOCK', 5000,
    'STREAMS', STREAM, '>'
  ) as [string, [string, string[]][]][] | null

  if (!result) return []
  return result[0][1].map(([id, fields]) => ({
    id,
    type: fields[fields.indexOf('type') + 1],
    data: JSON.parse(fields[fields.indexOf('data') + 1]),
  }))
}

export async function ack(group: string, id: string): Promise<void> {
  await redis.xack(STREAM, group, id)
}
