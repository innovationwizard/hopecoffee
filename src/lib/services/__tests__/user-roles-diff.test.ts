import { describe, it, expect } from "vitest";
import { diffRoles } from "../user-roles-diff";

describe("diffRoles", () => {
  it("returns empty diffs when current equals requested", () => {
    const { toRemove, toAdd } = diffRoles(
      ["GERENCIA", "FINANCIERO"],
      ["GERENCIA", "FINANCIERO"]
    );
    expect(toRemove).toEqual([]);
    expect(toAdd).toEqual([]);
  });

  it("ignores ordering differences", () => {
    const { toRemove, toAdd } = diffRoles(
      ["GERENCIA", "FINANCIERO"],
      ["FINANCIERO", "GERENCIA"]
    );
    expect(toRemove).toEqual([]);
    expect(toAdd).toEqual([]);
  });

  it("detects only-add changes", () => {
    const { toRemove, toAdd } = diffRoles(
      ["GERENCIA"],
      ["GERENCIA", "FINANCIERO"]
    );
    expect(toRemove).toEqual([]);
    expect(toAdd).toEqual(["FINANCIERO"]);
  });

  it("detects only-remove changes", () => {
    const { toRemove, toAdd } = diffRoles(
      ["GERENCIA", "FINANCIERO"],
      ["GERENCIA"]
    );
    expect(toRemove).toEqual(["FINANCIERO"]);
    expect(toAdd).toEqual([]);
  });

  it("handles a full role swap (no overlap)", () => {
    const { toRemove, toAdd } = diffRoles(["COMPRAS"], ["ANALISIS"]);
    expect(toRemove).toEqual(["COMPRAS"]);
    expect(toAdd).toEqual(["ANALISIS"]);
  });

  it("handles mixed add and remove with overlap (Roberto's real case)", () => {
    const { toRemove, toAdd } = diffRoles(
      ["COMPRAS", "CONTABILIDAD"],
      ["ANALISIS", "CONTABILIDAD"]
    );
    expect(toRemove).toEqual(["COMPRAS"]);
    expect(toAdd).toEqual(["ANALISIS"]);
  });

  it("handles empty current (newly created user with all roles to add)", () => {
    const { toRemove, toAdd } = diffRoles([], ["VENTAS", "LAB"]);
    expect(toRemove).toEqual([]);
    expect(toAdd).toEqual(["VENTAS", "LAB"]);
  });
});
