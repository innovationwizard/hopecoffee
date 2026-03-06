# Guide 05 — Testing, Security & Deployment

> **Goal**: Ship with confidence. This guide covers the testing strategy that ensures calculations are bulletproof, the security model for a small team, and the production deployment pipeline.

---

## Testing Strategy

### What to Test (Priority Order)

1. **Calculation engine** — unit tests with known Excel values (highest priority)
2. **Server actions** — CRUD operations, validation, authorization
3. **Import service** — parse accuracy, error handling
4. **UI components** — data table rendering, form behavior (lowest priority, most expensive)

### 1. Calculation Tests (Vitest)

Every function in `calculations.ts` gets tested against real Excel values. This is the most critical test suite — if these break, the app is useless.

```typescript
// src/lib/services/__tests__/calculations.test.ts
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  calculateContract,
  calculateMateriaPrima,
  calculateSubproducto,
  calculateShipmentMargin,
  calculatePurchaseOrder,
  calculateFarmFinancing,
  aggregateContracts,
} from "../calculations";

describe("Contract calculations", () => {
  // Fixtures from SERENGETTI sheet
  const serengettiFixtures = [
    {
      label: "P40129 (bolsa=376, dif=40)",
      input: { sacos69kg: 275, puntaje: 82, precioBolsa: 376, diferencial: 40,
               gastosExportPerSaco: 34.5, tipoCambio: 7.65 },
      expected: { sacos46kg: 412.5, precioBolsaDif: 416,
                  facturacionLbs: 171600 },
    },
    {
      label: "P40028 (bolsa=350, dif=15)",
      input: { sacos69kg: 275, puntaje: 82, precioBolsa: 350, diferencial: 15,
               gastosExportPerSaco: 34.5, tipoCambio: 7.65 },
      expected: { sacos46kg: 412.5, precioBolsaDif: 365,
                  facturacionLbs: 150562.5 },
    },
  ];

  serengettiFixtures.forEach(({ label, input, expected }) => {
    it(`matches Excel for ${label}`, () => {
      const result = calculateContract(input);
      expect(result.sacos46kg.toNumber()).toBe(expected.sacos46kg);
      expect(result.precioBolsaDif.toNumber()).toBe(expected.precioBolsaDif);
      expect(result.facturacionLbs.toNumber()).toBe(expected.facturacionLbs);
    });
  });

  it("handles zero inputs without crashing", () => {
    const result = calculateContract({
      sacos69kg: 0, puntaje: 82, precioBolsa: 0, diferencial: 0,
      gastosExportPerSaco: 0, tipoCambio: 7.65,
    });
    expect(result.totalPagoQTZ.toNumber()).toBe(0);
  });
});

describe("Materia prima calculations", () => {
  it("matches Enero sheet MP line 1", () => {
    const result = calculateMateriaPrima({
      punteo: 82, oro: 412.49, rendimiento: 1.3197, precioPromQ: 2004.96,
    });
    expect(result.pergamino.toNumber()).toBeCloseTo(544.36, 0);
    expect(result.totalMP.toNumber()).toBeCloseTo(1091420, -2);
  });
});

describe("Purchase order calculations", () => {
  it("matches Hoja3 OC-2526-01", () => {
    const result = calculatePurchaseOrder({
      quintalesPergamino: 544.5, precioPorQQ: 1675,
      fletePorQQ: 15, seguridad: 650, seguro: 2280.09375,
    });
    expect(result.totalCafe.toNumber()).toBe(912037.5);
    expect(result.costoTotalAcumulado.toNumber()).toBeCloseTo(923135.09, 0);
  });
});

describe("Farm financing", () => {
  it("matches Hoja2 BRISAS", () => {
    const result = calculateFarmFinancing({
      totalQuetzales: 9909581.76, tipoCambio: 7.65,
      aumentoPorcentaje: 0.20, porcentajePrestamo: 0.70,
    });
    expect(result.totalUSD.toNumber()).toBeCloseTo(1295370.16, 0);
    expect(result.totalPrestamo.toNumber()).toBeCloseTo(1088110.94, 0);
  });
});
```

Run: `npm run test:calcs` — these should pass before any deployment.

### 2. Server Action Tests

Test authorization, validation, and database effects:

```typescript
describe("createContract", () => {
  it("rejects VIEWER role", async () => {
    await expect(createContract(viewerSession, validData)).rejects.toThrow("Unauthorized");
  });

  it("validates puntaje range", async () => {
    await expect(createContract(adminSession, { ...validData, puntaje: 50 }))
      .rejects.toThrow();
  });

  it("auto-calculates all fields", async () => {
    const contract = await createContract(adminSession, validData);
    expect(contract.sacos46kg).not.toBeNull();
    expect(contract.facturacionLbs).not.toBeNull();
    expect(contract.totalPagoQTZ).not.toBeNull();
  });

  it("creates audit log entry", async () => {
    const contract = await createContract(adminSession, validData);
    const logs = await prisma.auditLog.findMany({
      where: { entityId: contract.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("CREATE");
  });
});
```

