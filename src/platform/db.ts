import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../db/schema'

const client = postgres(process.env.DATABASE_URL!, {
  max:             20,   // connection pool ceiling
  idle_timeout:    30,   // release idle connections after 30s
  connect_timeout: 10,   // fail fast if DB is unreachable
  prepare:         false, // required for PgBouncer compatibility
})
export const db = drizzle(client, { schema })
