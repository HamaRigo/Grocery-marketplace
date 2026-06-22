# Local Supermarket Marketplace — Build-Ready Architecture

A multi-vendor grocery delivery platform. Local supermarkets subscribe and run their own
storefront under the platform; customers browse a nearby store, place an order, the store's
manager prepares it, and a delivery person (the store's own rider **or** a shared platform
pool rider) delivers it with live location tracking.

This document is the engineering source of truth to start building from. It covers the domain
decomposition, contracts, data model, APIs, tech stack, cross-cutting concerns, repo layout, and
a phased delivery plan.

---

## 1. Goals and non-goals

**Goals**
- Multi-tenant marketplace: each supermarket is an isolated tenant with its own catalog, inventory, orders, and riders.
- Clean separation of concerns: every bounded context owns its data; no shared tables across contexts.
- Low coupling: contexts communicate through published contracts (sync APIs where a user waits, async events otherwise).
- High modularity: ship as a modular monolith with hard module boundaries that can be extracted to services later without a rewrite.
- Flexible fulfillment: riders can belong to a store **or** to a shared platform pool ("mix of both"), selected by a per-store dispatch policy.

**Non-goals (for MVP)**
- Real-time inventory sync with external POS systems (manual stock management first).
- In-house payment processing (wrap a third-party gateway; cash-on-delivery as the baseline).
- Native rider routing/optimization beyond nearest-available assignment.
- Multi-region / multi-currency at launch (single region, single currency).

---

## 2. Actors and roles

| Role | App surface | Responsibilities |
| --- | --- | --- |
| Customer | Customer mobile app | Browse stores by location, search, cart, checkout, track delivery, rate orders |
| Store manager | Manager web dashboard | Onboarding, store profile, catalog & stock, accept/prepare orders, manage own riders, configure dispatch policy |
| Delivery person (rider) | Rider mobile app | Accept jobs, navigate pickup → drop-off, share live GPS, mark delivered |
| Platform admin | Admin web console | Approve stores, set subscription/commission, manage shared rider pool, disputes, platform-wide reporting |

Authorization is role-based (RBAC). A rider, manager, and admin may be tied to one or more tenants;
a customer is tenant-agnostic and can order from any active store in their area.

---

## 3. Architecture overview

The system is decomposed into **bounded contexts**, each owning a single business capability and its
own schema. There are no cross-context foreign keys and no shared database access. Contexts talk
through two mechanisms:

- **Synchronous APIs** — only on the path where a user is actively waiting and needs an immediate answer (e.g. checkout reserving stock and authorizing payment).
- **Asynchronous domain events** — everything that can be eventually consistent, published to an event backbone via the transactional outbox pattern.

### Deployment strategy

Start as a **modular monolith**: one deployable, but with module boundaries enforced hard —

- one database schema per module,
- an in-process event bus behind the same interface a real broker would expose,
- an architecture lint rule forbidding one module from importing another's internals (only its published API and event contracts).

When traffic justifies it, extract the contexts whose scaling profiles diverge most — **Tracking**,
**Notifications**, **Discovery** — into standalone services first. Because they already communicate
only through events, extraction is a deployment change, not a rewrite.

### Context map

```
                 Customer app · Manager dashboard · Rider app
                                    │
                        ┌───────────▼───────────┐
                        │  API gateway + BFFs    │  auth, rate limit, per-client shaping
                        └───────────┬───────────┘
   ── Core transactional contexts (each owns its schema) ──────────────────
        Identity   Tenant   Catalog   Inventory
        Ordering   Payments   Fulfillment   Cart
   ──────────────────────────┬──────────────────────────────────────────
                  Event backbone (domain events, outbox, async)
   ──────────────────────────┴──────────────────────────────────────────
   ── Derived / real-time contexts (fed by events) ────────────────────────
        Discovery (read model)   Tracking   Notifications   Reviews
```

---

## 4. Bounded contexts

Each context lists its responsibility, the data it owns, its key operations, and the events it
publishes and consumes.

