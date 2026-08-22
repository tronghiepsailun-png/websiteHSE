// Split out from src/server/work-plan.ts so client components can import the status list
// without dragging that module's `prisma` import into the browser bundle.
export const WORK_PLAN_STATUSES = ["not_started", "in_progress", "delayed", "completed"] as const;
export type WorkPlanStatus = (typeof WORK_PLAN_STATUSES)[number];

// Quick-pick progress milestones — matches the fixed set the user asked for, rather than a
// free-form 0-100 input.
export const WORK_PLAN_PROGRESS_MILESTONES = [0, 20, 40, 60, 80, 90, 100] as const;
