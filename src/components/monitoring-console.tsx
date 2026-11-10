"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ActivityTable } from "@/components/activity-table";
import { Brand } from "@/components/brand";
import { MapIntelligencePanel } from "@/components/map-intelligence-panel";
import { NotificationInbox } from "@/components/notification-inbox";
import { ParticipantDetailDrawer } from "@/components/participant-detail-drawer";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  type MonitoringDashboardData,
  type MonitoringFilters,
  type MonitoringRecord,
} from "@/lib/monitoring";
import { buildMonitoringBreakdowns } from "@/lib/monitoring-state";

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
  if (seconds === null) return "Fix age unavailable";
  if (seconds < 60) return `reported ${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `reported ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `reported ${hours}h ${minutes % 60}m ago`;
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
        <p className="muted mt-4 rounded-lg bg-[#f8f6f7] p-3 text-sm">No records for these filters.</p>
      )}
    </section>
  );
}

function MonitorCard({
  records,
  onOpen,
}: {
  records: MonitoringRecord[];
  onOpen: () => void;
}) {
  const record = [...records].sort(
    (left, right) => left.day - right.day || left.sequence - right.sequence,
  )[0];
  const latestFix = [...records]
    .filter(
      (item): item is MonitoringRecord & { lastReportedAt: string } =>
        item.lastReportedAt !== null,
    )
    .sort((left, right) => Date.parse(right.lastReportedAt) - Date.parse(left.lastReportedAt))[0];
  if (!record) return null;
  const overdueCount = records.filter((item) => item.overdueArrival).length;
  const pendingReviewCount = records.filter((item) =>
    item.arrivalStatus === "PENDING" ||
    item.arrivalStatus === "FLAGGED_FOR_REVIEW" ||
    item.checkoutStatus === "PENDING" ||
    item.checkoutStatus === "FLAGGED_FOR_REVIEW",
  ).length;

  return (
    <button className="card participant-monitoring-card" onClick={onOpen} type="button">
      <span className="participant-monitoring-main">
        <strong>{record.participantName}</strong>
        <span>{record.activityTitle}{record.collegeName ? ` · ${record.collegeName}` : ""}</span>
        <span className="muted">
          {records.length} itinerary stop{records.length === 1 ? "" : "s"} · First stop: {record.destination}
        </span>
        <span className="muted">
          Last reported: {displayTime(latestFix?.lastReportedAt ?? null)}
          {latestFix ? ` · ${ageLabel(latestFix.fixAgeSeconds)}` : ""}
        </span>
      </span>
      <span className="participant-monitoring-status">
        <span>{overdueCount} overdue arrival{overdueCount === 1 ? "" : "s"}</span>
        <span>{pendingReviewCount} pending review{pendingReviewCount === 1 ? "" : "s"}</span>
        <span className="participant-monitoring-open">Open details</span>
      </span>
    </button>
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<{
    participantId: string;
    activityId: string;
  } | null>(null);
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
    setFiltersOpen(false);
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
    setFiltersOpen(false);
  }

  function removeFilter(key: keyof MonitoringFilters) {
    const nextFilters = { ...data.filters };
    delete nextFilters[key];
    if (activityId) nextFilters.activityId = activityId;

    setSelectedActivityId(nextFilters.activityId ?? "");
    setActivityStatus(nextFilters.activityStatus ?? "");
    setCollegeId(nextFilters.collegeId ?? "");
    setDateFrom(nextFilters.dateFrom ?? "");
    setDateTo(nextFilters.dateTo ?? "");
    setParticipantId(nextFilters.participantId ?? "");
    setExceptionsOnly(nextFilters.exceptionsOnly === "true");
    setTravelStatus(nextFilters.travelStatus ?? "");
    setArrivalStatus(nextFilters.arrivalStatus ?? "");
    setCheckoutStatus(nextFilters.checkoutStatus ?? "");
    setEvidenceStatus(nextFilters.evidenceStatus ?? "");
    setIncludeSynthetic(nextFilters.includeSynthetic === "true");
    void load(nextFilters);
  }

  function toggleExceptions() {
    const nextFilters = { ...data.filters };
    if (nextFilters.exceptionsOnly === "true") {
      delete nextFilters.exceptionsOnly;
      setExceptionsOnly(false);
    } else {
      nextFilters.exceptionsOnly = "true";
      setExceptionsOnly(true);
    }
    void load(nextFilters);
  }

  const compliance = data.metrics.expectedMilestones
    ? `${Math.round((data.metrics.verifiedMilestones / data.metrics.expectedMilestones) * 100)}%`
    : "—";
  const breakdowns = buildMonitoringBreakdowns(data.activities, data.records, data.metrics);
  const recordsByParticipantActivity = new Map<string, MonitoringRecord[]>();
  for (const record of data.records) {
    const key = `${record.participantId}:${record.activityId}`;
    const group = recordsByParticipantActivity.get(key);
    if (group) group.push(record);
    else recordsByParticipantActivity.set(key, [record]);
  }
  const participantGroups = [...recordsByParticipantActivity.entries()].map(([key, records]) => ({
    key,
    records: records.sort((left, right) => left.day - right.day || left.sequence - right.sequence),
  }));
  const selectedParticipantRecords =
    participantGroups.find(({ records }) =>
      records[0]?.participantId === selectedParticipant?.participantId &&
      records[0]?.activityId === selectedParticipant?.activityId,
    )?.records ?? null;
  const activeFilters: { key: keyof MonitoringFilters; label: string; removable: boolean }[] = [];
  const addActiveFilter = (key: keyof MonitoringFilters, label: string | undefined) => {
    if (label) activeFilters.push({ key, label, removable: key !== "activityId" || !activityId });
  };
  addActiveFilter(
    "collegeId",
    role === "VPSAS" && data.filters.collegeId
      ? `College: ${data.availableColleges.find((college) => college.id === data.filters.collegeId)?.name ?? "Selected"}`
      : undefined,
  );
  addActiveFilter(
    "activityId",
    data.filters.activityId
      ? `Activity: ${data.availableActivities.find((activity) => activity.id === data.filters.activityId)?.title ?? "Selected"}`
      : undefined,
  );
  addActiveFilter(
    "activityStatus",
    data.filters.activityStatus
      ? `Activity status: ${data.filters.activityStatus.toLowerCase()}`
      : undefined,
  );
  addActiveFilter(
    "participantId",
    data.filters.participantId
      ? `Participant: ${data.availableParticipants.find((participant) => participant.id === data.filters.participantId)?.name ?? "Selected"}`
      : undefined,
  );
  addActiveFilter(
    "travelStatus",
    data.filters.travelStatus
      ? `Travel: ${data.filters.travelStatus.replaceAll("_", " ").toLowerCase()}`
      : undefined,
  );
  addActiveFilter(
    "arrivalStatus",
    data.filters.arrivalStatus
      ? `Arrival: ${data.filters.arrivalStatus.replaceAll("_", " ").toLowerCase()}`
      : undefined,
  );
  addActiveFilter(
    "checkoutStatus",
    data.filters.checkoutStatus
      ? `Check-out: ${data.filters.checkoutStatus.replaceAll("_", " ").toLowerCase()}`
      : undefined,
  );
  addActiveFilter(
    "evidenceStatus",
    data.filters.evidenceStatus
      ? `Evidence: ${data.filters.evidenceStatus === "WITH_EVIDENCE" ? "submitted" : "missing"}`
      : undefined,
  );
  addActiveFilter("dateFrom", data.filters.dateFrom ? `From: ${data.filters.dateFrom}` : undefined);
  addActiveFilter("dateTo", data.filters.dateTo ? `To: ${data.filters.dateTo}` : undefined);
  addActiveFilter(
    "exceptionsOnly",
    data.filters.exceptionsOnly === "true" ? "Exceptions only" : undefined,
  );
  addActiveFilter(
    "includeSynthetic",
    data.filters.includeSynthetic === "true" ? "Synthetic audit records" : undefined,
  );
  const hasRemovableFilters = activeFilters.some((filter) => filter.removable);

  return (
    <main className="page-shell monitoring-dashboard">
      <div className="monitoring-layout">
        <aside aria-label="Monitoring navigation" className="monitoring-sidebar card">
          <Brand href="/" />
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
              <h1 className="mt-1 break-words text-xl font-bold tracking-tight sm:text-2xl" id="overview">
                {activityId ? data.activities[0]?.title ?? "Activity monitoring" : "Overview"}
              </h1>
              {activityId ? (
                <Link className="mt-1 inline-block text-sm font-semibold text-[#245b4e] underline" href={`/${role === "DEAN" ? "dean" : "vpsas"}`}>
                  Back to dashboard
                </Link>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <NotificationInbox />
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

          <section aria-label="Monitoring metrics" className="monitoring-metrics-bento">
            <div className="card monitoring-metric-card monitoring-metric-overdue">
              <p className="monitoring-metric-label">Overdue arrivals</p>
              <p className="monitoring-metric-value">{data.metrics.overdueArrivals}</p>
              <p className="monitoring-metric-note">
                {data.metrics.overdueArrivals ? "Requires follow-up" : "No overdue arrivals"}
              </p>
            </div>
            <div className="card monitoring-metric-card monitoring-metric-activities">
              <p className="monitoring-metric-label">Active activities</p>
              <p className="monitoring-metric-value">{data.metrics.activeActivities}</p>
            </div>
            <div className="card monitoring-metric-card monitoring-metric-transit">
              <p className="monitoring-metric-label">Participants in transit</p>
              <p className="monitoring-metric-value">{data.metrics.participantsInTransit}</p>
              <p className="monitoring-metric-note">Last-reported activity data</p>
            </div>
            <div className="card monitoring-metric-card monitoring-metric-compliance">
              <p className="monitoring-metric-label">Check-in compliance</p>
              <p className="monitoring-metric-value">{compliance}</p>
              <p className="monitoring-metric-note">
                {data.metrics.verifiedMilestones}/{data.metrics.expectedMilestones} milestones verified
              </p>
            </div>
            <div className="card monitoring-metric-card monitoring-metric-secondary">
              <p className="monitoring-metric-label">Pending reviews</p>
              <p className="monitoring-metric-secondary-value">{data.metrics.pendingReviews}</p>
            </div>
            <div className="card monitoring-metric-card monitoring-metric-secondary">
              <p className="monitoring-metric-label">Evidence exceptions</p>
              <p className="monitoring-metric-secondary-value">{data.metrics.evidenceExceptions}</p>
            </div>
          </section>

          <section aria-label="Monitoring filters" className="card monitoring-filter-toolbar" id="filters">
            <div aria-label="Applied filters" aria-live="polite" className="monitoring-filter-chip-list">
              {activeFilters.length ? activeFilters.map((filter) => (
                <span className="monitoring-filter-chip" key={filter.key}>
                  {filter.label}
                  {filter.removable ? (
                    <button
                      aria-label={`Remove filter: ${filter.label}`}
                      className="monitoring-filter-chip-remove"
                      disabled={loading}
                      onClick={() => removeFilter(filter.key)}
                      type="button"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  ) : null}
                </span>
              )) : <span className="muted text-sm">No filters applied</span>}
            </div>
            <div className="monitoring-filter-actions">
              <button
                aria-pressed={data.filters.exceptionsOnly === "true"}
                className={`button-secondary${data.filters.exceptionsOnly === "true" ? " monitoring-exceptions-active" : ""}`}
                disabled={loading}
                onClick={toggleExceptions}
                type="button"
              >
                Exceptions
              </button>
              {hasRemovableFilters ? (
                <button className="button-text" disabled={loading} onClick={clearFilters} type="button">
                  Reset
                </button>
              ) : null}
              <Sheet onOpenChange={setFiltersOpen} open={filtersOpen}>
                <SheetTrigger asChild>
                  <button className="button-primary monitoring-filter-trigger" type="button">
                    Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}
                  </button>
                </SheetTrigger>
                <SheetContent className="monitoring-filter-sheet" side="right">
                  <SheetHeader className="monitoring-filter-sheet-header">
                    <SheetTitle>Filter monitoring records</SheetTitle>
                    <SheetDescription>
                      Overdue tolerance: {data.overdueToleranceMinutes} minutes. Compliance includes due arrivals and check-outs after arrival.
                    </SheetDescription>
                  </SheetHeader>
                  <form className="monitoring-filter-form" onSubmit={applyFilters}>
                    <div className="monitoring-filter-fields">
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
                      <label className="monitoring-filter-checkbox">
                        <input checked={exceptionsOnly} onChange={(event) => setExceptionsOnly(event.target.checked)} type="checkbox" />
                        Exceptions and missing milestones only
                      </label>
                      <details className="monitoring-audit-filter">
                        <summary>Audit-only records</summary>
                        <label className="monitoring-filter-checkbox mt-3">
                          <input checked={includeSynthetic} onChange={(event) => setIncludeSynthetic(event.target.checked)} type="checkbox" />
                          Include synthetic test records
                        </label>
                      </details>
                    </div>
                    <div className="monitoring-filter-form-actions">
                      <button className="button-primary" disabled={loading} type="submit">
                        {loading ? "Loading…" : "Apply filters"}
                      </button>
                      <button className="button-secondary" disabled={loading || (
                        !selectedActivityId && !activityStatus && !collegeId && !dateFrom && !dateTo && !participantId &&
                        !exceptionsOnly && !travelStatus && !arrivalStatus && !checkoutStatus && !evidenceStatus && !includeSynthetic
                      )} onClick={clearFilters} type="button">
                        Clear filters
                      </button>
                    </div>
                  </form>
                </SheetContent>
              </Sheet>
            </div>
          </section>
          {errorMessage ? <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage}</p> : null}

          <MapIntelligencePanel
            onSelectParticipant={(record) => setSelectedParticipant({
              participantId: record.participantId,
              activityId: record.activityId,
            })}
            records={data.records}
          />
          <ParticipantDetailDrawer
            onClose={() => setSelectedParticipant(null)}
            onReviewed={() => load(data.filters)}
            records={selectedParticipantRecords}
            role={role}
          />

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
                  <h2 className="mt-1 text-xl font-bold" id="activity-list-heading">Activities</h2>
                </div>
                <span className="muted text-sm">{data.activities.length} visible</span>
              </div>
                <ActivityTable activities={data.activities} role={role} />
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
              <h2 className="mt-1 text-xl font-bold" id="participant-monitoring-heading">Participant monitoring</h2>
            </div>
            <span className="muted text-sm">{participantGroups.length} participant/activity groups</span>
          </div>
          {participantGroups.length ? (
            <ul className="participant-monitoring-list">
              {participantGroups.map(({ key, records }) => (
                <li key={key}>
                  <MonitorCard
                    onOpen={() => setSelectedParticipant({
                      participantId: records[0].participantId,
                      activityId: records[0].activityId,
                    })}
                    records={records}
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
