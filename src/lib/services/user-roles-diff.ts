import type { UserRole } from "@prisma/client";

export interface RoleDiff {
  toRemove: UserRole[];
  toAdd: UserRole[];
}

// Compares the current set of role assignments against the requested set and
// returns only what changed. Used so updateUserRoles can preserve assignedBy
// and assignedAt provenance on roles that survive the edit.
export function diffRoles(current: UserRole[], requested: UserRole[]): RoleDiff {
  const currentSet = new Set(current);
  const requestedSet = new Set(requested);
  return {
    toRemove: current.filter((r) => !requestedSet.has(r)),
    toAdd: requested.filter((r) => !currentSet.has(r)),
  };
}
