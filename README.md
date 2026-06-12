# Grocery Marketplace

A multi-vendor grocery delivery platform. Local supermarkets subscribe and run their own storefront; customers browse nearby stores, place orders, store managers prepare them, and riders deliver with live GPS tracking.

## Architecture

```
Clients  ─────────────────────────────────────────────────────────
  Customer App · Manager Dashboard · Rider App · Admin Console
                              │ HTTPS / WSS
                    ┌─────────▼─────────┐
                    │   Fastify API      │  JWT · rate-limit · CORS
                    │   Gateway + BFFs   │  one process, module plugins
                    └─────────┬─────────┘
                              │
  ┌──────────┬───────────┬────┴────┬───────────┬──────────┐
Identity  Tenant    Catalog  Ordering  Billing  Reporting
Inventory  Cart   Fulfillment Tracking Discovery  Health
  └──────────┴───────────┴────┬────┴───────────┴──────────┘
                    ┌─────────▼─────────┐
                    │  In-process        │  EventEmitter bus +
                    │  Event Bus         │  outbox table
                    └─────────┬─────────┘
                    ┌─────────▼─────────┐
                    │  Redis Streams     │  bakala:events stream
                    │  (outbox relay)    │  consumer groups per service
                    └──┬──────┬──────┬──┘
                       │      │      │
              Notifications  Tracking  Discovery
              (standalone)  (standalone) (standalone)

Infrastructure
  PostgreSQL 16  ·  Redis 7  ·  Elasticsearch 8
```

### Deployment model

**Monolith mode** (default) — one Node.js process handles all modules. Event bus is in-process; the outbox relay publishes every domain event to a Redis Stream in the background.

**Extracted mode** — Notifications, Tracking, and Discovery run as standalone processes, each consuming from their own Redis Streams consumer group. Extract more contexts by the same pattern when their scaling profiles diverge.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| API framework | Fastify 4 |
| Language | TypeScript 5 |
| ORM | Drizzle ORM |
| Primary DB | PostgreSQL 16 |
| Cache / ephemeral | Redis 7 (ioredis) |
| Event broker | Redis Streams |
| Search | Elasticsearch 8 |
| Validation | Zod |
| Auth | JWT (`@fastify/jwt`) |
| Tests | Vitest |
| Containers | Docker + docker-compose |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### Local development (monolith)

```bash
# 1. Clone and install
git clone https://github.com/HamaRigo/Grocery-marketplace.git
cd Grocery-marketplace
npm install

# 2. Configure environment
cp .env.example .env          # edit JWT_SECRET at minimum

# 3. Start infrastructure
docker compose up postgres redis elasticsearch -d

# 4. Push schema and seed demo data
npm run db:push
npm run db:seed

# 5. Start the API
npm run dev                   # hot-reload on :3000
```

### Full stack (all services)

```bash
docker compose up             # API :3000 · Tracking :3001 · Discovery :3002
```

### Seed accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bakala.shop | admin123 |
| Manager | manager@demo.store | manager123 |
| Customer | customer@example.com | customer123 |
| Rider | rider@demo.store | rider123 |

---

## Module Map

```
src/
├── main.ts                     bootstrap + graceful shutdown
├── server.ts                   Fastify instance, plugin registration
├── db/
│   ├── schema.ts               all Drizzle table + enum definitions
│   ├── migrate.ts              run pending migrations
│   └── seed.ts                 demo store, users, products
├── platform/
│   ├── db.ts                   Drizzle + postgres-js client
│   ├── redis.ts                ioredis client
│   ├── events.ts               in-process bus: emit() / on() / Events enum
│   ├── outbox.ts               writes every event to outbox table
│   ├── outbox-relay.ts         polls outbox → publishes to Redis Streams
│   ├── listeners.ts            cross-module event wiring
│   ├── validate.ts             Zod helper + shared schemas
│   └── rbac.ts                 RBAC hooks for Fastify routes
├── modules/
│   ├── identity/               register · login · JWT
│   ├── tenant/                 onboard · approve · service area
│   ├── catalog/                products · categories · Redis cache
│   ├── inventory/              stock levels · reservations
│   ├── cart/                   Redis ephemeral (TTL 24 h)
│   ├── ordering/               checkout saga · state machine · reviews
│   ├── fulfillment/            riders · dispatch engine · jobs
│   ├── tracking/               GPS ping · WebSocket fan-out
│   ├── billing/                commission · subscriptions · refunds
│   ├── reporting/              admin metrics · revenue time-series
│   ├── discovery/              Elasticsearch geo + text search
│   └── health/                 GET /health liveness probe
├── services/
│   ├── notifications/          standalone: Redis Streams consumer
│   ├── tracking/               standalone: Fastify + WebSocket + consumer
│   └── discovery/              standalone: Fastify + ES + consumer
├── workers/
│   └── reservation-expiry.ts   releases expired stock reservations (1 min)
└── test/
    ├── validate.test.ts
    ├── billing.test.ts
    └── tenant.test.ts
```

