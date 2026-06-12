import 'dotenv/config'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from '../platform/db'

migrate(db, { migrationsFolder: './migrations' })
  .then(() => { console.log('Migrations complete'); process.exit(0) })
  .catch(err => { console.error(err); process.exit(1) })
