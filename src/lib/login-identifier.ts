import { z } from "zod";

export const loginIdentifierSchema = z.string().trim().toLowerCase().min(1).max(254).refine(
  (value) => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value) || z.email().safeParse(value).success,
  "Enter a valid username or email.",
);
