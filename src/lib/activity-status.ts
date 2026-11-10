export type ActivityStatus = "UPCOMING" | "ONGOING" | "COMPLETED";

const manilaDateFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Manila",
  year: "numeric",
});

export function getManilaDate(now = new Date()): string {
  const parts: Partial<Record<"year" | "month" | "day", string>> = {};
  for (const part of manilaDateFormatter.formatToParts(now)) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      parts[part.type] = part.value;
    }
  }
  if (!parts.year || !parts.month || !parts.day) {
    throw new Error("Could not determine the current Asia/Manila date.");
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getActivityStatus(
  startDate: string,
  endDate: string,
  today = getManilaDate(),
): ActivityStatus {
  if (startDate > today) return "UPCOMING";
  if (endDate < today) return "COMPLETED";
  return "ONGOING";
}
