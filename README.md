# Parking Garage Management System

## Overview
A production-ready Parking Garage Management System. Built with Node.js, Fastify, Prisma, PostgreSQL, and React.

## Requirement Mapping

| Requirement | Implementation | Endpoint/Class | Test |
|-------------|----------------|----------------|------|
| **T4 Messy Rate Card** | `RatesService.importCSV` robustly parses and ignores garbage | `POST /api/rates/import` | `rate-cleaning.test.ts` |
| **T2 /clock Auto-Close** | `clockRoutes` strictly checks `duration > 24h`, uses transactions | `POST /api/clock` | `clock.routes.ts` (API tested) |
| **T6 Valet Transfer** | `SessionsService.transfer` updates only the plate, preserves spot/entryTime | `POST /api/sessions/:id/transfer` | `sessions.service.ts` |
| **Check-in / Spot Allocation** | Allocates lowest level/spot, checks EV compatibility, locks via `SKIP LOCKED` | `POST /api/sessions/check-in` | `sessions.service.ts` |
| **Check-out / Billing** | Part-hour rounding, daily cap application, spot release | `POST /api/sessions/:id/check-out` | `pricing.test.ts` |
| **Concurrency / No Double Booking** | `SELECT ... FOR UPDATE SKIP LOCKED` during check-in | `SessionsService.checkIn` | Manual/Integration |
| **Authentication & Authorization** | Argon2id + `@fastify/jwt` + Role checks | `POST /api/auth/login`, `verifyJWT` | `auth.routes.ts` |
| **SQL Injection & Mass Assignment** | Prisma ORM, strict Zod validation, `checkIn` manual query mapping | `zod` schemas everywhere | N/A (ORM protected) |
| **Rate Limiting & Security Headers** | `@fastify/rate-limit`, `@fastify/helmet` | `app.ts` | Built-in |
| **EV Availability** | Aggregation queries across `ParkingSpot` | `GET /api/spots/availability` | `spots.routes.ts` |

## Setup & Run

1. `docker compose up -d db`
2. `cd backend && npm install && npm run prisma:migrate && npm run prisma:seed`
3. `cd backend && npm run dev`
4. `cd frontend && npm install && npm run dev`

## Tests
```bash
cd backend
npm run test:unit
```
