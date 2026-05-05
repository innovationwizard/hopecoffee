# The Silos Issue — v1
_Created: 2026-05-04. This file is a versioned snapshot. Do NOT edit or delete it. Add information in a new version file (v2, v3, ...)._

---

## What the silos issue is

HopeCoffee's operation is run by four people who interact daily but do not share a common language, do not share a common nomenclature, and are not genuinely interested in each other's information. Each person operates in their own information silo. The app must respect those silos to maintain user adoption, while working toward a long-term goal of resolving conflicts and closing the gaps between them.

---

## The people and their silos

### Octavio — Finance / General Management
- **Domain:** money, contracts, margins, P&L.
- **Language:** numbers at the contract level — price, volume, total billing, total pago, gastos, margen.
- **Inputs to the app:** per-contract high-level data (price, sacos, diferencial, tipo de cambio).
- **Expects from the app:** high-level summaries with all imaginable granularity and all imaginable drill-downs — on his terms, in his language.
- **"Gastos de Exportación" belongs to Octavio.** For him, this is a single open field where he writes a number (int or float). It is original source data. It is not derived from anyone else's input. It feeds his calculations directly.
- **Critical incident (2026-05-04):** Showing Octavio the "Costos de Exportación" composition panel — which belongs to Hector's silo — caused a strong backlash: _"THIS APP DOESN'T WORK."_ Hector's granular cost breakdown is noise to Octavio. It must not appear in his view.

### Hector — Coffee / Operations / Lab
- **Domain:** physical coffee — sourcing, quality, processing, packaging, inventory, logistics until FOB.
- **Language:** SCA (Specialty Coffee Association), cupping scores, defect counts, pergamino, oro, rendimiento, lotes, batches, containers.
- **Inputs to the app:** factual fields from receipts, payments, and physical events at the mill and warehouse.
- **Expects from the app:** _"I need to know everything about every possible inventory until the coffee is FOB"_ — coffee state, packaging, subproducts, quality changes (even when coffee was not moved or processed — did a batch change quality because of X, Y, Z? EVERYTHING).
- **"Costos de Exportación" belongs to Hector.** These are line-item costs: trilla, sacos, estampado, bolsa GrainPro, fito sanitario, impuestos Anacafé, inspección OIRSA, fumigación, emisión documento, flete a puerto, seguro, custodio, agente aduanal, comisión exportador orgánico. Each field is populated from real receipts or payments.
- Hector practically directs the mills and warehouses because HopeCoffee is their main buyer. He oversees the physical fulfillment of every container in every contract.

### Jose Herrera — Purchasing
- **Domain:** buying coffee from producers.
- **Current status:** Has not expressed expectations from the app. Has not made any requests. Sits on the belief that the app is not necessary.
- **Risk:** low engagement, potential resistance. No silo requirements documented yet.

### Roberto Lopez (full name: Jose Roberto Lopez, also known as Jose Lopez) — Accounting
- **Domain:** reconciliation, unified reporting, financial answers.
- **Role before the app existed:** Physically visited each of the above people, extracted incomplete data, reconciled their different languages, unified the math, presented consolidated reports to the Head of Accounting, and found clever ways to answer Octavio's infinite financial questions from partial data.
- **He is the human bridge between silos.** The app's long-term goal is to make the app do what Roberto does manually today — automatically, reliably, and in real time.
- His silo requirements have not been formally documented yet.

---

## The core systemic problem

> **These people use different nomenclature for each single item.**
> **They talk to each other daily but do not speak the same language.**
> **None of them are genuinely interested in understanding each other's information. They care only for their own silo's needs.**

This is not a communication failure to be fixed with training. It is a structural reality of how the business operates. The app must work with this reality, not against it.

---

## Current design constraint

**The app must remain siloed for now.**

Each silo must be fully functional in isolation, with its own data, its own views, and its own language. Showing one silo's data to another silo's user in a way that breaks their mental model causes rejection of the app entirely.

---

## Long-term design goal

The app is the first system in HopeCoffee's history that can see all silos simultaneously. The end game is:

1. Detect conflicts between silos (e.g., Octavio's "Gastos de Exportación" vs. Hector's "Costos de Exportación" — same economic reality, different sources, different granularity).
2. Close the gaps — surface discrepancies to Roberto (or the right reconciler) for resolution.
3. Eventually produce a single, unified, consolidated, reconciled system that replaces Roberto's manual bridging work.

This is a phased goal. Phase 1 is adoption. Phase 2 is reconciliation.

---

## Known silo conflicts (as of v1)

| Concept | Octavio's version | Hector's version | Conflict |
|---|---|---|---|
| Export costs | "Gastos de Exportación" — one number, his input | "Costos de Exportación" — 15 line items, from receipts | Same economic reality, two different sources, two different levels of granularity. One may contradict the other. |

_More conflicts to be documented in future versions._
