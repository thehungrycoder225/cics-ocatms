import type { MonitoringRecord } from "@/lib/monitoring";
import { getMilestoneState } from "@/lib/monitoring-state";

function displayTime(value: string | null): string {
  if (!value) return "Not reported";
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function statusLabel(value: string | null): string {
  return value?.replaceAll("_", " ").toLowerCase() ?? "Not submitted";
}

export function TravelTimeline({ records }: { records: MonitoringRecord[] }) {
  const orderedRecords = [...records].sort(
    (left, right) => left.day - right.day || left.sequence - right.sequence,
  );
  const dayGroups = orderedRecords.map((record, index) => ({
    record,
    showDay: index === 0 || orderedRecords[index - 1].day !== record.day,
  }));

  return (
    <ol aria-label="Itinerary journey timeline" className="travel-timeline">
      {dayGroups.map(({ record, showDay }) => {
        const milestoneState = getMilestoneState(record).replaceAll("_", " ").toLowerCase();

        return (
          <li className="travel-timeline-stop" key={record.stopId}>
            {showDay ? <h4 className="travel-timeline-day">Day {record.day}</h4> : null}
            <div className="travel-timeline-marker" aria-hidden="true" />
            <div className="travel-timeline-content">
              <div className="travel-timeline-heading">
                <h5>{record.destination}</h5>
                <span className="travel-timeline-status">
                  {record.overdueArrival ? "Overdue arrival" : milestoneState}
                </span>
              </div>
              <p className="muted mt-1 text-sm">
                Stop {record.sequence}
                {record.departureLocation ? ` · From ${record.departureLocation}` : ""}
                {` · ${record.travelMode.replaceAll("_", " ").toLowerCase()}`}
              </p>
              {record.plannedArrival ? (
                <p className="muted mt-1 text-xs">Planned arrival {displayTime(record.plannedArrival)}</p>
              ) : null}
              <dl className="travel-timeline-events">
                <div>
                  <dt>Arrival</dt>
                  <dd>{statusLabel(record.arrivalStatus)}{record.arrivalAt ? ` · ${displayTime(record.arrivalAt)}` : ""}</dd>
                </div>
                <div>
                  <dt>Check-out</dt>
                  <dd>{statusLabel(record.checkoutStatus)}{record.checkoutAt ? ` · ${displayTime(record.checkoutAt)}` : ""}</dd>
                </div>
              </dl>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
