"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { EvidencePreview } from "@/components/evidence-preview";
import { SignOutButton } from "@/components/sign-out-button";
import {
  type MonitoringDashboardData,
  type MonitoringFilters,
  type MonitoringRecord,
} from "@/lib/monitoring";
import { buildMonitoringBreakdowns, getMilestoneState } from "@/lib/monitoring-state";

interface MonitoringConsoleProps {
  initialData: MonitoringDashboardData;
  role: "DEAN" | "VPSAS";
  activityId?: string;
}

function displayTime(value: string | null): string {
  if (!value) return "Not reported";
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function ageLabel(seconds: number | null): string {
  if (seconds === null) return "No GPS fix reported";
  if (seconds < 60) return `reported ${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `reported ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `reported ${hours}h ${minutes % 60}m ago`;
}

function flagLabel(flag: string): string {
  return flag.replaceAll("_", " ").toLowerCase();
}

function BreakdownPanel({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: { label: string; count: number }[];
}) {
  return (
    <section aria-labelledby={`chart-${title.toLowerCase().replaceAll(" ", "-")}`} className="card min-w-0 p-5 sm:p-6">
      <h3 className="font-bold" id={`chart-${title.toLowerCase().replaceAll(" ", "-")}`}>{title}</h3>
      <p className="muted mt-1 text-xs leading-5">{description}</p>
      {items.length ? (
        <div className="monitoring-table-wrap mt-4">
          <table className="monitoring-data-table">
            <caption className="sr-only">{title} data</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th className="monitoring-count" scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.label}>
                  <th scope="row">{item.label}</th>
                  <td className="monitoring-count">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted mt-4 rounded-lg bg-[#f8f6f7] p-3 text-sm">No matching records in the selected scope.</p>
      )}
    </section>
  );
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
    <form className="mt-4 rounded-lg border border-[#dce5e1] p-3" onSubmit={submit}>
      <label className="block text-sm font-semibold" htmlFor={`decision-${checkInId}`}>Review decision</label>
      <select
        className="mt-1 w-full rounded-lg border border-[#cbd8d2] bg-white p-2 text-sm"
        id={`decision-${checkInId}`}
        onChange={(event) => setDecision(event.target.value as "VERIFIED" | "FLAGGED_FOR_REVIEW")}
        value={decision}
      >
        <option value="VERIFIED">Verify submission</option>
        <option value="FLAGGED_FOR_REVIEW">Keep flagged for review</option>
      </select>
      <label className="mt-3 block text-sm font-semibold" htmlFor={`note-${checkInId}`}>Review note (required)</label>
      <textarea
        className="mt-1 w-full rounded-lg border border-[#cbd8d2] bg-white p-2 text-sm"
        id={`note-${checkInId}`}
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

function MilestoneReview({
  label,
  checkInId,
  status,
  at,
  flags,
  geofenceStatus,
  latitude,
  longitude,
  accuracyM,
  evidenceId,
  note,
  onReviewed,
}: {
  label: string;
  checkInId: string | null;
  status: string | null;
  at: string | null;
  flags: string[];
  geofenceStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  evidenceId: string | null;
  note: string | null;
  onReviewed: () => Promise<void>;
}) {
  return (
    <section className="mt-4 border-t border-[#e6ece9] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold">{label}</h4>
        <span className="rounded-full bg-[#f0f4f2] px-2.5 py-1 text-xs font-bold">
          {status?.replaceAll("_", " ") ?? "NOT SUBMITTED"}
        </span>
      </div>
      {at ? <p className="muted mt-1 text-sm">Received {displayTime(at)}</p> : null}
      {at ? (
        <p className="muted mt-1 text-sm">
          Geofence: {geofenceStatus ?? "unknown"} · GPS accuracy: {accuracyM === null ? "unknown" : `±${Math.round(accuracyM)} m`}
          {latitude !== null && longitude !== null ? ` · ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : ""}
        </p>
      ) : null}
      {flags.length ? (
        <p className="mt-2 text-sm text-[#8a4c00]">Flags: {flags.map(flagLabel).join(", ")}</p>
      ) : null}
      {note ? <p className="mt-2 text-sm">Latest review note: {note}</p> : null}
      {evidenceId ? <EvidencePreview evidenceId={evidenceId} title={`${label} evidence`} /> : null}
      {checkInId ? (
        <ReviewForm checkInId={checkInId} currentStatus={status} onReviewed={onReviewed} />
      ) : (
        <p className="muted mt-2 text-xs">No milestone was submitted; missing required milestones remain visible for follow-up.</p>
      )}
    </section>
  );
}

function MonitorCard({
  record,
  refresh,
  detailHref,
  overdueToleranceMinutes,
}: {
  record: MonitoringRecord;
  refresh: () => Promise<void>;
  detailHref: string;
  overdueToleranceMinutes: number;
}) {
  const milestoneState = getMilestoneState(record);
  const hasCoordinates = record.lastLatitude !== null && record.lastLongitude !== null;
  const mapUrl = hasCoordinates
    ? `https://www.openstreetmap.org/?mlat=${record.lastLatitude}&mlon=${record.lastLongitude}#map=16/${record.lastLatitude}/${record.lastLongitude}`
    : null;

  return (
    <article className="card min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{record.activityTitle} · {record.collegeName ?? "College pending"}</p>
          <h3 className="mt-1 text-lg font-bold">{record.participantName}</h3>
          <p className="muted mt-1 text-sm">
            Day {record.day}, stop {record.sequence}: {record.destination}
          </p>
          <p className="muted mt-1 text-sm">
            {record.departureLocation ? `From: ${record.departureLocation} · ` : ""}Mode: {record.travelMode.replaceAll("_", " ").toLowerCase()}
          </p>
          {record.plannedArrival ? (
            <p className="muted mt-1 text-xs">
              Planned arrival {displayTime(record.plannedArrival)}
            </p>
          ) : null}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${record.overdueArrival ? "bg-red-100 text-red-800" : "bg-[#e4f2ec] text-[#245b4e]"}`}>
          {record.overdueArrival ? "OVERDUE ARRIVAL" : milestoneState.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl bg-[#f5f8f6] p-4 text-sm sm:grid-cols-2">
        <p><strong>Last reported fix:</strong> {displayTime(record.lastReportedAt)}</p>
        <p><strong>Fix age:</strong> {ageLabel(record.fixAgeSeconds)}</p>
        <p><strong>Source:</strong> {record.lastReportSource?.replaceAll("_", " ") ?? "No milestone fix"}</p>
        <p><strong>Accuracy:</strong> {record.lastAccuracyM === null ? "—" : `±${Math.round(record.lastAccuracyM)} m`}</p>
        <p><strong>GPS acquired:</strong> {displayTime(record.gpsAcquiredAt)}</p>
        <p><strong>ETA:</strong> {record.etaAt ? `${displayTime(record.etaAt)} (route estimate)` : "Unavailable"}</p>
        <p><strong>Arrival:</strong> {record.arrivalStatus?.replaceAll("_", " ") ?? "Not submitted"}</p>
        <p><strong>Check-out:</strong> {record.checkoutStatus?.replaceAll("_", " ") ?? (record.arrivalAt ? "CHECKOUT PENDING" : "Not submitted")}</p>
        <p><strong>Dwell:</strong> {record.dwellSeconds === null ? "—" : `${Math.floor(record.dwellSeconds / 60)} min${record.dwellProvisional ? " (provisional)" : ""}`}</p>
      </div>

      {mapUrl ? (
        <p className="mt-3 text-sm">
          Location: {record.lastLatitude?.toFixed(6)}, {record.lastLongitude?.toFixed(6)} ·{" "}
          <a
            className="font-semibold text-[#245b4e] underline"
            href={mapUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open last reported fix in OpenStreetMap
          </a>
          <span className="muted block text-xs">Opens only when selected; coordinates are shared with the map provider. This is not live tracking.</span>
        </p>
      ) : null}
      {record.overdueArrival ? (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900" role="status">
          No arrival was received after the scheduled time plus the configured {overdueToleranceMinutes}-minute tolerance.
        </p>
      ) : null}
      <Link
        className="mt-4 inline-block text-sm font-semibold text-[#245b4e] underline"
        href={detailHref}
      >
        Open activity monitoring
      </Link>
      <MilestoneReview
        label="Arrival evidence"
        checkInId={record.arrivalCheckInId}
        status={record.arrivalStatus}
        at={record.arrivalAt}
        flags={record.arrivalFlags}
        geofenceStatus={record.arrivalGeofenceStatus}
        latitude={record.arrivalLatitude}
        longitude={record.arrivalLongitude}
        accuracyM={record.arrivalAccuracyM}
        evidenceId={record.arrivalEvidenceId}
        note={record.arrivalReviewNote}
        onReviewed={refresh}
      />
      <MilestoneReview
        label="Check-out evidence"
        checkInId={record.checkoutCheckInId}
        status={record.checkoutStatus}
        at={record.checkoutAt}
        flags={record.checkoutFlags}
        geofenceStatus={record.checkoutGeofenceStatus}
        latitude={record.checkoutLatitude}
        longitude={record.checkoutLongitude}
        accuracyM={record.checkoutAccuracyM}
        evidenceId={record.checkoutEvidenceId}
        note={record.checkoutReviewNote}
        onReviewed={refresh}
      />
    </article>
  );
}

export function MonitoringConsole({
  initialData,
  role,
  activityId,
}: MonitoringConsoleProps) {
  const [data, setData] = useState(initialData);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(activityId ?? initialData.filters.activityId ?? "");
  const [activityStatus, setActivityStatus] = useState(initialData.filters.activityStatus ?? "");
  const [collegeId, setCollegeId] = useState(initialData.filters.collegeId ?? "");
  const [dateFrom, setDateFrom] = useState(initialData.filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialData.filters.dateTo ?? "");
  const [participantId, setParticipantId] = useState(initialData.filters.participantId ?? "");
  const [exceptionsOnly, setExceptionsOnly] = useState(initialData.filters.exceptionsOnly === "true");
  const [travelStatus, setTravelStatus] = useState(initialData.filters.travelStatus ?? "");
  const [arrivalStatus, setArrivalStatus] = useState(initialData.filters.arrivalStatus ?? "");
  const [checkoutStatus, setCheckoutStatus] = useState(initialData.filters.checkoutStatus ?? "");
  const [evidenceStatus, setEvidenceStatus] = useState(initialData.filters.evidenceStatus ?? "");
  const [includeSynthetic, setIncludeSynthetic] = useState(initialData.filters.includeSynthetic === "true");

  async function load(nextFilters: MonitoringFilters = data.filters) {
    setLoading(true);
    setErrorMessage("");
    try {
      const parameters = new URLSearchParams();
      for (const [key, value] of Object.entries(nextFilters)) {
        if (value !== undefined && value !== "") parameters.set(key, String(value));
      }
      const response = await fetch(`/api/monitoring/dashboard?${parameters}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const result = await response.json() as MonitoringDashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Monitoring data could not be loaded.");
      setData(result);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : "Monitoring data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters: MonitoringFilters = {
      ...(selectedActivityId ? { activityId: selectedActivityId } : {}),
      ...(activityStatus ? { activityStatus: activityStatus as NonNullable<MonitoringFilters["activityStatus"]> } : {}),
      ...(collegeId ? { collegeId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(participantId ? { participantId } : {}),
      ...(exceptionsOnly ? { exceptionsOnly: "true" } : {}),
      ...(travelStatus ? { travelStatus: travelStatus as NonNullable<MonitoringFilters["travelStatus"]> } : {}),
      ...(arrivalStatus ? { arrivalStatus: arrivalStatus as NonNullable<MonitoringFilters["arrivalStatus"]> } : {}),
      ...(checkoutStatus ? { checkoutStatus: checkoutStatus as NonNullable<MonitoringFilters["checkoutStatus"]> } : {}),
      ...(evidenceStatus ? { evidenceStatus: evidenceStatus as NonNullable<MonitoringFilters["evidenceStatus"]> } : {}),
      ...(includeSynthetic ? { includeSynthetic: "true" } : {}),
    };
    void load(nextFilters);
  }

  function clearFilters() {
    const fixedActivityId = activityId ?? "";
    setSelectedActivityId(fixedActivityId);
    setActivityStatus("");
    setCollegeId("");
    setDateFrom("");
    setDateTo("");
    setParticipantId("");
    setExceptionsOnly(false);
    setTravelStatus("");
    setArrivalStatus("");
    setCheckoutStatus("");
    setEvidenceStatus("");
    setIncludeSynthetic(Boolean(fixedActivityId));
    void load(fixedActivityId ? { activityId: fixedActivityId, includeSynthetic: "true" } : {});
  }

  const compliance = data.metrics.expectedMilestones
    ? `${Math.round((data.metrics.verifiedMilestones / data.metrics.expectedMilestones) * 100)}%`
    : "—";
  const breakdowns = buildMonitoringBreakdowns(data.activities, data.records, data.metrics);

  return (
    <main className="page-shell monitoring-dashboard">
      <div className="monitoring-layout">
        <aside aria-label="Monitoring navigation" className="monitoring-sidebar card">
          <Link className="brand text-lg no-underline" href="/">
            <span aria-hidden="true" className="brand-mark">OC</span>
            <span>MarSU OCATMS</span>
          </Link>
          <nav aria-label="Dashboard sections" className="monitoring-nav">
            <a className="monitoring-nav-link" href="#overview">Overview</a>
            <a className="monitoring-nav-link" href="#activity-summary">Activity summary</a>
            <a className="monitoring-nav-link" href="#filters">Filters</a>
            {!activityId ? <a className="monitoring-nav-link" href="#activity-list">Activities</a> : null}
            <a className="monitoring-nav-link" href="#participant-monitoring">Participant monitoring</a>
          </nav>
          <p className="monitoring-sidebar-note">
            {role === "DEAN" ? "College-scoped access" : "University-wide access"}
          </p>
        </aside>

        <div className="monitoring-main">
          <header className="monitoring-toolbar card">
            <div className="min-w-0">
              <p className="eyebrow">{role === "DEAN" ? "Dean monitoring" : "VPSAS monitoring"}</p>
              <h1 className="mt-1 break-words text-xl font-bold tracking-tight sm:text-2xl" id="overview">
                {activityId ? data.activities[0]?.title ?? "Activity monitoring" : "Monitoring overview"}
              </h1>
              {activityId ? (
                <Link className="mt-1 inline-block text-sm font-semibold text-[#245b4e] underline" href={`/${role === "DEAN" ? "dean" : "vpsas"}`}>
                  Back to dashboard
                </Link>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-[#f8e8a6] px-3 py-1 text-xs font-bold text-[#400020]">{role}</span>
              <SignOutButton />
            </div>
          </header>

          <p className="monitoring-scope-note">
            Locations are last-reported fixes, not live positions or proof of safety. Records shown are limited to your server-authorized scope.
          </p>
          {data.activities.some((activity) => activity.dataClassification === "SYNTHETIC_TEST") ? (
            <p className="mt-3 rounded-lg border border-[#8a4c00] bg-[#fff3d6] p-3 text-sm font-semibold text-[#5b3300]" role="status">
              Synthetic test records are included for audit review and are excluded from operational data by default.
            </p>
          ) : null}

          <section aria-label="Monitoring metrics" className="monitoring-metrics grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Active activities", data.metrics.activeActivities],
            ["Participants in transit", data.metrics.participantsInTransit],
            ["Check-in compliance", `${compliance} (${data.metrics.verifiedMilestones}/${data.metrics.expectedMilestones})`],
            ["Overdue arrivals", data.metrics.overdueArrivals],
            ["Pending reviews", data.metrics.pendingReviews],
            ["Evidence exceptions", data.metrics.evidenceExceptions],
          ].map(([label, value], index) => (
            <div className={`card flex min-w-0 flex-col justify-between p-5 ${index === 2 || index === 5 ? "bento-metric-highlight" : ""}`} key={label}>
              <p className="muted text-xs font-semibold">{label}</p>
              <p className="mt-2 break-words text-2xl font-bold sm:text-3xl">{value}</p>
            </div>
          ))}
          </section>

        <section className="card monitoring-filter-panel mt-4 min-w-0 p-5 sm:p-6" id="filters">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Refine records</p>
              <h2 className="mt-1 text-lg font-bold">Filter monitoring records</h2>
            </div>
            <p className="muted max-w-xl text-xs leading-5">
              Overdue tolerance: {data.overdueToleranceMinutes} minutes. Compliance counts due arrivals and check-outs after arrival.
            </p>
          </div>
          <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={applyFilters}>
            {role === "VPSAS" ? (
              <label className="text-sm font-semibold">
                College
                <select className="input-field mt-1" onChange={(event) => setCollegeId(event.target.value)} value={collegeId}>
                  <option value="">All colleges</option>
                  {data.availableColleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
                </select>
              </label>
            ) : null}
            <label className="text-sm font-semibold">
              Activity
              <select className="input-field mt-1" disabled={Boolean(activityId)} onChange={(event) => setSelectedActivityId(event.target.value)} value={selectedActivityId}>
                <option value="">All activities</option>
                {data.availableActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Activity status
              <select className="input-field mt-1" onChange={(event) => setActivityStatus(event.target.value)} value={activityStatus}>
                <option value="">All statuses</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Participant
              <select className="input-field mt-1" onChange={(event) => setParticipantId(event.target.value)} value={participantId}>
                <option value="">All participants</option>
                {data.availableParticipants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Travel status
              <select className="input-field mt-1" onChange={(event) => setTravelStatus(event.target.value)} value={travelStatus}>
                <option value="">All travel statuses</option>
                <option value="NOT_STARTED">Not started</option>
                <option value="IN_TRANSIT">In transit</option>
                <option value="ARRIVAL_SUBMITTED">Arrival submitted</option>
                <option value="CHECKED_IN">Checked in</option>
                <option value="CHECKOUT_SUBMITTED">Check-out submitted</option>
                <option value="CHECKED_OUT">Checked out</option>
                <option value="INTERRUPTED">Interrupted</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Arrival check-in status
              <select className="input-field mt-1" onChange={(event) => setArrivalStatus(event.target.value)} value={arrivalStatus}>
                <option value="">All arrival statuses</option>
                <option value="NOT_SUBMITTED">Not submitted</option>
                <option value="PENDING">Pending review</option>
                <option value="VERIFIED">Verified</option>
                <option value="FLAGGED_FOR_REVIEW">Flagged for review</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Check-out status
              <select className="input-field mt-1" onChange={(event) => setCheckoutStatus(event.target.value)} value={checkoutStatus}>
                <option value="">All check-out statuses</option>
                <option value="NOT_SUBMITTED">Not submitted</option>
                <option value="PENDING">Pending review</option>
                <option value="VERIFIED">Verified</option>
                <option value="FLAGGED_FOR_REVIEW">Flagged for review</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Evidence status
              <select className="input-field mt-1" onChange={(event) => setEvidenceStatus(event.target.value)} value={evidenceStatus}>
                <option value="">All evidence statuses</option>
                <option value="WITH_EVIDENCE">Evidence submitted</option>
                <option value="MISSING_EVIDENCE">Missing evidence</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              From date
              <input className="input-field mt-1 min-w-0" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
            </label>
            <label className="text-sm font-semibold">
              To date
              <input className="input-field mt-1 min-w-0" onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input checked={exceptionsOnly} onChange={(event) => setExceptionsOnly(event.target.checked)} type="checkbox" />
              Exceptions and missing milestones only
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input checked={includeSynthetic} onChange={(event) => setIncludeSynthetic(event.target.checked)} type="checkbox" />
              Include synthetic test records (audit review)
            </label>
            <button className="button-primary sm:col-span-2 lg:col-span-3" disabled={loading} type="submit">
              {loading ? "Loading…" : "Apply filters"}
            </button>
            <button className="button-secondary sm:col-span-2 lg:col-span-3" disabled={loading || (
              !selectedActivityId && !activityStatus && !collegeId && !dateFrom && !dateTo && !participantId &&
              !exceptionsOnly && !travelStatus && !arrivalStatus && !checkoutStatus && !evidenceStatus && !includeSynthetic
            )} onClick={clearFilters} type="button">
              Clear filters
            </button>
          </form>
          {errorMessage ? <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage}</p> : null}
        </section>

        <section
          aria-busy={loading}
        aria-label={data.activities.some((activity) => activity.dataClassification === "SYNTHETIC_TEST")
          ? "Operational and synthetic test overview"
          : "Operational overview"}
          className={`monitoring-overview-grid mt-4${activityId ? " monitoring-overview-grid-single" : ""}`}
        >
          {!activityId ? (
            <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="activity-list-heading" id="activity-list">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="eyebrow">Authorized records</p>
                  <h2 className="mt-1 text-xl font-bold" id="activity-list-heading">Activities</h2>
                </div>
                <span className="muted text-sm">{data.activities.length} visible</span>
              </div>
              {data.activities.length ? (
                <div className="monitoring-table-wrap">
                  <table className="monitoring-data-table">
                    <caption className="sr-only">Authorized activities and their participation and approval status</caption>
                    <thead>
                      <tr>
                        <th scope="col">Activity</th>
                        <th scope="col">Dates</th>
                        <th scope="col">College</th>
                        <th scope="col">Status</th>
                        <th scope="col">Participants</th>
                        <th scope="col">Approval</th>
                        <th scope="col">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activities.map((activity) => (
                        <tr key={activity.id}>
                          <th className="monitoring-activity-title" scope="row">{activity.title}</th>
                          <td>{activity.startDate} – {activity.endDate}</td>
                          <td>{activity.colleges.join(", ") || "College association pending"}</td>
                          <td>{activity.status}</td>
                          <td>{activity.participantCount}</td>
                          <td>{activity.approvalStatus}</td>
                          <td>
                            <Link className="font-semibold text-[#245b4e] underline" href={`/${role === "DEAN" ? "dean" : "vpsas"}/activities/${activity.id}`}>
                              Monitor
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted rounded-lg bg-[#f8f6f7] p-3 text-sm">No matching activities in the selected scope.</p>
              )}
            </section>
          ) : null}

          <div className="monitoring-overview-aside">
            <h2 className="sr-only" id="activity-summary">Activity and participant summaries</h2>
            <BreakdownPanel
              description="Authorized activities by current status."
              items={breakdowns.activityStatus}
              title="Activity status"
            />
            <BreakdownPanel
              description="Itinerary stops by current travel milestone state."
              items={breakdowns.travelProgress}
              title="Travel progress"
            />
          </div>
        </section>

        <section aria-busy={loading} aria-labelledby="activity-summary" className="monitoring-breakdowns mt-4 grid gap-4 md:grid-cols-2">
          <BreakdownPanel
            description="Activities grouped by their actual start month."
            items={breakdowns.activityTrend}
            title="Activity timeline"
          />
          <BreakdownPanel
            description="Distinct participants represented by itinerary stop records in each college."
            items={breakdowns.collegeParticipation}
            title="College participation"
          />
          <BreakdownPanel
            description="Due arrival and check-out milestones, split by verification state."
            items={breakdowns.checkInCompliance}
            title="Check-in compliance"
          />
          <BreakdownPanel
            description="Monitoring records with stored exception flags or a review flag."
            items={breakdowns.evidenceExceptions}
            title="Evidence exceptions"
          />
        </section>

        <section className="mt-7" aria-labelledby="participant-monitoring-heading" id="participant-monitoring">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">Itinerary-linked exception and milestone view</p>
              <h2 className="mt-1 text-xl font-bold" id="participant-monitoring-heading">Participant monitoring</h2>
            </div>
            <span className="muted text-sm">{data.records.length} visible stop records</span>
          </div>
          {data.records.length ? (
            <ul className="space-y-4">
              {data.records.map((record) => (
                <li key={`${record.participantId}-${record.stopId}`}>
                  <MonitorCard
                    detailHref={`/${role === "DEAN" ? "dean" : "vpsas"}/activities/${record.activityId}`}
                    overdueToleranceMinutes={data.overdueToleranceMinutes}
                    record={record}
                    refresh={() => load(data.filters)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="card p-5">
              <h3 className="font-bold">No matching itinerary monitoring records</h3>
              <p className="muted mt-2 text-sm">Records appear only for authorized, assigned participants and institution-entered active stops. Adjust the filters to search again.</p>
            </div>
          )}
        </section>
        <footer className="muted mt-8 border-t border-[#dce5e1] pt-4 text-xs leading-5">
          Monitoring reads and review decisions are audited. GPS fixes are shown with their acquisition/receipt times and may be stale or unverified.
        </footer>
        </div>
      </div>
    </main>
  );
}
