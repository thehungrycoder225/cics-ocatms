"use client";

import Link from "next/link";
import { useState } from "react";
import { EvidenceInspector } from "@/components/evidence-inspector";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TravelTimeline } from "@/components/travel-timeline";
import type { MonitoringRecord } from "@/lib/monitoring";

type EvidenceKind = "ARRIVAL" | "CHECKOUT";

interface ParticipantDetailDrawerProps {
  records: MonitoringRecord[] | null;
  role: "DEAN" | "VPSAS";
  onClose: () => void;
  onReviewed: () => Promise<void>;
}

function displayTime(value: string | null): string {
  if (!value) return "Not reported";
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function locationAge(seconds: number | null): string {
  if (seconds === null) return "Fix age unavailable";
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function statusLabel(status: string | null, submitted: boolean): string {
  if (!submitted) return "Not submitted";
  return status?.replaceAll("_", " ").toLowerCase() ?? "Pending";
}

export function ParticipantDetailDrawer({
  records,
  role,
  onClose,
  onReviewed,
}: ParticipantDetailDrawerProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<{
    record: MonitoringRecord;
    kind: EvidenceKind;
  } | null>(null);
  const orderedRecords = [...(records ?? [])].sort(
    (left, right) => left.day - right.day || left.sequence - right.sequence,
  );
  const latestFix = [...orderedRecords]
    .filter(
      (record): record is MonitoringRecord & { lastReportedAt: string } =>
        record.lastReportedAt !== null,
    )
    .sort((left, right) => Date.parse(right.lastReportedAt) - Date.parse(left.lastReportedAt))[0];
  const participant = orderedRecords[0];

  return (
    <Sheet onOpenChange={(open) => { if (!open) onClose(); }} open={Boolean(records?.length)}>
      <SheetContent className="participant-detail-sheet" side="right">
        {participant ? (
          <>
            <SheetHeader className="participant-detail-header">
              <SheetTitle>{participant.participantName}</SheetTitle>
              <SheetDescription>
                {participant.activityTitle}
                {participant.collegeName ? ` · ${participant.collegeName}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="participant-detail-scroll">
              <section aria-label="Last reported location" className="participant-detail-location">
                <h3>Last reported location</h3>
                <p>{latestFix ? displayTime(latestFix.lastReportedAt) : "No location reported"}</p>
                {latestFix ? (
                  <>
                    <p className="muted mt-1 text-sm">
                      {latestFix.lastLatitude === null || latestFix.lastLongitude === null
                        ? "Coordinates not available"
                        : `${latestFix.lastLatitude.toFixed(6)}, ${latestFix.lastLongitude.toFixed(6)}`}
                    </p>
                    <p className="muted mt-1 text-sm">
                      {locationAge(latestFix.fixAgeSeconds)}
                      {latestFix.lastAccuracyM === null ? "" : ` · Accuracy ±${Math.round(latestFix.lastAccuracyM)} m`}
                    </p>
                    <p className="muted mt-1 text-xs">
                      GPS acquired {displayTime(latestFix.gpsAcquiredAt)}
                      {latestFix.lastReportSource ? ` · ${latestFix.lastReportSource.replaceAll("_", " ").toLowerCase()}` : ""}
                    </p>
                  </>
                ) : null}
                <p className="muted mt-2 text-xs">
                  A last-reported fix is not live tracking or proof of safety.
                </p>
              </section>

              <section aria-labelledby="participant-timeline-title" className="participant-detail-section">
                <h3 id="participant-timeline-title">Travel timeline</h3>
                <TravelTimeline records={orderedRecords} />
              </section>

              <section aria-labelledby="participant-evidence-title" className="participant-detail-section">
                <h3 id="participant-evidence-title">Evidence and reviews</h3>
                <ul className="participant-evidence-list">
                  {orderedRecords.map((record) => (
                    <li className="participant-evidence-stop" key={record.stopId}>
                      <h4>Day {record.day}, stop {record.sequence}: {record.destination}</h4>
                      <div className="participant-evidence-row">
                        <div>
                          <p className="text-sm font-semibold">Arrival evidence</p>
                          <p className="muted text-xs">
                            {statusLabel(record.arrivalStatus, Boolean(record.arrivalCheckInId))}
                            {record.arrivalEvidenceId ? " · Evidence submitted" : record.arrivalCheckInId ? " · No evidence attached" : ""}
                          </p>
                        </div>
                        {record.arrivalCheckInId ? (
                          <button
                            className="button-secondary participant-evidence-action"
                            onClick={() => setSelectedEvidence({ record, kind: "ARRIVAL" })}
                            type="button"
                          >
                            Review arrival
                          </button>
                        ) : null}
                      </div>
                      <div className="participant-evidence-row">
                        <div>
                          <p className="text-sm font-semibold">Check-out evidence</p>
                          <p className="muted text-xs">
                            {statusLabel(record.checkoutStatus, Boolean(record.checkoutCheckInId))}
                            {record.checkoutEvidenceId ? " · Evidence submitted" : record.checkoutCheckInId ? " · No evidence attached" : ""}
                          </p>
                        </div>
                        {record.checkoutCheckInId ? (
                          <button
                            className="button-secondary participant-evidence-action"
                            onClick={() => setSelectedEvidence({ record, kind: "CHECKOUT" })}
                            type="button"
                          >
                            Review check-out
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <Link
                className="participant-detail-activity-link"
                href={`/${role === "DEAN" ? "dean" : "vpsas"}/activities/${participant.activityId}`}
              >
                Open activity monitoring
              </Link>
            </div>
            {selectedEvidence ? (
              <EvidenceInspector
                kind={selectedEvidence.kind}
                onOpenChange={(open) => { if (!open) setSelectedEvidence(null); }}
                onReviewed={onReviewed}
                open
                record={selectedEvidence.record}
              />
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
