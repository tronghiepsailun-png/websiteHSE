import type { DictionaryKey } from "./translate";

// Phase 1 ships a fixed set of seeded roles (see prisma/seed.ts ROLE_DEFS).
// If a role.key isn't one of these (e.g. a role added directly in the DB later),
// callers should fall back to the role's raw `name` field.
const KNOWN_ROLE_KEYS = new Set([
  "org_admin",
  "hse_manager",
  "department_manager",
  "hse_staff",
  "department_user",
  "viewer",
]);

export function roleLabelKey(roleKey: string): DictionaryKey | null {
  return KNOWN_ROLE_KEYS.has(roleKey) ? (`role.${roleKey}` as DictionaryKey) : null;
}
