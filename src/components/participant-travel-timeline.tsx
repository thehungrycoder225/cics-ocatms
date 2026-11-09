import Link from "next/link";
import { ArrowRight, Bike, Car, Footprints, MapPin, Ship, Truck } from "lucide-react";
import { summarizeParticipantJourney } from "@/lib/participant-dashboard-state";
import type { ParticipantStopSummary } from "@/lib/participant-journey";
import { milestoneEvidenceLabel, orderParticipantStops, participantTimelineState } from "@/lib/participant-timeline-state";

function displayTime(value: string) {
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function reviewLabel(status: string | null) {
  return status ? status.replaceAll("_", " ").toLowerCase() : "Review status unavailable";
}

function TransportIcon({ mode }: { mode: string }) {
  const iconProps = { "aria-hidden": true as const, size: 18 };
  switch (mode) {
    case "SHIP": return <Ship {...iconProps} />;
    case "VAN": return <Truck {...iconProps} />;
    case "WALK": return <Footprints {...iconProps} />;
    case "BICYCLE":
    case "TWO_WHEELER": return <Bike {...iconProps} />;
    case "DRIVE": return <Car {...iconProps} />;
    default: return <MapPin {...iconProps} />;
  }
}

function MilestoneDetails({
  title,
  submittedAt,
  reviewStatus,
  flags,
  evidenceId,
}: {
  title: string;
  submittedAt: string | null;
  reviewStatus: string | null;
  flags: string[];
  evidenceId: string | null;
}) {
  return (
    <div className="participant-timeline-event">
      <h4>{title}</h4>
      <p>{submittedAt ? `Received ${displayTime(submittedAt)} · ${reviewLabel(reviewStatus)}` : "Not submitted"}</p>
      <p>{milestoneEvidenceLabel(submittedAt, evidenceId)}</p>
      {flags.length ? <p>Review flags: {flags.join(", ")}</p> : null}
    </div>
  );
}

export function ParticipantTravelTimeline({ stops }: { stops: ParticipantStopSummary[] }) {
  const orderedStops = orderParticipantStops(stops);
  const dayGroups = Map.groupBy(orderedStops, (stop) => stop.day);
  const { currentStop } = summarizeParticipantJourney(orderedStops);

  return (
    <section aria-labelledby="participant-timeline-heading" className="participant-timeline">
      <h2 id="participant-timeline-heading">Travel journey</h2>
      {Array.from(dayGroups.entries()).map(([day, dayStops]) => (
        <section className="participant-timeline-day" key={day}>
          <h3>Day {day}</h3>
          <ol>
            {dayStops.map((stop) => {
              const { label, hasException } = participantTimelineState(stop);
              const isCurrent = currentStop?.id === stop.id;
              return (
                <li className="participant-timeline-stop" key={stop.id}>
                  <details className="participant-timeline-detail card" name="participant-journey" open={isCurrent}>
                    <summary className="participant-timeline-summary">
                      <span className="participant-timeline-icon"><TransportIcon mode={stop.travelMode} /></span>
                      <span className="participant-timeline-summary-text">
                        <span className="participant-timeline-stop-label">Stop {stop.sequence}{isCurrent ? " · Current recorded leg" : ""}</span>
                        <span className="participant-timeline-destination">{stop.destination}</span>
                        <span className="participant-timeline-meta">
                          From: {stop.departureLocation ?? "Unavailable"} · {stop.travelMode.replaceAll("_", " ").toLowerCase()}
                        </span>
                        <span className="participant-timeline-meta">
                          {stop.plannedArrival ? `Planned arrival ${displayTime(stop.plannedArrival)}` : "No scheduled arrival"}
                        </span>
                        <span className="participant-timeline-state">{label}{hasException ? " · Review flag recorded" : ""}</span>
                      </span>
                      <span aria-hidden="true" className="participant-timeline-chevron">⌄</span>
                    </summary>
                    <div className="participant-timeline-body">
                      {stop.sessionId && stop.etaAt ? (
                        <p className="participant-timeline-eta">
                          Last route estimate: {displayTime(stop.etaAt)}; not a live location.
                        </p>
                      ) : null}
                      <div className="participant-timeline-events">
                        <MilestoneDetails
                          evidenceId={stop.arrivalEvidenceId}
                          flags={stop.arrivalReviewFlags}
                          reviewStatus={stop.arrivalReviewStatus}
                          submittedAt={stop.arrivalAt}
                          title="Arrival check-in"
                        />
                        <MilestoneDetails
                          evidenceId={stop.checkoutEvidenceId}
                          flags={stop.checkoutReviewFlags}
                          reviewStatus={stop.checkoutReviewStatus}
                          submittedAt={stop.checkoutAt}
                          title="Check-out"
                        />
                      </div>
                      {stop.dwellSeconds !== null ? (
                        <p className="participant-timeline-eta">
                          Dwell: {Math.floor(stop.dwellSeconds / 60)} min{stop.dwellProvisional ? " (provisional)" : ""}
                        </p>
                      ) : null}
                      <Link className="participant-journey-link" href={`/participant/trips/${stop.id}`}>
                        Open trip milestones <ArrowRight aria-hidden="true" size={16} />
                      </Link>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </section>
  );
}
