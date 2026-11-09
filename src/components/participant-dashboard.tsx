"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { ParticipantActivity } from "@/lib/participant-journey";
import { summarizeParticipantJourney } from "@/lib/participant-dashboard-state";

function approvalLabel(status: string) {
  return status === "APPROVED" ? "Approved" : `Approval: ${status.replaceAll("_", " ").toLowerCase()}`;
}

function journeyStatus(status: string) {
  switch (status) {
    case "IN_TRANSIT": return "In transit";
    case "ARRIVAL_SUBMITTED": return "Arrival submitted · check-out pending";
    case "CHECKED_IN": return "Checked in · check-out pending";
    default: return status.replaceAll("_", " ").toLowerCase();
  }
}

export function ParticipantDashboard({ activities }: { activities: ParticipantActivity[] }) {
  const [selectedId, setSelectedId] = useState("");
  const selectedActivity = activities.length === 1
    ? activities[0]
    : activities.find((activity) => activity.id === selectedId);
  const summary = selectedActivity ? summarizeParticipantJourney(selectedActivity.stops) : null;

  return (
    <div className="participant-dashboard">
      <div className="participant-dashboard-heading">
        <h1>My activities</h1>
      </div>

      {activities.length > 0 ? (
        <section aria-labelledby="participant-journey-title" className="card participant-journey">
          <div className="participant-journey-top">
            <div>
              <h2 id="participant-journey-title">Travel journey</h2>
              <p className="muted text-sm">Recorded progress for your assigned activity</p>
            </div>
            {activities.length > 1 ? (
              <label className="participant-activity-select">
                <span>Activity</span>
                <select
                  className="input-field"
                  onChange={(event) => setSelectedId(event.target.value)}
                  value={selectedId}
                >
                  <option value="">Select an activity</option>
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.title} ({activity.startDate} – {activity.endDate})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {selectedActivity && summary ? (
            <div className="participant-journey-content">
              <div className="participant-journey-activity">
                <span className="participant-approval">{approvalLabel(selectedActivity.approvalStatus)}</span>
                <h3>{selectedActivity.title}</h3>
                <p><CalendarDays aria-hidden="true" size={16} /> {selectedActivity.startDate} – {selectedActivity.endDate}</p>
                <p><MapPin aria-hidden="true" size={16} /> {selectedActivity.venue ?? "Venue pending"}</p>
                {selectedActivity.approvalStatus !== "APPROVED" ? (
                  <p className="participant-journey-note">
                    Existing trip records are shown. New travel cannot begin until approval is restored.
                  </p>
                ) : null}
              </div>
              <div className="participant-journey-leg">
                {summary.currentStop ? (
                  <>
                    <p className="participant-journey-label">Current recorded leg</p>
                    <p className="participant-journey-route">
                      {summary.currentStop.departureLocation ?? "Origin unavailable"} → {summary.currentStop.destination}
                    </p>
                    <p className="muted text-sm">
                      Day {summary.currentStop.day} · Stop {summary.currentStop.sequence} · {summary.currentStop.travelMode.replaceAll("_", " ").toLowerCase()}
                    </p>
                    <p className="participant-journey-state">{journeyStatus(summary.currentStop.status)}</p>
                    <Link className="participant-journey-link" href={`/participant/trips/${summary.currentStop.id}`}>
                      View trip milestones <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="participant-journey-label">Journey details</p>
                    <p className="muted text-sm">
                      {summary.hasMultipleActiveStops
                        ? "More than one open trip is recorded. View the itinerary for details."
                        : summary.visibleStops === 0
                          ? "No itinerary stops are available in this view."
                          : "No single current trip is recorded. View the itinerary for details."}
                    </p>
                    <Link className="participant-journey-link" href={`/participant/activities/${selectedActivity.id}`}>
                      View itinerary <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                  </>
                )}
              </div>
              <div className="participant-journey-progress">
                <h3>Recorded progress</h3>
                {summary.visibleStops ? (
                  <>
                    <p>{summary.submittedCheckouts} of {summary.visibleStops} visible stops · check-outs submitted</p>
                    <p>{summary.verifiedCheckouts} of {summary.visibleStops} visible stops · check-outs verified</p>
                  </>
                ) : (
                  <p>No visible stops to report.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="participant-journey-empty">Select an activity to view its recorded journey.</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="participant-activities-heading">
        <div className="participant-section-heading">
          <h2 id="participant-activities-heading">Assigned activities</h2>
          <span className="muted text-sm">{activities.length} {activities.length === 1 ? "activity" : "activities"}</span>
        </div>
        {activities.length === 0 ? (
          <div className="card participant-activity-empty">
            <h3>No activities available</h3>
            <p className="muted mt-2 text-sm leading-6">
              Approved activities assigned to you appear here. Existing trip records remain
              available if an activity is pending reapproval.
            </p>
          </div>
        ) : (
          <ul className="participant-activity-list">
            {activities.map((activity) => (
              <li className="card participant-activity-card" key={activity.id}>
                <div>
                  <span className="participant-approval">{approvalLabel(activity.approvalStatus)}</span>
                  <h3>{activity.title}</h3>
                  <p className="muted text-sm">{activity.startDate} – {activity.endDate}</p>
                  <p className="muted text-sm">{activity.venue ?? "Venue pending"}</p>
                  <p className="muted text-sm">
                    {activity.approvalStatus === "APPROVED"
                      ? `${activity.stops.length} approved stop${activity.stops.length === 1 ? "" : "s"}`
                      : "Existing trip records remain available"}
                  </p>
                </div>
                <Link className="participant-journey-link" href={`/participant/activities/${activity.id}`}>
                  View itinerary <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-label="Location privacy" className="participant-privacy">
        <ShieldCheck aria-hidden="true" size={20} />
        <div>
          <p>Location reporting is participant-initiated. OCATMS does not continuously track location or infer safety from a reported GPS fix.</p>
          <Link href="/settings">Privacy and installation details</Link>
        </div>
      </aside>
    </div>
  );
}