---

## API Reference

All authenticated routes require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | `{ email, password, phone? }` | Create account (customer role) |
| POST | `/auth/login` | `{ email, password }` | Returns JWT |

### Stores (Tenant)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stores?lat&lng` | — | Nearby active stores |
| GET | `/stores/:id` | — | Store detail |
| POST | `/stores` | any | Onboard new store |
| PUT | `/stores/:id/profile` | manager | Update name, logo, dispatch policy |
| PUT | `/stores/:id/service-area` | manager | `{ lat, lng, radiusKm }` |
| POST | `/stores/:id/approve` | admin | Activate store |
| POST | `/stores/:id/suspend` | admin | Suspend store |

### Catalog

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/:tenantId/products?q=` | — | Browse / search products |
| GET | `/catalog/:tenantId/categories` | — | List categories |
| POST | `/catalog/:tenantId/products` | manager | Create product |
| PUT | `/catalog/:tenantId/products/:id` | manager | Update product |
| DELETE | `/catalog/:tenantId/products/:id` | manager | Delist product |

### Cart

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/cart/:tenantId` | customer | View cart |
| POST | `/cart/:tenantId/lines` | customer | `{ productId, name, priceMinor, qty }` |
| DELETE | `/cart/:tenantId/lines/:productId` | customer | Remove line |
| DELETE | `/cart/:tenantId` | customer | Clear cart |

### Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/orders/checkout` | customer | Run checkout saga → order |
| GET | `/orders/mine?limit&offset` | customer | My orders |
| GET | `/orders?tenantId&status&limit&offset` | any | Order queue |
| GET | `/orders/:id` | any | Order detail + lines |
| POST | `/orders/:id/accept` | manager | Accept order |
| POST | `/orders/:id/reject` | manager | Reject order |
| POST | `/orders/:id/preparing` | manager | Mark preparing |
| POST | `/orders/:id/ready` | manager | Mark ready (triggers dispatch) |
| POST | `/orders/:id/cancel` | any | Cancel + compensate |
| POST | `/orders/:id/review` | customer | `{ storeRating, riderRating?, comment? }` |

### Fulfillment

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/fulfillment/riders?tenantId=` | any | List riders |
| POST | `/fulfillment/riders` | any | Add rider |
| GET | `/fulfillment/jobs?riderId=` | any | Rider's jobs |
| POST | `/fulfillment/jobs/:id/pickup` | rider | Confirm pickup |
| POST | `/fulfillment/jobs/:id/deliver` | rider | Confirm delivery |
| PUT | `/fulfillment/availability` | rider | `{ riderId, status }` online/offline |

### Tracking

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tracking/ping` | rider | `{ orderId, lat, lng }` push GPS |
| WS | `/tracking/ws/:orderId` | — | Subscribe to live location |

### Billing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/billing/settlements?tenantId&from&to` | any | List commission settlements |
| POST | `/billing/settlements/:id/pay` | any | Mark settlement paid |
| GET | `/billing/subscriptions/:tenantId` | any | Subscription status |
| PUT | `/billing/subscriptions/:tenantId` | any | `{ plan }` free/standard/premium |
| POST | `/billing/subscriptions/:tenantId/charge` | any | Charge monthly fee |
| DELETE | `/billing/subscriptions/:tenantId` | any | Cancel subscription |
| POST | `/billing/refund/:orderId` | any | Refund captured payment |

### Reporting

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/reports/overview` | any | Orders, revenue, commission, counts |
| GET | `/reports/stores` | any | Per-store breakdown |
| GET | `/reports/stores/:id/ratings` | any | Avg store + rider rating |
| GET | `/reports/revenue?from&to` | any | Daily revenue time-series |

### Discovery (Elasticsearch)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/discovery/stores?lat&lng&radius&q` | Geo + text store search |
| GET | `/discovery/products/:tenantId?q&categoryId` | Full-text product search |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Postgres + Redis liveness, uptime |

