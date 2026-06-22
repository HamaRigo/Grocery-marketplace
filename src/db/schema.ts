import {
  pgTable, pgEnum, uuid, text, integer, boolean,
  timestamp, jsonb, index,
} from 'drizzle-orm/pg-core'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const roleEnum           = pgEnum('role',            ['customer','manager','rider','admin'])
export const storeStatusEnum    = pgEnum('store_status',    ['pending','active','suspended'])
export const dispatchPolicyEnum = pgEnum('dispatch_policy', ['OWN_ONLY','OWN_FIRST','POOL_ONLY'])
export const productStatusEnum  = pgEnum('product_status',  ['active','delisted'])
export const orderStatusEnum    = pgEnum('order_status',    ['placed','accepted','preparing','ready','assigned','out_for_delivery','delivered','cancelled','rejected'])
export const paymentStatusEnum  = pgEnum('payment_status',  ['authorized','captured','voided','refunded','failed'])
export const riderStatusEnum    = pgEnum('rider_status',    ['online','offline','busy'])
export const jobStatusEnum      = pgEnum('job_status',      ['pending','assigned','picked_up','delivered','failed'])

// ─── Identity ─────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  phone:        text('phone'),
  passwordHash: text('password_hash').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

export const userRoles = pgTable('user_roles', {
  id:       uuid('id').primaryKey().defaultRandom(),
  userId:   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:     roleEnum('role').notNull(),
  tenantId: uuid('tenant_id'),
}, t => ({
  userIdx: index('user_roles_user_idx').on(t.userId),
}))

// ─── Tenant ───────────────────────────────────────────────────────────────────

export const stores = pgTable('stores', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  name:                 text('name').notNull(),
  logoUrl:              text('logo_url'),
  status:               storeStatusEnum('status').default('pending').notNull(),
  commissionBps:        integer('commission_bps').default(1000).notNull(),
  dispatchPolicy:       dispatchPolicyEnum('dispatch_policy').default('OWN_FIRST').notNull(),
  escalationTimeoutS:   integer('escalation_timeout_s').default(300).notNull(),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
})

export const storeHours = pgTable('store_hours', {
  id:       uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  weekday:  integer('weekday').notNull(),
  open:     text('open').notNull(),
  close:    text('close').notNull(),
})

export const serviceAreas = pgTable('service_areas', {
  id:       uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  geoData:  jsonb('geo_data').notNull(), // { lat, lng, radiusKm }
})

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id:       uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => stores.id),
  name:     text('name').notNull(),
  parentId: uuid('parent_id'),
})

export const products = pgTable('products', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => stores.id),
  categoryId:  uuid('category_id').references(() => categories.id),
  name:        text('name').notNull(),
  description: text('description'),
  mediaUrl:    text('media_url'),
  priceMinor:  integer('price_minor').notNull(),
  currency:    text('currency').default('USD').notNull(),
  status:      productStatusEnum('status').default('active').notNull(),
}, t => ({ tenantIdx: index('products_tenant_idx').on(t.tenantId) }))

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventory = pgTable('inventory', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull(),
  productId:         uuid('product_id').notNull().references(() => products.id),
  onHand:            integer('on_hand').default(0).notNull(),
  reserved:          integer('reserved').default(0).notNull(),
  lowStockThreshold: integer('low_stock_threshold'),              // null = no alert
}, t => ({
  tenantProductUq: index('inventory_tenant_product_idx').on(t.tenantId, t.productId),
}))

export const stockReservations = pgTable('stock_reservations', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull(),
  orderId:   uuid('order_id').notNull(),
  productId: uuid('product_id').notNull(),
  qty:       integer('qty').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, t => ({
  orderIdx:   index('reservations_order_idx').on(t.orderId),
  expiryIdx:  index('reservations_expiry_idx').on(t.expiresAt),
}))

// ─── Ordering ─────────────────────────────────────────────────────────────────

export const orders = pgTable('orders', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => stores.id),
  customerId:       uuid('customer_id').references(() => users.id),          // null for guest curbside
  status:           orderStatusEnum('status').default('placed').notNull(),
  fulfillmentType:  text('fulfillment_type').default('delivery').notNull(),  // 'delivery' | 'curbside'
  curbsideName:     text('curbside_name'),
  curbsideVehicle:  jsonb('curbside_vehicle'),                               // { make, model, color, plate? }
  paymentMethod:    text('payment_method'),                                  // 'cash' | 'card' | 'online'
  checkedIn:        boolean('checked_in').default(false).notNull(),
  subtotalMinor:    integer('subtotal_minor').notNull(),
  deliveryFeeMinor: integer('delivery_fee_minor').default(0).notNull(),
  totalMinor:       integer('total_minor').notNull(),
  currency:         text('currency').default('USD').notNull(),
  addressGeo:       jsonb('address_geo'),                                    // null for curbside
  scheduledSlotId:  uuid('scheduled_slot_id'),                                          // null for ASAP orders
  placedAt:         timestamp('placed_at').defaultNow().notNull(),
}, t => ({
  tenantStatusIdx: index('orders_tenant_status_idx').on(t.tenantId, t.status, t.placedAt), // composite for manager queue
  customerIdx:     index('orders_customer_idx').on(t.customerId),
}))