### 4.1 Identity & Access
- **Owns:** users, credentials, roles, role-tenant bindings, sessions/tokens.
- **Operations:** register/login, issue & refresh tokens, RBAC checks.
- **Publishes:** `UserRegistered`.
- **Consumes:** none. (Every other context depends on Identity; Identity depends on nothing.)
- **Notes:** single source of truth for "who are you and what can you do." Tokens carry `user_id`, roles, and applicable `tenant_id`(s).

### 4.2 Tenant (Merchant)
- **Owns:** supermarket entity, store profile (name, logo, hours), subscription status, commission rate, service-area geo polygon, dispatch policy.
- **Operations:** store onboarding, admin approval, subscription lifecycle, service-area edits.
- **Publishes:** `StoreApproved`, `StoreSuspended`, `StoreProfileUpdated`, `ServiceAreaUpdated`.
- **Consumes:** `SubscriptionPaymentSucceeded/Failed` (from Payments/Billing).

### 4.3 Catalog
- **Owns:** products, categories, per-store pricing, product media.
- **Operations:** CRUD products & categories, set prices, bulk import.
- **Publishes:** `ProductCreated`, `ProductUpdated`, `ProductDelisted`, `PriceChanged`.
- **Consumes:** none.
- **Notes:** read-heavy, slow-changing. Cache aggressively. Source for the Discovery projection.

### 4.4 Inventory
- **Owns:** per-store stock levels, stock reservations.
- **Operations:** set/adjust stock, **reserve** (during checkout, with TTL), **commit** (on prepare), **release** (on cancel/expiry).
- **Publishes:** `StockReserved`, `StockReleased`, `StockCommitted`, `LowStock`, `OutOfStock`.
- **Consumes:** `OrderCancelled`, `OrderRejected` (to release reservations).
- **Notes:** deliberately split from Catalog — write-heavy, reservation semantics, different scaling profile.