---

## Order Lifecycle

```
checkout (sync)
  reserve stock  ──fail──▶  abort (stock unavailable)
  authorize pay  ──fail──▶  release reservation, abort
  create order
        │
        ▼ PLACED
  manager accepts/rejects
        │
        ▼ ACCEPTED → PREPARING → READY
                                   │
                          dispatch engine assigns rider
                                   │
                                   ▼ ASSIGNED
                          rider picks up
                                   │
                                   ▼ OUT_FOR_DELIVERY
                          rider delivers
                                   │
                    ┌──────────────▼──────────────┐
                    │          DELIVERED           │
                    │  capture payment             │
                    │  settle commission           │
                    │  unlock review               │
                    └──────────────────────────────┘

Cancel at any point before delivery:
  release stock reservations + void/refund payment → CANCELLED
```

---

## Event Bus

All domain events flow through a typed `DomainEvent<T>` with `eventId`, `occurredAt`, `tenantId`, and optional `correlationId`. Every event is written to the `outbox` table in the same DB transaction as the state change.

The outbox relay polls every second and publishes unpublished rows to the `bakala:events` Redis Stream. Extracted services subscribe via consumer groups — each gets every event exactly once per group.

| Event | Producer | Key consumers |
|-------|----------|---------------|
| `OrderPlaced` | Ordering | Notifications |
| `OrderReady` | Ordering | Fulfillment (create job) |
| `OrderAssigned` | Fulfillment | Ordering (set status) |
| `OrderPickedUp` | Fulfillment | Ordering (→ out_for_delivery) |
| `OrderDelivered` | Fulfillment | Ordering · Billing (commission) · Tracking (close session) |
| `OrderCancelled` | Ordering | Inventory · Payments · Fulfillment |
| `CommissionSettled` | Billing | Notifications |
| `ProductUpdated` / `PriceChanged` | Catalog | Discovery (re-index) |
| `StoreApproved` | Tenant | Discovery (index store) |

---

## Caching

| Data | Key | TTL | Invalidated by |
|------|-----|-----|----------------|
| Cart lines | `cart:{customerId}:{tenantId}` | 24 h | Checkout / explicit clear |
| Product catalog | `catalog:{tenantId}` | 5 min | Any product write |
| Rider location | `loc:{orderId}` | 1 h | OrderDelivered |

Stock levels and payment records are never cached — always read from PostgreSQL under a transaction.

---

## Running the Tests

```bash
npm test               # unit tests (no DB/Redis required)
npm run test:watch     # watch mode
```

The CI pipeline (`.github/workflows/ci.yml`) runs on every push:

1. `tsc --noEmit` — type check
2. `vitest run` — unit tests
3. Integration job — Postgres + Redis services, schema push, `GET /health` smoke test

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch node |
| `JWT_SECRET` | — | **Required.** Min 32 chars |
| `PORT` | `3000` | API server port |
| `TRACKING_PORT` | `3001` | Standalone tracking service port |
| `DISCOVERY_PORT` | `3002` | Standalone discovery service port |
| `NODE_ENV` | `development` | Controls log level |

---

## Dispatch Policies

Each store configures one of three rider dispatch policies:

| Policy | Behaviour |
|--------|-----------|
| `OWN_FIRST` | Try store's own riders first; fall back to platform pool |
| `OWN_ONLY` | Only use the store's own riders |
| `POOL_ONLY` | Only use the shared platform rider pool |

Escalation timeout (how long to wait on own riders before falling back) is a per-store integer field — no code change needed.

---

## Subscription Plans

| Plan | Monthly fee | Notes |
|------|-------------|-------|
| `free` | $0 | No charge |
| `standard` | $10.00 | 1000 minor units |
| `premium` | $25.00 | 2500 minor units |

Commission is charged per order: `total × commissionBps ÷ 10000` (default 10 %).

---

## Adding a New Module

1. Create `src/modules/<name>/<name>.service.ts` and `<name>.routes.ts`
2. Register in `src/server.ts`: `await app.register(myRoutes, { prefix: '/my-prefix' })`
3. Wire any cross-module event reactions in `src/platform/listeners.ts`
4. If the module needs its own extracted service, add `src/services/<name>/index.ts` and a docker-compose service entry
