"use client";

import { useState, type FormEvent } from "react";
import { EvidencePreview } from "@/components/evidence-preview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MonitoringRecord } from "@/lib/monitoring";

type EvidenceKind = "ARRIVAL" | "CHECKOUT";

interface EvidenceInspectorProps {
  record: MonitoringRecord;
  kind: EvidenceKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => Promise<void>;
}

function displayTime(value: string | null): string {
  if (!value) return "Not reported";
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function flagLabel(flag: string): string {
  return flag.replaceAll("_", " ").toLowerCase();
}

function ReviewForm({
  checkInId,
  currentStatus,
  onReviewed,
}: {
  checkInId: string;
  currentStatus: string | null;
  onReviewed: () => Promise<void>;
}) {
  const [decision, setDecision] = useState<"VERIFIED" | "FLAGGED_FOR_REVIEW">(
    currentStatus === "VERIFIED" ? "VERIFIED" : "FLAGGED_FOR_REVIEW",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/monitoring/check-ins/${checkInId}/review`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
        cache: "no-store",
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Review could not be saved.");
      setNote("");
      await onReviewed();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className="evidence-inspector-review" onSubmit={submit}>
      <label className="block text-sm font-semibold" htmlFor={`inspector-decision-${checkInId}`}>
        Review decision
      </label>
      <select
        className="input-field mt-1"
        id={`inspector-decision-${checkInId}`}
        onChange={(event) => setDecision(event.target.value as "VERIFIED" | "FLAGGED_FOR_REVIEW")}
        value={decision}
      >
        <option value="VERIFIED">Verify submission</option>
        <option value="FLAGGED_FOR_REVIEW">Keep flagged for review</option>
      </select>
      <label className="mt-3 block text-sm font-semibold" htmlFor={`inspector-note-${checkInId}`}>
        Review note (required)
      </label>
      <textarea
        className="input-field mt-1"
        id={`inspector-note-${checkInId}`}
        maxLength={2000}
        minLength={3}
        onChange={(event) => setNote(event.target.value)}
        required
        rows={3}
        value={note}
      />
      {error ? <p className="mt-2 text-sm text-red-800" role="alert">{error}</p> : null}
      <button className="button-primary mt-3" disabled={working || note.trim().length < 3} type="submit">
        {working ? "Saving review…" : "Save review"}
      </button>
    </form>
  );
}

export function EvidenceInspector({
  record,
  kind,
  open,
  onOpenChange,
  onReviewed,
}: EvidenceInspectorProps) {
  const isArrival = kind === "ARRIVAL";
  const label = isArrival ? "Arrival evidence" : "Check-out evidence";
  const receivedAt = isArrival ? record.arrivalAt : record.checkoutAt;
  const status = isArrival ? record.arrivalStatus : record.checkoutStatus;
  const checkInId = isArrival ? record.arrivalCheckInId : record.checkoutCheckInId;
  const evidenceId = isArrival ? record.arrivalEvidenceId : record.checkoutEvidenceId;
  const geofenceStatus = isArrival ? record.arrivalGeofenceStatus : record.checkoutGeofenceStatus;
  const latitude = isArrival ? record.arrivalLatitude : record.checkoutLatitude;
  const longitude = isArrival ? record.arrivalLongitude : record.checkoutLongitude;
  const accuracyM = isArrival ? record.arrivalAccuracyM : record.checkoutAccuracyM;
  const flags = isArrival ? record.arrivalFlags : record.checkoutFlags;
  const note = isArrival ? record.arrivalReviewNote : record.checkoutReviewNote;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="evidence-inspector-dialog">
        <DialogHeader className="evidence-inspector-header">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {record.participantName} · {record.activityTitle} · Day {record.day}, stop {record.sequence}
          </DialogDescription>
        </DialogHeader>
        <div className="evidence-inspector-body">
          <section aria-label={`${label} preview`} className="evidence-inspector-preview">
            {evidenceId ? (
              <EvidencePreview evidenceId={evidenceId} title={label} />
            ) : (
              <p className="muted rounded-lg bg-[#f8f6f7] p-4 text-sm">
                No evidence is attached to this submitted milestone.
              </p>
            )}
          </section>
          <section aria-label={`${label} metadata`} className="evidence-inspector-metadata">
            <h3 className="font-bold">Submission details</h3>
            <dl className="evidence-inspector-details">
              <div><dt>Destination</dt><dd>{record.destination}</dd></div>
              <div><dt>Milestone</dt><dd>{isArrival ? "Arrival check-in" : "Explicit check-out"}</dd></div>
              <div><dt>Review status</dt><dd>{status?.replaceAll("_", " ") ?? "Not submitted"}</dd></div>
              <div><dt>Server received</dt><dd>{displayTime(receivedAt)}</dd></div>
              <div><dt>Geofence</dt><dd>{geofenceStatus?.replaceAll("_", " ").toLowerCase() ?? "Not available"}</dd></div>
              <div><dt>GPS accuracy</dt><dd>{accuracyM === null ? "Not available" : `±${Math.round(accuracyM)} m`}</dd></div>
              <div>
                <dt>Reported coordinates</dt>
                <dd>{latitude === null || longitude === null ? "Not available" : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}</dd>
              </div>
              <div><dt>Flags</dt><dd>{flags.length ? flags.map(flagLabel).join(", ") : "None recorded"}</dd></div>
              <div><dt>Latest review note</dt><dd>{note || "No review note"}</dd></div>
            </dl>
            {checkInId ? (
              <ReviewForm checkInId={checkInId} currentStatus={status} onReviewed={onReviewed} />
            ) : (
              <p className="muted mt-4 text-sm">This milestone has not been submitted and cannot be reviewed.</p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
