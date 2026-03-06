// ============================================================================
// CafeMargen — Database Seed
// ============================================================================
// Run with: npm run db:seed
// Creates: admin user, default clients, suppliers, exchange rate, export config
// ============================================================================

import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Admin User ──
  const adminPassword = await hash("CafeMargen2026!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@cafemargen.com" },
    update: {},
    create: {
      email: "admin@cafemargen.com",
      name: "Administrador",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log(`  ✅ Admin user: ${admin.email}`);

  // ── Clients ──
  const clients = [
    { name: "Serengetti", code: "SER", country: "USA" },
    { name: "Swiss Water", code: "SWP", country: "Canada" },
    { name: "Opal", code: "OPL", country: "USA" },
    { name: "Onyx", code: "ONX", country: "USA" },
    { name: "Atlas", code: "ATL", country: "USA" },
    { name: "Stonex", code: "STX", country: "USA" },
    { name: "Sucafina Specialty", code: "SUC", country: "Switzerland" },
  ];

  for (const c of clients) {
    await prisma.client.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log(`  ✅ ${clients.length} clients seeded`);

  // ── Suppliers ──
  const suppliers = [
    { name: "K-Finos", code: "KFI" },
    { name: "José David Guerra", code: "JDG" },
    { name: "Walco", code: "WAL" },
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
  }
  console.log(`  ✅ ${suppliers.length} suppliers seeded`);

  // ── Exchange Rate ──
  await prisma.exchangeRate.create({
    data: {
      rate: 7.65,
      validFrom: new Date("2025-01-01"),
      validTo: new Date("2026-12-31"),
      isActive: true,
      notes: "Default rate from Excel workbook",
    },
  });
  console.log("  ✅ Exchange rate: Q7.65/USD");

  // ── Default Export Cost Config ──
  await prisma.exportCostConfig.create({
    data: {
      name: "Default 2025-2026",
      gastosPerSaco: 23,
      trillaPerQQ: 7,
      sacoYute: 1300,
      estampado: 500,
      bolsaGrainPro: 5000,
      fitoSanitario: 50,
      impuestoAnacafe1: 600,
      impuestoAnacafe2: 500,
      inspeccionOirsa: 300,
      fumigacion: 400,
      emisionDocumento: 1200,
      fletePuerto: 2000,
      seguro: 230,
      custodio: 450,
      agenteAduanal: 34619,
      isDefault: true,
    },
  });
  console.log("  ✅ Default export cost config seeded");

  // ── Farms ──
  const farms = [
    {
      name: "BRISAS",
      totalQuetzales: 9909581.76,
      tipoCambio: 7.65,
      totalUSD: 1295370.16,
      porcentaje: 0.82,
      aumentoPorcentaje: 0.20,
      nuevoTotal: 1554444.20,
      porcentajePrest: 0.70,
      totalPrestamo: 1088110.94,
    },
    {
      name: "SAN EMILIANO",
      totalQuetzales: 2175040,
      tipoCambio: 7.65,
      totalUSD: 284318.95,
      porcentaje: 0.18,
      aumentoPorcentaje: 0.20,
      nuevoTotal: 341182.75,
      porcentajePrest: 0.70,
      totalPrestamo: 238827.92,
    },
  ];

  for (const f of farms) {
    await prisma.farm.upsert({
      where: { name: f.name },
      update: {},
      create: f,
    });
  }
  console.log(`  ✅ ${farms.length} farms seeded`);

  console.log("\n🎉 Seed complete!\n");
  console.log("  Login credentials:");
  console.log("  Email:    admin@cafemargen.com");
  console.log("  Password: CafeMargen2026!");
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