### 3. Import Service Tests

Use a fixture `.xlsx` file (subset of the real one) to test parsing:

```typescript
describe("Excel import", () => {
  it("parses SERENGETTI contracts correctly", () => {
    const result = parseClientSheet(workbook, "SERENGETTI", serengettiConfig);
    expect(result.contracts).toHaveLength(4);
    expect(result.contracts[0].contractNumber).toBe("P40129");
  });

  it("handles missing sheets gracefully", () => {
    expect(() => parseClientSheet(workbook, "NONEXISTENT", config))
      .toThrow('Sheet "NONEXISTENT" not found');
  });
});
```

---

## Security Model

### Authentication

- JWT-based with `jose` library (Edge Runtime compatible)
- Tokens stored in `httpOnly`, `secure`, `sameSite=strict` cookies
- 24-hour expiry, no refresh tokens (small team, acceptable UX tradeoff)
- Passwords hashed with bcryptjs (cost factor 12)

### Authorization Matrix

| Action                    | ADMIN | OPERATOR | VIEWER |
| ------------------------- | ----- | -------- | ------ |
| View contracts/shipments  | ✅    | ✅       | ✅     |
| Create/edit contracts     | ✅    | ✅       | ❌     |
| Delete contracts          | ✅    | ❌       | ❌     |
| Manage shipments          | ✅    | ✅       | ❌     |
| Import from Excel         | ✅    | ❌       | ❌     |
| Manage users              | ✅    | ❌       | ❌     |
| View audit logs           | ✅    | ✅       | ❌     |
| Change exchange rate      | ✅    | ❌       | ❌     |
| Export cost config        | ✅    | ✅       | ❌     |

### Middleware Implementation

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./lib/services/auth";

const PUBLIC_ROUTES = ["/login"];
const ADMIN_ROUTES = ["/settings/users", "/import"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifyToken(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r)) && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

### Input Validation

Every server action validates input with Zod before touching the database. Never trust client-side validation alone.

```typescript
const ContractCreateSchema = z.object({
  contractNumber: z.string().min(1).max(20),
  clientId: z.string().cuid(),
  puntaje: z.number().int().min(60).max(100),
  sacos69kg: z.number().positive().max(10000),
  precioBolsa: z.number().min(0).max(10000).optional(),
  diferencial: z.number().min(-500).max(500).optional(),
  // ... etc
});
```

---

## Deployment

### Infrastructure

```
                    ┌─────────────┐
                    │   Vercel     │
                    │  (Next.js)   │
                    └──────┬──────┘
                           │ DATABASE_URL
                    ┌──────▼──────┐
                    │  AWS RDS     │
                    │ (PostgreSQL) │
                    │  Aurora      │
                    └─────────────┘
```

### Vercel Configuration

```json
// vercel.json (if needed)
{
  "buildCommand": "prisma generate && next build",
  "framework": "nextjs"
}
```

Environment variables in Vercel dashboard:
```
DATABASE_URL      = postgresql://user:pass@your-aurora-endpoint:5432/cafemargen
JWT_SECRET        = (generated with openssl rand -hex 32)
JWT_EXPIRY        = 24h
NODE_ENV          = production
```

### Database Migration in Production

```bash
# From local machine with DATABASE_URL pointing to production
npx prisma migrate deploy

# Seed admin user
npx tsx prisma/seed.ts
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run typecheck
      - run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: --prod
```

### Production Checklist

```
PRE-DEPLOY
  □ All calculation tests pass
  □ TypeScript compiles with zero errors
  □ Database migration tested on staging
  □ Environment variables set in Vercel
  □ PostgreSQL accessible from Vercel's network
  □ SSL enforced on database connection (?sslmode=require)

POST-DEPLOY
  □ Login works
  □ Contract CRUD works
  □ Calculations match Excel values (spot check 3 contracts)
  □ Audit log captures actions
  □ No console errors in browser
  □ Mobile layout renders correctly

TEAM ONBOARDING
  □ Admin creates OPERATOR accounts for team
  □ 30-minute walkthrough session
  □ Bookmark the URL
  □ Delete the Excel (just kidding — archive it)
```

---

## Monitoring & Maintenance

**Error tracking**: Add Sentry (`@sentry/nextjs`) for production error monitoring.

**Database backups**: AWS RDS automated backups (daily, 7-day retention). Enable point-in-time recovery.

**Performance**: Vercel Analytics (built-in) for Web Vitals. Watch for slow Server Actions — add indexes if queries exceed 100ms.

**Updates**: Run `npx prisma migrate dev` locally, test, then `migrate deploy` to production. Never run `migrate dev` against prod.
