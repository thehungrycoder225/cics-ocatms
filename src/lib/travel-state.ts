export function canSubmitMilestone(
  status: string,
  kind: "ARRIVAL" | "CHECKOUT",
  arrivalExists: boolean,
): boolean {
  if (kind === "ARRIVAL") return status === "IN_TRANSIT";
  return arrivalExists && ["ARRIVAL_SUBMITTED", "CHECKED_IN"].includes(status);
}
