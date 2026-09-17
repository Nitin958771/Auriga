# Technical Logs and Architectural Reasoning

## 1. System Architecture & Foundation
**Action:** Initialized a monolithic Node.js backend using Fastify, TypeScript, and Prisma ORM, paired with a React/Vite frontend.
**Reasoning:** 
- Fastify was chosen for its high performance and built-in plugin ecosystem (`@fastify/jwt`, `@fastify/rate-limit`). 
- Prisma provides excellent type-safety across the TypeScript stack. 
- A layered architectural pattern was enforced (Routes -> Services -> Database) to decouple HTTP handling from core business logic, making it easier to test components like the `PricingService` in isolation.

## 2. Database Design & Invariants
**Action:** Designed the PostgreSQL schema using strict `enum` types for roles and spot classifications. Created custom raw SQL migrations to add partial unique indexes (e.g., `UNIQUE INDEX ON parking_sessions(spot_id) WHERE status = 'ACTIVE'`).
**Reasoning:** 
Application-level checks are vulnerable to race conditions. By pushing invariants to the database layer via partial unique indexes, we guarantee that no matter how many backend instances are running, it is mathematically impossible for a single spot to hold two active sessions simultaneously.

## 3. Concurrency Control (Check-In)
**Action:** Implemented check-in spot allocation using a raw Prisma query with `SELECT ... FOR UPDATE SKIP LOCKED`. 
**Reasoning:** 
When multiple attendants attempt to check cars in simultaneously, standard `SELECT` statements could read the same available spot. By locking the rows being read and explicitly telling PostgreSQL to `SKIP LOCKED` rows, concurrent requests safely bypass spots currently being evaluated by other transactions, completely eliminating double-booking scenarios.

## 4. Pricing Engine & Daily Cap 
**Action:** Isolated all pricing math into a dedicated `PricingService`. Implemented partial hour rounding via `Math.ceil(durationMs / 1h)` and applied the daily cap as a mathematical upper bound per session using `Math.min(calculatedFee, dailyCap)`.
**Reasoning:** 
Pricing rules are prone to edge cases (e.g., exactly 60 minutes vs 61 minutes). Isolating them allowed for exhaustive unit testing across 12 distinct boundary scenarios without needing a running database instance or HTTP requests.

## 5. T4: Messy Data Ingestion (Rate Cards)
**Action:** Implemented `RatesService.importCSV` with aggressive data sanitization. It trims whitespace, ignores unparseable rows, rejects negative numbers, normalizes casing, and resolves duplicate entries (latest wins).
**Reasoning:** 
To prevent the system from crashing on invalid inputs or storing corrupted state, the ingestion engine uses a defensive parsing strategy. Furthermore, the core `PricingService` was strictly wired to pull from the sanitized database records rather than relying on hardcoded defaults, fulfilling the requirement that actual billing responds dynamically to imported CSV updates.

## 6. T2: Automation & Virtual Clock
**Action:** Created an abstract `ClockService` instead of directly using `new Date()` across the application. Implemented `POST /api/clock` which calculates the timestamp for `-24 hours`, queries for active sessions strictly older than that threshold, and automatically completes them.
**Reasoning:** 
Time-dependent logic is notoriously difficult to test deterministically. A singleton `ClockService` allows us to instantly simulate days passing. The auto-close mechanism wraps each eligible session in its own transaction, ensuring that calculating the fee, updating the status, and releasing the spot are atomic and idempotent.

## 7. T6: Lifecycle & Valet Handoff
**Action:** Implemented `POST /api/sessions/:id/transfer` by locking the active session row and applying an update *only* to the `plate` field.
**Reasoning:** 
A naive implementation might close the old session and create a new one, but that would reset the entry time and potentially lose the parking spot to a concurrent check-in request. Updating strictly the `plate` field ensures the original spot allocation, entry time, and session UUID are perfectly preserved.

## 8. API Security & Validation
**Action:** Wrapped every API endpoint in strict Zod payload validation schemas. Added `@fastify/helmet` for security headers, `@fastify/cors` for origin control, and `@fastify/rate-limit` for DDoS prevention.
**Reasoning:** 
Zod schemas prevent mass-assignment vulnerabilities by strictly dropping unknown fields. Fastify's plugin ecosystem easily patches common OWASP web vulnerabilities out-of-the-box, ensuring production readiness.

## 9. Frontend Integration
**Action:** Developed a React SPA using TanStack Query for data fetching and shadcn/ui for components.
**Reasoning:** 
TanStack Query manages the complex state of remote API calls, caching, and loading states without polluting the UI components. The Vite setup provides rapid HMR development, and proxying API calls cleanly bridges the frontend to the backend's port 3000.
