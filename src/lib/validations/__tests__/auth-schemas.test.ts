import { describe, it, expect } from "vitest";
import {
  PasswordChangeSchema,
  UpdateUserRolesSchema,
} from "../schemas";

describe("PasswordChangeSchema", () => {
  it("accepts a valid current + new password pair", () => {
    const r = PasswordChangeSchema.safeParse({
      currentPassword: "old-secret",
      newPassword: "new-strong-password",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty current password", () => {
    const r = PasswordChangeSchema.safeParse({
      currentPassword: "",
      newPassword: "new-strong-password",
    });
    expect(r.success).toBe(false);
  });

  it("rejects new password under 8 characters", () => {
    const r = PasswordChangeSchema.safeParse({
      currentPassword: "old",
      newPassword: "short",
    });
    expect(r.success).toBe(false);
  });

  it("rejects new password over 100 characters", () => {
    const r = PasswordChangeSchema.safeParse({
      currentPassword: "old",
      newPassword: "x".repeat(101),
    });
    expect(r.success).toBe(false);
  });

  it("accepts new password at the 8 character boundary", () => {
    const r = PasswordChangeSchema.safeParse({
      currentPassword: "old",
      newPassword: "12345678",
    });
    expect(r.success).toBe(true);
  });
});

describe("UpdateUserRolesSchema", () => {
  it("accepts a valid cuid + non-empty roles array", () => {
    const r = UpdateUserRolesSchema.safeParse({
      userId: "cmodeit3p0000l404kbjskq2d",
      roles: ["ANALISIS", "CONTABILIDAD"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty roles array", () => {
    const r = UpdateUserRolesSchema.safeParse({
      userId: "cmodeit3p0000l404kbjskq2d",
      roles: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown role value", () => {
    const r = UpdateUserRolesSchema.safeParse({
      userId: "cmodeit3p0000l404kbjskq2d",
      roles: ["NOT_A_REAL_ROLE"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-cuid userId", () => {
    const r = UpdateUserRolesSchema.safeParse({
      userId: "not-a-cuid",
      roles: ["ANALISIS"],
    });
    expect(r.success).toBe(false);
  });
});
