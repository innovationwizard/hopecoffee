# Go-Live Checklist — HopeCoffee

---

## 1. Infrastructure Setup — DONE (verified)

- [x] Provision PostgreSQL database (Supabase) — session pooler (IPv4 compatible)
- [x] Create Vercel project — connected GitHub repo, framework set to Next.js
- [x] Set environment variables in Vercel dashboard:
  - [x] `DATABASE_URL` — session pooler connection string (aws-1-us-east-2.pooler.supabase.com)
  - [x] `JWT_SECRET`
  - [x] `JWT_EXPIRY` — `24h`
  - [x] `NODE_ENV` — `production`
  - [x] `NEXT_PUBLIC_APP_URL` — `https://hopecoffee.vercel.app`
  - [x] `NEXT_PUBLIC_APP_NAME` — `HOPE COFFEE`
- [x] Verify network access — Vercel serverless functions can reach DB

---

## 2. Database Migration — DONE (verified)

- [x] Schema deployed to production (`prisma db push` — "already in sync")
- [x] Seed ran — admin user, 7 clients, 3 suppliers, exchange rate, export cost config, 2 farms
- [x] Excel data imported — 46 contracts, 25 shipments, 53 MP, 25 subproductos, 2 POs, 61 account entries
- [ ] **Change default admin password** after first login
- [ ] Add GIN index for regions (optional, improves query perf):
  ```sql
  CREATE INDEX idx_contract_regions_gin ON "Contract" USING GIN ("regions");
  ```

Verified record counts (2026-03-06, post ETL fixes):
| Entity | Count | Notes |
|---|---|---|
| Users | 1 | |
| Clients | 12 | +1 Sopex |
| Shipments | 25 | |
| Contracts | 46 | -1 vs spreadsheet (ambiguous onyx total row) |
| Materia Prima | 53 | |
| Subproductos | 25 | |
| Purchase Orders | 2 | |
| Supplier Account Entries | 61 | |

---

## 3. Pre-Deploy Verification — DONE (verified)

- [x] `npm run typecheck` — 0 errors
- [x] `npm run build` — production build succeeds
- [ ] Spot-check 3 contract calculations against the original Excel workbook

---

## 4. Security Hardening

- [x] Middleware — unauthenticated users redirected to `/login`, ADMIN routes protected
- [ ] Remove seed credentials from code or move to env vars — password is in `prisma/seed.ts:17`
- [x] HTTPS enforced (Vercel default)
- [x] Cookie settings — `httpOnly`, `secure`, `sameSite=strict` on auth token

---

## 5. First Deploy — DONE (verified)

- [x] Push to `main` — Vercel auto-deploys
- [x] Build succeeds — `prisma generate && next build`
- [x] Production URL returns 200 at `/login` — HTML renders "HOPE COFFEE — Grupo Orion"

---

## 6. Post-Deploy Smoke Test

- [ ] Login with admin credentials
- [ ] Verify dashboard loads with real data (23 shipments, 62 contracts)
- [ ] Open a shipment — verify contracts, MP, subproductos, and P&L display
- [ ] Create a test contract — verify calculated fields populate
- [ ] Change contract status (`NEGOCIACION` -> `CONFIRMADO`) — verify price snapshot created
- [ ] Check audit log at `/settings/audit` — actions captured
- [ ] Test on mobile — responsive layout renders correctly
- [ ] Check browser console — no errors

---

## 7. Monitoring (Nice-to-Have)

- [ ] Add Sentry (`@sentry/nextjs`) — unhandled errors and slow transactions
- [ ] Enable Vercel Analytics — Web Vitals monitoring (free tier)
- [ ] Enable Supabase automated backups

---

## 8. Team Onboarding

- [ ] Create OPERATOR accounts for each team member via `/settings/users`
- [ ] Create VIEWER accounts for read-only stakeholders
- [ ] 30-minute walkthrough session: contract lifecycle, shipment P&L, inventory
- [ ] Share production URL and bookmark instructions
- [ ] Archive the Excel workbook (keep for historical validation)
