import 'dotenv/config'
import bcrypt from 'bcrypt'
import { db } from '../platform/db'
import { users, userRoles, stores, serviceAreas, categories, products, inventory, riders, subscriptions } from './schema'

async function seed() {
  const hash = (p: string) => bcrypt.hash(p, 10)

  const [admin] = await db.insert(users)
    .values({ email: 'admin@bakala.shop', passwordHash: await hash('admin123') })
    .returning()
  await db.insert(userRoles).values({ userId: admin.id, role: 'admin', tenantId: null })

  const [store] = await db.insert(stores)
    .values({ name: 'Demo Supermarket', status: 'active', commissionBps: 1000, dispatchPolicy: 'OWN_FIRST', escalationTimeoutS: 300 })
    .returning()

  const periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + 1)
  await db.insert(subscriptions).values({
    tenantId: store.id, plan: 'standard', status: 'active',
    amountMinor: 1000, currency: 'QAR', currentPeriodEnd: periodEnd,
  })

  await db.insert(serviceAreas).values({
    tenantId: store.id,
    geoData: { lat: 25.2854, lng: 51.5310, radiusKm: 10 },
  })

  const [mgr] = await db.insert(users)
    .values({ email: 'manager@demo.store', passwordHash: await hash('manager123') })
    .returning()
  await db.insert(userRoles).values({ userId: mgr.id, role: 'manager', tenantId: store.id })

  const [cust] = await db.insert(users)
    .values({ email: 'customer@example.com', passwordHash: await hash('customer123') })
    .returning()
  await db.insert(userRoles).values({ userId: cust.id, role: 'customer', tenantId: null })

  const [riderUser] = await db.insert(users)
    .values({ email: 'rider@demo.store', passwordHash: await hash('rider123') })
    .returning()
  await db.insert(userRoles).values({ userId: riderUser.id, role: 'rider', tenantId: store.id })
  await db.insert(riders).values({ userId: riderUser.id, ownedByTenantId: store.id, vehicle: 'motorcycle', status: 'online' })

  const [cat] = await db.insert(categories)
    .values({ tenantId: store.id, name: 'Fruits & Vegetables' })
    .returning()

  for (const [name, priceMinor, description] of [
    ['Banana (bunch)',  150, 'Fresh yellow bananas'],
    ['Red Apple',       200, 'Crisp red apples'],
    ['Full Cream Milk', 320, '1 litre full cream milk'],
    ['Bread Loaf',      180, 'Sliced white bread'],
  ] as const) {
    const [prod] = await db.insert(products)
      .values({ tenantId: store.id, categoryId: cat.id, name, description, priceMinor, currency: 'QAR', status: 'active' })
      .returning()
    await db.insert(inventory).values({ tenantId: store.id, productId: prod.id, onHand: 100, reserved: 0 })
  }

  console.log('Seed complete')
  console.log('  admin@bakala.shop       / admin123')
  console.log('  manager@demo.store      / manager123')
  console.log('  customer@example.com    / customer123')
  console.log('  rider@demo.store        / rider123')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