export const orderLines = pgTable('order_lines', {
  id:             uuid('id').primaryKey().defaultRandom(),
  orderId:        uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId:      uuid('product_id').notNull(),
  nameSnapshot:   text('name_snapshot').notNull(),
  unitPriceMinor: integer('unit_price_minor').notNull(),
  qty:            integer('qty').notNull(),
}, t => ({
  orderIdx: index('order_lines_order_idx').on(t.orderId),
}))

export const orderStatusHistory = pgTable('order_status_history', {
  id:      uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status:  orderStatusEnum('status').notNull(),
  at:      timestamp('at').defaultNow().notNull(),
  actor:   text('actor'),
})

// ─── Payments ─────────────────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull(),
  orderId:     uuid('order_id').references(() => orders.id),
  type:        text('type').notNull(),
  gatewayRef:  text('gateway_ref'),
  amountMinor: integer('amount_minor').notNull(),
  status:      paymentStatusEnum('status').notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, t => ({
  orderIdx: index('payments_order_idx').on(t.orderId),
}))

// ─── Fulfillment ──────────────────────────────────────────────────────────────

export const riders = pgTable('riders', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id),
  ownedByTenantId:  uuid('owned_by_tenant_id'),
  vehicle:          text('vehicle'),
  status:           riderStatusEnum('status').default('offline').notNull(),
})

export const deliveryJobs = pgTable('delivery_jobs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull(),
  orderId:     uuid('order_id').notNull().references(() => orders.id),
  riderId:     uuid('rider_id').references(() => riders.id),
  status:      jobStatusEnum('status').default('pending').notNull(),
  assignedAt:  timestamp('assigned_at'),
  pickedUpAt:  timestamp('picked_up_at'),
  deliveredAt: timestamp('delivered_at'),
}, t => ({
  riderIdx: index('delivery_jobs_rider_idx').on(t.riderId),
  orderIdx: index('delivery_jobs_order_idx').on(t.orderId),
}))

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const reviews = pgTable('reviews', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull(),
  orderId:     uuid('order_id').notNull().references(() => orders.id),
  customerId:  uuid('customer_id').notNull(),
  storeRating: integer('store_rating').notNull(),
  riderRating: integer('rider_rating'),
  comment:     text('comment'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

// ─── Billing ─────────────────────────────────────────────────────────────────

export const subscriptionStatusEnum = pgEnum('subscription_status', ['trialing','active','past_due','cancelled'])

export const subscriptions = pgTable('subscriptions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => stores.id, { onDelete: 'cascade' }).unique(),
  plan:             text('plan').default('free').notNull(),      // free | standard | premium
  status:           subscriptionStatusEnum('status').default('active').notNull(),
  amountMinor:      integer('amount_minor').default(0).notNull(),
  currency:         text('currency').default('USD').notNull(),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
})

export const commissionSettlements = pgTable('commission_settlements', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => stores.id),
  orderId:         uuid('order_id').notNull().references(() => orders.id),
  orderTotalMinor: integer('order_total_minor').notNull(),
  commissionBps:   integer('commission_bps').notNull(),
  amountMinor:     integer('amount_minor').notNull(),
  settledAt:       timestamp('settled_at').defaultNow().notNull(),
  paidAt:          timestamp('paid_at'),
}, t => ({
  tenantIdx:   index('settlements_tenant_idx').on(t.tenantId),
  settledIdx:  index('settlements_date_idx').on(t.settledAt),
}))

// ─── Outbox ───────────────────────────────────────────────────────────────────

export const outbox = pgTable('outbox', {
  id:          uuid('id').primaryKey().defaultRandom(),
  aggregate:   text('aggregate').notNull(),
  eventType:   text('event_type').notNull(),
  payload:     jsonb('payload').notNull(),
  occurredAt:  timestamp('occurred_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'),
}, t => ({
  unpublishedIdx: index('outbox_unpublished_idx').on(t.publishedAt, t.occurredAt),
}))

// ─── Favorites ────────────────────────────────────────────────────────────────

export const favorites = pgTable('favorites', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, t => ({
  userStoreIdx: index('favorites_user_store_idx').on(t.userId, t.storeId),
}))

// ─── Scheduled Delivery ───────────────────────────────────────────────────────

export const deliverySlots = pgTable('delivery_slots', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  date:        text('date').notNull(),       // 'YYYY-MM-DD'
  startTime:   text('start_time').notNull(), // 'HH:MM'
  endTime:     text('end_time').notNull(),   // 'HH:MM'
  capacity:    integer('capacity').default(10).notNull(),
  bookedCount: integer('booked_count').default(0).notNull(),
}, t => ({
  tenantDateIdx: index('slots_tenant_date_idx').on(t.tenantId, t.date),
}))