### 4.5 Cart
- **Owns:** ephemeral per-customer-per-store carts.
- **Operations:** add/update/remove line, clear, read.
- **Storage:** Redis (transient, high-churn, TTL'd). Not in the relational write path.
- **Publishes / consumes:** none (purely a staging area read by Checkout).

### 4.6 Ordering
- **Owns:** the order aggregate, order line snapshots (price captured at order time), the order state machine.
- **Operations:** place order (orchestrates the checkout saga), accept/reject, mark preparing/ready, transition through delivery, cancel.
- **Publishes:** `OrderPlaced`, `OrderAccepted`, `OrderRejected`, `OrderPreparing`, `OrderReady`, `OrderOutForDelivery`, `OrderDelivered`, `OrderCancelled`.
- **Consumes:** `OrderAssigned`, `OrderPickedUp` (from Fulfillment), `PaymentCaptured`, `PaymentFailed` (from Payments).
- **Notes:** the one context that spans others; it runs an **orchestrated saga** with compensation (see §6).

### 4.7 Payments & Billing
- **Owns:** customer order payments, merchant billing (subscription + commission settlement), an anti-corruption layer over the payment gateway.
- **Operations:** authorize, capture, void, refund (orders); charge subscription, compute & settle commission (merchants).
- **Publishes:** `PaymentAuthorized`, `PaymentCaptured`, `PaymentFailed`, `PaymentRefunded`, `SubscriptionPaymentSucceeded/Failed`, `CommissionSettled`.
- **Consumes:** `OrderDelivered` (trigger capture if auth-only + commission settlement), `OrderCancelled`/`OrderRejected` (void/refund).
- **Notes:** isolates the PCI surface and makes the gateway swappable (e.g. swap to a local Qatari gateway with no change elsewhere).

### 4.8 Fulfillment (Dispatch)
- **Owns:** rider roster (with `owned_by_tenant_id`, null = platform pool), rider availability, delivery jobs, assignment engine.
- **Operations:** create delivery job on `OrderReady`, run assignment strategy per store policy, reassign, handle pickup & delivery confirmation.
- **Publishes:** `OrderAssigned`, `OrderPickedUp`, `DeliveryFailed`, `RiderWentOffline`.
- **Consumes:** `OrderReady` (create job), `OrderCancelled` (cancel job).
- **Notes:** the "mix of both" logic lives here as data + Strategy pattern (see §7).

### 4.9 Tracking
- **Owns:** live rider location stream, per-order tracking sessions.
- **Operations:** ingest GPS pings (high frequency), fan out current position to subscribed customers.
- **Transport:** WebSocket / push to clients; ephemeral store (e.g. Redis geo / time-series).
- **Consumes:** `OrderOutForDelivery` (open session), `OrderDelivered` (close session).
- **Notes:** walled off from Ordering so location write storms never touch the transactional DB.

### 4.10 Discovery (read model)
- **Owns:** a geo-indexed, search-optimized projection of stores + products + availability.
- **Operations:** "stores near me," product search/filter within a store.
- **Consumes:** `StoreApproved`, `ServiceAreaUpdated`, `ProductCreated/Updated/Delisted`, `PriceChanged`, `OutOfStock`/`StockReplenished`.
- **Notes:** pure CQRS read side. The browse path never queries write models.

### 4.11 Notifications
- **Owns:** notification templates, delivery channels (push, SMS, email), send log.
- **Operations:** render + dispatch on relevant events; per-user channel preferences.
- **Consumes:** most order lifecycle events.
- **Notes:** zero domain logic of its own — a pure event consumer behind an anti-corruption layer over providers.

### 4.12 Reviews & Ratings
- **Owns:** order ratings, store/rider feedback, aggregate scores.
- **Operations:** submit rating (enabled post-delivery), compute store/rider averages.
- **Consumes:** `OrderDelivered` (unlock review eligibility).

---

## 5. Domain event catalog (contracts)

Events are the public contract between contexts. Each carries `event_id`, `occurred_at`,
`tenant_id`, and a versioned payload. Consumers must be idempotent (dedupe on `event_id`).

| Event | Producer | Key consumers |
| --- | --- | --- |
| `UserRegistered` | Identity | Notifications |
| `StoreApproved` | Tenant | Discovery, Notifications |
| `ProductUpdated` / `PriceChanged` | Catalog | Discovery |
| `StockReserved` / `StockReleased` | Inventory | Ordering (saga) |
| `OutOfStock` / `StockReplenished` | Inventory | Discovery |
| `OrderPlaced` | Ordering | Notifications, Manager BFF |
| `OrderAccepted` / `OrderRejected` | Ordering | Inventory, Payments, Notifications |
| `OrderReady` | Ordering | Fulfillment, Notifications |
| `OrderAssigned` / `OrderPickedUp` | Fulfillment | Ordering, Tracking, Notifications |
| `OrderOutForDelivery` | Ordering | Tracking, Payments, Notifications |
| `OrderDelivered` | Ordering | Payments, Reviews, Notifications |
| `OrderCancelled` | Ordering | Inventory, Payments, Fulfillment, Notifications |
| `PaymentAuthorized/Captured/Failed/Refunded` | Payments | Ordering |
| `CommissionSettled` | Payments | Tenant, Admin reporting |

---

## 6. Order lifecycle saga

The order spans Inventory, Payments, and Fulfillment, so Ordering runs an **orchestrated saga**
with an explicit compensating action for every forward transition.

```
Checkout gate ──▶ Placed ──▶ Accepted ──▶ Preparing ──▶ Ready ──▶ Assigned
   (sync)                       │                                    │
   reserve stock                │ reject                             ▼
   authorize pay                ▼                            Out for delivery
                        Rejected / cancelled                         │
                        (void auth, release stock)                   ▼
                                                                 Delivered
                                                       (capture pay, settle
                                                        commission, enable review)
```

**Checkout gate (synchronous):**
1. Reserve inventory (TTL'd). On failure → abort, surface "items unavailable."
2. Authorize payment. On failure → release reservation, abort.
3. Create order in `PLACED`, emit `OrderPlaced`.

**Compensation rules**
- Reject / cancel before delivery → void authorization (or refund if captured), release/return stock, emit `OrderCancelled`/`OrderRejected`.
- Payment auth fails → release reservation.
- Dispatch exhausts all riders (`DeliveryFailed`) → notify manager, allow cancel-with-refund.

Every forward step has a defined backward one, so a mid-flow failure never leaves money held or
stock phantom-reserved.

**States:** `PLACED → ACCEPTED → PREPARING → READY → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED`.
Terminal: `DELIVERED`, `CANCELLED`, `REJECTED`.

---

## 7. Dispatch engine — "mix of both"

Rider ownership is **data, not structure**: a rider row carries `owned_by_tenant_id`
(`NULL` = shared platform pool). Each store carries a **dispatch policy**. The assignment engine
reads the policy and applies a strategy (Strategy pattern), so adding a policy never touches order
or other fulfillment code.

**Policies:** `OWN_ONLY`, `OWN_FIRST` (default), `POOL_ONLY`.

**`OWN_FIRST` flow (triggered on `OrderReady`):**
```
Order ready
   │
   ▼
Own rider free nearby?  ──yes──▶ Assign nearest rider ──▶ emit OrderAssigned
   │ no
   ▼
Platform pool free?     ──yes──▶ Assign nearest rider ──▶ emit OrderAssigned
   │ no
   ▼
Queue + retry (backoff, alert ops)
```

The escalation timeout (how long to wait on own riders before falling back) is a per-store config
value, not code. Fulfillment publishes `OrderAssigned`; Tracking and Notifications react to it —
Fulfillment never calls them.

---

## 8. Data model (key entities)

Every tenant-scoped table carries `tenant_id`. IDs are UUIDs. Timestamps (`created_at`,
`updated_at`) on every table. Money stored as integer minor units + currency code.

```
users(id, email, phone, password_hash, created_at)
user_roles(user_id, role, tenant_id NULL)        -- RBAC binding

stores(id /*=tenant_id*/, name, logo_url, status, commission_bps,
       dispatch_policy, escalation_timeout_s, created_at)
store_hours(tenant_id, weekday, open, close)
service_areas(tenant_id, geo_polygon)
subscriptions(tenant_id, plan, status, current_period_end)

categories(id, tenant_id, name, parent_id NULL)
products(id, tenant_id, category_id, name, description, media_url,
         price_minor, currency, status)

inventory(tenant_id, product_id, on_hand, reserved)
stock_reservations(id, tenant_id, order_id, product_id, qty, expires_at)

carts(id, tenant_id, customer_id, updated_at)            -- Redis-backed
cart_lines(cart_id, product_id, qty)

orders(id, tenant_id, customer_id, status, subtotal_minor, delivery_fee_minor,
       total_minor, currency, address_geo, placed_at)
order_lines(order_id, product_id, name_snapshot, unit_price_minor, qty)
order_status_history(order_id, status, at, actor)

payments(id, tenant_id, order_id NULL, type /*order|subscription*/,
         gateway_ref, amount_minor, status)

riders(id, owned_by_tenant_id NULL, user_id, vehicle, status /*online|offline|busy*/)
delivery_jobs(id, tenant_id, order_id, rider_id NULL, status, assigned_at,
              picked_up_at, delivered_at)

tracking_sessions(order_id, rider_id, opened_at, closed_at)   -- ephemeral store
reviews(id, tenant_id, order_id, customer_id, store_rating, rider_rating, comment, created_at)

outbox(id, aggregate, event_type, payload, occurred_at, published_at NULL)
```

---

## 9. API surface

A **Backend-for-Frontend (BFF)** per client tailors the API; core contexts stay client-agnostic.
All routes sit behind the gateway (auth, rate limiting). Representative endpoints:

**Customer BFF**
```
GET  /stores?lat&lng                 list stores serving a location
GET  /stores/{id}/products?q&cat     browse / search (Discovery)
POST /carts/{storeId}/lines          add to cart
POST /checkout                       run checkout saga → returns order
GET  /orders/{id}                    order detail + status
WS   /orders/{id}/track              live location stream
POST /orders/{id}/review             submit rating (post-delivery)
```

**Manager BFF**
```
POST /onboarding                     create store (pending approval)
PUT  /store/profile                  profile, hours, service area
PUT  /store/dispatch-policy          OWN_ONLY | OWN_FIRST | POOL_ONLY
GET/POST/PUT /products               catalog management
PUT  /inventory/{productId}          set stock
GET  /orders?status=                 incoming order queue
POST /orders/{id}/accept|reject|ready
GET/POST /riders                     manage own riders
```

**Rider BFF**
```
GET  /jobs                           assigned / available jobs
POST /jobs/{id}/accept|pickup|deliver
POST /location                       push GPS ping (high frequency)
PUT  /availability                   online / offline
```

**Admin console**
```
GET  /stores?status=pending          approval queue
POST /stores/{id}/approve|suspend
PUT  /stores/{id}/commission
GET/POST /pool-riders                shared rider pool
GET  /reports                        platform-wide metrics, settlements
```

---

## 10. Recommended tech stack

| Concern | Choice (recommended) | Why |
| --- | --- | --- |
| Mobile apps (customer, rider) | Flutter **or** React Native | One codebase → iOS + Android |
| Web (manager, admin) | React + TypeScript | Standard, fast to staff |
| Backend | One modular monolith — Node.js/NestJS or Java/Spring or Go | Module boundaries, in-process events, extractable later |
| Primary DB | PostgreSQL (schema-per-module) | Relational integrity, PostGIS for geo |
| Cache / ephemeral | Redis | Carts, sessions, rider location, geo queries |
| Event bus | In-process bus → Kafka/RabbitMQ on extraction | Same interface across both phases |
| Search / discovery | PostGIS first → Elasticsearch/OpenSearch at scale | Geo + full-text reads |
| Maps & geocoding | Google Maps Platform | Tracking, routing, address |
| Payments | Third-party gateway behind an ACL | Swappable, isolates PCI |
| Push / SMS / email | FCM/APNs + SMS provider + email provider | Behind Notifications ACL |
| Realtime tracking | WebSocket (or managed pub/sub) | Live location fan-out |
| Infra | Containers + managed Postgres/Redis | Start simple, scale per service |

> Verify any Anthropic/Claude-specific tooling against current docs if you integrate AI features later; the rest above is standard infrastructure.

---

## 11. Cross-cutting concerns

Bake these in from day one — retrofitting is painful.

- **Multi-tenancy:** `tenant_id` threaded through every context, query, and event. Enforce row-level isolation; never trust a client-supplied tenant.
- **Idempotency:** idempotency keys on every order and payment mutation so a retried request never double-charges or double-places. Event consumers dedupe on `event_id`.
- **Transactional outbox:** every event publisher writes the event to an `outbox` table in the same transaction as the state change; a relay publishes and marks it sent. No lost events between commit and publish.
- **Anti-corruption layers:** payment gateway, maps, and messaging providers each sit behind an internal interface so vendors are swappable.
- **Observability:** structured logs with correlation IDs (carry the order/saga id across contexts), metrics per context, distributed tracing ready for the extraction phase.
- **Error handling:** explicit saga compensation; dead-letter queue for failed event handling; backoff + retry on dispatch.
- **AuthN/AuthZ:** JWT at the gateway; RBAC enforced in each context; least privilege per role.

---

## 12. Non-functional requirements

- **Availability:** browse/order path is the critical path; degrade gracefully (e.g. tracking outage must not block ordering).
- **Consistency:** strong within a context; eventual across contexts via events. Money operations are idempotent and auditable.
- **Latency:** checkout gate should feel instant; isolate the synchronous reserve+authorize steps and time-box them.
- **Scalability:** Tracking, Notifications, Discovery scale independently (extract first). Catalog reads cached.
- **Auditability:** order status history and all payment events retained for dispute resolution.
- **Privacy:** customer addresses and rider locations are sensitive; restrict access by role and purpose, expire location data after delivery.

---

## 13. Repository / project structure

A modular monolith with one module per bounded context. The architecture rule: a module may import
only another module's `contracts` (public API + events), never its `internal`.

```
/apps
  /customer-mobile
  /rider-mobile
  /manager-web
  /admin-web
/services
  /api            # gateway + BFFs (customer, manager, rider, admin)
  /core           # the modular monolith
    /modules
      /identity
        /contracts   # public API + published events
        /internal    # domain, persistence, handlers
      /tenant
      /catalog
      /inventory
      /cart
      /ordering
      /payments
      /fulfillment
      /tracking
      /discovery
      /notifications
      /reviews
    /platform        # event bus, outbox relay, tenancy, auth, observability
/packages
  /event-contracts   # shared event schemas (versioned)
  /ui                # shared client components
/infra               # IaC, docker, CI/CD
```

---

## 14. Environments & local dev

- **Local:** docker-compose bringing up Postgres (with PostGIS), Redis, the core monolith, the API, and seed data (a demo store, products, a customer, an own rider, a pool rider).
- **Seed scenario:** one approved store with `OWN_FIRST` policy so the full order → dispatch → track → deliver flow is exercisable end to end on first run.
- **Environments:** local → staging → production. Payment + SMS + maps in sandbox mode outside production.
- **CI/CD:** lint (including the no-cross-module-internals rule), tests, build, deploy. Contract tests on event schemas.

---

## 15. Phased delivery plan

**Phase 0 — Foundations**
Repo scaffold, modular-monolith skeleton, Identity + RBAC, Tenant onboarding + admin approval, event bus + outbox, observability baseline, seed data.

**Phase 1 — Catalog & browse (read path)**
Catalog CRUD, Inventory (manual stock), Discovery projection, customer browse-by-location + search.

**Phase 2 — Order core (write path)**
Cart, Checkout saga (reserve + authorize), Ordering state machine, manager order queue (accept/prepare/ready), Notifications for status changes. Cash-on-delivery + one online payment method.

**Phase 3 — Fulfillment**
Rider roster (own + pool), dispatch engine with `OWN_FIRST`/`OWN_ONLY`/`POOL_ONLY`, rider app (accept/pickup/deliver), Tracking (live GPS), customer map view.

**Phase 4 — Money & feedback**
Commission settlement, subscription billing, refunds, Reviews & ratings, admin reporting.

**Phase 5 — Scale & extract**
Extract Tracking, Notifications, Discovery to services; introduce a real broker; add search infra; harden NFRs.

**MVP = Phases 0–3** (a customer can order from a local store, the manager prepares it, a rider delivers it with live tracking, with manual stock and basic payment).

---

## 16. Open decisions & risks

- **Payment gateway choice** (local vs. global; affects fees, payout, compliance). Keep behind the ACL until decided.
- **Delivery fee model** — flat, distance-based, or store-set — and how it splits across the mix-of-both rider ownership.
- **Monetization mix** — subscription, per-order commission, or both. Shapes the Tenant onboarding flow.
- **Rider pool ownership of liability/insurance** for shared riders vs. store-employed riders (legal, region-specific).
- **Search infra timing** — PostGIS may carry you well past MVP; only add Elasticsearch when geo+text reads demand it.

---

## 17. Definition of done (MVP)

- A new store can self-onboard, be approved by admin, set up catalog + stock, and configure a dispatch policy.
- A customer can find that store by location, build a cart, check out (stock reserved, payment authorized), and place an order.
- The manager receives, accepts, prepares, and marks the order ready.
- The dispatch engine assigns a rider (own first, pool fallback); the rider picks up and delivers with live location visible to the customer.
- Every failure path compensates correctly (no held funds, no phantom stock).
- All cross-context communication flows through events or published APIs — no module reaches into another's internals.
