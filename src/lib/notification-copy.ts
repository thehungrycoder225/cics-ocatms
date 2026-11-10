export interface MilestoneNotificationContent {
  kind: "ARRIVAL" | "CHECKOUT";
  participantName: string;
  activityTitle: string;
  destination: string;
  receivedAt: string;
  validationStatus: "PENDING" | "FLAGGED_FOR_REVIEW" | "VERIFIED";
}

export function formatMilestoneNotification(content: MilestoneNotificationContent): {
  title: string;
  message: string;
  status: string;
  receivedAt: string;
} {
  const eventName = content.kind === "ARRIVAL" ? "arrival check-in" : "check-out";
  const receivedAt = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(content.receivedAt));

  return {
    title: `${content.participantName} submitted ${eventName}`,
    message: `${content.activityTitle} · ${content.destination} · ${receivedAt}`,
    status:
      content.validationStatus === "VERIFIED"
        ? "Verified"
        : content.validationStatus === "FLAGGED_FOR_REVIEW"
          ? "Flagged for review"
          : "Pending review",
    receivedAt,
  };
}
