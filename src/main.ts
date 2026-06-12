import 'dotenv/config'
import { buildServer } from './server'
import { startOutboxRelay } from './platform/outbox-relay'
import { startReservationExpiryWorker } from './workers/reservation-expiry'

const PORT = parseInt(process.env.PORT ?? '3000', 10)

async function main() {
  const app = await buildServer()

  startOutboxRelay()
  startReservationExpiryWorker()

  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`Bakala Shop API :${PORT}`)

  const shutdown = async (signal: string) => {
    console.log(`[${signal}] Graceful shutdown...`)
    await app.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

main().catch(err => { console.error(err); process.exit(1) })
