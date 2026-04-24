// ============================================================================
// scripts/lib/client-variants.ts
// ============================================================================
// Shared helper for ETL scripts that must resolve sheet-spelling client names
// to canonical DB `Client` rows without ever creating duplicates.
//
// Per the 2026-04-23 memory `feedback_client_variant_map.md`:
//   1. `docs/client-variant-map.md` is the live, append-only source of truth.
//   2. ETL scripts call `resolveStrict()`; if it returns { kind: "unresolved" }
//      the ETL MUST refuse to --execute until the user appends the variant.
//   3. `suggestFuzzy()` is DRY-RUN-ONLY scaffolding. It emits a Levenshtein
//      candidate so the user sees a proposed mapping. The ETL does not act on
//      the suggestion automatically.
//   4. After the map is complete (every observed variant mapped), the fuzzy
//      layer can be deleted; strict map + exact normalized DB fallback suffice.
// ============================================================================

import * as fs from "node:fs";
import * as path from "node:path";

const VARIANT_MAP_PATH = path.join(process.cwd(), "docs", "client-variant-map.md");

export type DbClient = { id: string; name: string; code: string };

export type CanonicalEntry = {
  name: string;
  code: string;
  variants: string[]; // stored verbatim; matched by normalize()
};

export type VariantMap = {
  path: string;
  canonicals: CanonicalEntry[];
};

export type StrictResolve =
  | { kind: "resolved"; client: DbClient; matchedVariant: string; canonical: CanonicalEntry }
  | {
      // Variant is listed under a canonical in the map, but no DB Client exists
      // with that canonical's code. User has pre-approved creation by adding
      // the canonical to the map; ETL `--execute` may insert the row.
      kind: "needs-create";
      canonical: CanonicalEntry;
      matchedVariant: string;
    }
  | {
      kind: "unresolved";
      sheetValue: string;
      suggestion: FuzzySuggestion | null;
      reason: string;
    };

export type FuzzySuggestion = {
  candidate: DbClient;
  distance: number;
  via: "name-ld" | "code-ld" | "substring";
};

// ── Normalization ────────────────────────────────────────────────────────────

export function normalize(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ── Variant map parsing ──────────────────────────────────────────────────────

export function loadVariantMap(mapPath: string = VARIANT_MAP_PATH): VariantMap {
  if (!fs.existsSync(mapPath)) {
    throw new Error(
      `client-variant-map.md not found at ${mapPath}. ETL scripts require this file.`
    );
  }
  const raw = fs.readFileSync(mapPath, "utf8");

  const canonicals: CanonicalEntry[] = [];
  let current: CanonicalEntry | null = null;

  // Parse `### Canonical: <name> [<code>]` headings and the `- <variant>` bullets below each.
  const lines = raw.split(/\r?\n/);
  let inPendingSection = false;
  for (const line of lines) {
    const pendingMarker = /^##\s+Pending\b/i.test(line);
    const likelyNewMarker = /^##\s+Known\s+likely-new\b/i.test(line);
    if (pendingMarker || likelyNewMarker) {
      // Flush current, stop collecting variants for "Pending" / "Known likely-new" sections
      if (current) canonicals.push(current);
      current = null;
      inPendingSection = true;
      continue;
    }
    if (/^##\s+Canonical clients\b/i.test(line)) {
      inPendingSection = false;
      continue;
    }
    if (inPendingSection) continue;

    const m = line.match(/^###\s+Canonical:\s+(.+?)\s+\[([A-Za-z0-9_-]+)\]\s*$/);
    if (m) {
      if (current) canonicals.push(current);
      current = { name: m[1].trim(), code: m[2].trim(), variants: [] };
      continue;
    }
    if (current) {
      const b = line.match(/^-\s+(.+?)\s*$/);
      if (b) current.variants.push(b[1].trim());
    }
  }
  if (current) canonicals.push(current);

  return { path: mapPath, canonicals };
}

// ── Strict resolution ────────────────────────────────────────────────────────

export function resolveStrict(
  sheetValue: string,
  map: VariantMap,
  dbClients: DbClient[]
): StrictResolve {
  const target = normalize(sheetValue);

  for (const canon of map.canonicals) {
    for (const v of canon.variants) {
      if (normalize(v) === target) {
        // Find the DB row via code (more stable than name for joins)
        const db = dbClients.find((c) => normalize(c.code) === normalize(canon.code));
        if (!db) {
          // Map authorizes this canonical; ETL --execute path may create.
          return { kind: "needs-create", canonical: canon, matchedVariant: v };
        }
        return { kind: "resolved", client: db, matchedVariant: v, canonical: canon };
      }
    }
  }

  return {
    kind: "unresolved",
    sheetValue,
    suggestion: suggestFuzzy(sheetValue, dbClients),
    reason: `Variant '${sheetValue}' is not listed under any canonical in docs/client-variant-map.md. Per feedback_client_variant_map.md, --execute is blocked until the user appends this variant to the map (either under an existing canonical or as a new canonical).`,
  };
}

// ── Fuzzy suggestion (DRY-RUN ONLY) ─────────────────────────────────────────
// Emits a single best-guess candidate so the user can copy-paste into the map.
// Execute code paths MUST NOT use this to auto-resolve — it is a hint only.

export function suggestFuzzy(sheetValue: string, dbClients: DbClient[]): FuzzySuggestion | null {
  const target = normalize(sheetValue);
  if (target.length === 0) return null;

  let best: FuzzySuggestion | null = null;
  for (const c of dbClients) {
    const dn = levenshtein(normalize(c.name), target);
    const dc = levenshtein(normalize(c.code), target);
    const d = Math.min(dn, dc);
    if (d <= 3 && (!best || d < best.distance)) {
      best = { candidate: c, distance: d, via: dn <= dc ? "name-ld" : "code-ld" };
    }
  }
  if (best && best.distance === 0) return best;

  if (target.length >= 4) {
    for (const c of dbClients) {
      const n = normalize(c.name);
      if (n.includes(target) || target.includes(n)) {
        const sub: FuzzySuggestion = { candidate: c, distance: 0, via: "substring" };
        if (!best || best.distance > 0) return sub;
      }
    }
  }
  return best;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
