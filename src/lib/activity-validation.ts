import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a real calendar date in YYYY-MM-DD format.");

const collegeIds = z
  .array(z.string().uuid())
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, "College associations must be unique.");

const commonFields = {
  organizer: z.string().trim().max(200).nullable().optional(),
  venue: z.string().trim().max(300).nullable().optional(),
  startDate: dateOnly,
  endDate: dateOnly,
  facultyInChargeLabel: z.string().trim().max(200).nullable().optional(),
};

export const activityCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    ...commonFields,
    hostCollegeId: z.string().uuid(),
    collegeIds,
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "The end date must be on or after the start date.",
    path: ["endDate"],
  })
  .refine((value) => value.collegeIds.includes(value.hostCollegeId), {
    message: "The host college must be one of the activity's associated colleges.",
    path: ["hostCollegeId"],
  });

export const activityUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    organizer: z.string().trim().max(200).nullable().optional(),
    venue: z.string().trim().max(300).nullable().optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    facultyInChargeLabel: z.string().trim().max(200).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one editable activity field.");

export const activityApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(1000).optional(),
});
