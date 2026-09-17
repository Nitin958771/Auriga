# Project Requirements

This document captures the exact requirements and storyline provided for the Parking Garage Management System.

## The Storyline
A busy multi-level city-centre parking garage. Cars come and go all day, and the attendant needs to check a car in, check it out, and charge the right fee. 
- Rates are tiered — the first hour is one price, each extra hour is cheaper, and there’s a daily cap so nobody is overcharged for a long stay; part-hours round up. 
- Spots are limited and come in types — compact, standard, and EV (with a charger) — and an EV must get an EV spot. 
- Drivers keep asking ‘is an EV spot free right now?’ and the attendant hunts for a car by its plate. By evening the log is huge.
- Build the attendant something so every car is charged correctly and no spot is double-parked.

*(The attendant’s day is the spec — build it for any garage, not one. Get check-in / check-out and the fee right first, then the spot types and lookups.)*

## Twists for this problem
- **Level 1 — T4 (messy data)**: import a messy rate card (per spot type) with junk data and price correctly from the cleaned rates.
- **Level 2 — T2 (automation)**: “A nightly job auto-closes and bills any session parked over 24 h.” Graded via `POST /clock`.
- **Level 3 — T6 (lifecycle)**: “Transfer an open session to a different plate (valet hand-off); spot and entry time carry over.”

## Detailed 60-Point Requirements

### Tech Stack
- **Backend**: Node.js 22 LTS+, TypeScript (strict), Fastify, Prisma ORM, PostgreSQL.
- **Libraries**: Zod (validation), `@fastify/jwt`, Argon2id (hashing), `@fastify/rate-limit`, `@fastify/helmet`, Pino (logging), Vitest, Testcontainers.
- **Frontend**: React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, shadcn/ui.

### Core Capabilities
- Check a vehicle in/out and automatically assign an appropriate free spot.
- Calculate fees with tiered pricing, rounded-up part hours, and a daily cap.
- EV vehicles must only use EV spots. Standard/Compact rules apply.
- Search sessions by plate and check real-time EV availability.
- Import, clean, and validate messy CSV rate cards, and use those cleaned rates for billing.
- Auto-close sessions parked >24h via `POST /clock` (avoiding double billing).
- Transfer active sessions to new plates without altering entry time or spot allocation.
- Prevent double-booking of parking spots even under high concurrency.
- Complete authentication (Argon2id + JWT) and role-based authorization (ADMIN/ATTENDANT).

### Database & Concurrency Constraints
- **Data Models**: User, Garage, Level, ParkingSpot, RateCard, ParkingSession.
- **Integrity**: Must use PostgreSQL partial unique indexes to guarantee one active session per spot and plate.
- **Concurrency**: Must use `SELECT ... FOR UPDATE SKIP LOCKED` (or equivalent) in a transaction to prevent race conditions during spot assignment.

### API & Testing
- Centralized error handling, Zod validation, Mass Assignment protection, IDOR prevention, and Rate Limiting.
- Must include unit, integration, and concurrency tests (verifying behavior of auto-closing boundaries, pricing logic, concurrent check-ins, and dirty CSV data).
- Expose endpoints for Auth, Garages, Levels, Spots, Rates, Sessions, and Clock.
- Full UI dashboard for the attendant workflows.

### Final Acceptance
- Must provide comprehensive mappings linking each requirement to its implementation code and tests.
- Dockerized setup (`docker-compose up --build`) handling the complete application and database provisioning smoothly.
