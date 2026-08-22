// Client-safe constants for the attendance module — kept separate from src/server/attendance.ts
// because that file imports `prisma` at top level, and a "use client" component importing a
// value (not just a type) from it drags the whole prisma import chain into the client bundle,
// which crashes Turbopack ("the chunking context (unknown) does not support external modules").
export const DEFAULT_SHIFT_HOURS = 12;
