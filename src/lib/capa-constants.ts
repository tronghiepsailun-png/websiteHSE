// Client-safe constants for the CAPA module — kept separate from src/server/capa.ts because
// that file imports `prisma` at top level, and a "use client" component importing a value
// (not just a type) from it drags the whole prisma import chain into the client bundle,
// which crashes Turbopack ("the chunking context (unknown) does not support external modules").

/** Phân loại vấn đề — fixed list matching the org's own paper tracking sheet, not an
 *  admin-editable picklist. */
export const CAPA_CLASSIFICATIONS = ["hazard", "strict_equipment", "safety_equipment", "fire_safety", "electrical", "environment"] as const;
export type CapaClassification = (typeof CAPA_CLASSIFICATIONS)[number];
