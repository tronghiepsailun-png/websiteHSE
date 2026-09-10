// Client-safe constants for the records module — kept separate from src/server/records.ts
// because that file imports `prisma` at top level, and a "use client" component importing a
// value (not just a type) from it drags the whole prisma import chain into the client bundle,
// which crashes Turbopack ("the chunking context (unknown) does not support external modules").
export const RECORD_ENTRY_SLOT_COUNT = 12;
