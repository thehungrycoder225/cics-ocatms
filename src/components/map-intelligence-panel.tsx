"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { MonitoringRecord } from "@/lib/monitoring";
import type { MapLocation } from "@/components/mapbox-location-map";

interface MapIntelligencePanelProps {
  records: MonitoringRecord[];
  onSelectParticipant: (record: MonitoringRecord) => void;
}

interface LocationItem {
  record: MonitoringRecord;
  coordinates: { latitude: number; longitude: number } | null;
}

const MapboxLocationMap = dynamic(
  () => import("@/components/mapbox-location-map").then((module) => module.MapboxLocationMap),
  { ssr: false, loading: () => <div className="map-intelligence-empty" role="status">Loading map…</div> },
);

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

function displayTime(value: string | null): string {
  if (!value) return "No location reported";
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function ageLabel(seconds: number | null): string {
  if (seconds === null) return "Age unavailable";
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function getLocationItems(records: MonitoringRecord[]): LocationItem[] {
  const byParticipantActivity = new Map<string, MonitoringRecord>();
  for (const record of records) {
    const key = `${record.participantId}:${record.activityId}`;
    const current = byParticipantActivity.get(key);
    if (
      !current ||
      (record.lastReportedAt !== null &&
        (current.lastReportedAt === null ||
          Date.parse(record.lastReportedAt) > Date.parse(current.lastReportedAt)))
    ) {
      byParticipantActivity.set(key, record);
    }
  }

  return [...byParticipantActivity.values()]
    .map((record) => ({
      record,
      coordinates:
        record.lastLatitude !== null &&
        record.lastLongitude !== null &&
        record.lastReportedAt !== null
          ? {
              latitude: record.lastLatitude,
              longitude: record.lastLongitude,
            }
          : null,
    }))
    .sort((left, right) =>
      left.record.participantName.localeCompare(right.record.participantName),
    );
}

export function MapIntelligencePanel({
  records,
  onSelectParticipant,
}: MapIntelligencePanelProps) {
  const [view, setView] = useState<"map" | "list">(mapboxToken ? "map" : "list");
  const [mapError, setMapError] = useState(false);
  const locations = useMemo(() => getLocationItems(records), [records]);
  const mappedLocations: MapLocation[] = locations.flatMap(({ record, coordinates }) =>
    coordinates && record.lastReportedAt
      ? [{
          record,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          reportedAt: record.lastReportedAt,
        }]
      : [],
  );
  const center = mappedLocations[0] ?? null;

  return (
    <section aria-labelledby="location-intelligence-title" className="card map-intelligence-panel">
      <header className="map-intelligence-header">
        <div>
          <h2 id="location-intelligence-title">Last-reported locations</h2>
          <p className="muted mt-1 text-sm">
            {mappedLocations.length} reported fix{mappedLocations.length === 1 ? "" : "es"}
          </p>
        </div>
        <div aria-label="Location view" className="map-intelligence-view-toggle" role="group">
          <button
            aria-pressed={view === "map"}
            className="button-secondary"
            disabled={!mapboxToken}
            onClick={() => setView("map")}
            type="button"
          >
            Map
          </button>
          <button
            aria-pressed={view === "list"}
            className="button-secondary"
            onClick={() => setView("list")}
            type="button"
          >
            List
          </button>
        </div>
      </header>

      {view === "map" && mapboxToken && center && !mapError ? (
        <MapboxLocationMap
          accessToken={mapboxToken}
          locations={mappedLocations}
          onMapError={() => setMapError(true)}
          onSelectParticipant={onSelectParticipant}
        />
      ) : view === "map" && mapboxToken && !center ? (
        <p className="map-intelligence-empty" role="status">
          No reported locations for the selected scope.
        </p>
      ) : view === "map" && mapError ? (
        <div className="map-intelligence-empty" role="alert">
          Map tiles could not be loaded. Use the location list instead.
          <button className="button-secondary ml-3" onClick={() => setView("list")} type="button">
            Open list
          </button>
        </div>
      ) : view === "map" ? (
        <p className="map-intelligence-empty" role="status">
          Map view is unavailable until a restricted public Mapbox token is configured. The authorized location list remains available.
        </p>
      ) : null}

      {view === "list" ? (
        locations.length ? (
          <ul aria-label="Authorized participant locations" className="map-intelligence-list">
            {locations.map(({ record, coordinates }) => (
              <li key={`${record.participantId}-${record.activityId}`}>
                <button
                  className="map-intelligence-list-item"
                  onClick={() => onSelectParticipant(record)}
                  type="button"
                >
                  <span className="map-intelligence-list-main">
                    <strong>{record.participantName}</strong>
                    <span>{record.activityTitle}</span>
                  </span>
                  <span className="map-intelligence-list-location">
                    <span>{displayTime(record.lastReportedAt)}</span>
                    {coordinates ? (
                      <>
                        <span>{ageLabel(record.fixAgeSeconds)}</span>
                        <span>
                          {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                          {record.lastAccuracyM === null ? "" : ` · ±${Math.round(record.lastAccuracyM)} m`}
                        </span>
                      </>
                    ) : record.lastReportedAt ? <span>Coordinates unavailable</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="map-intelligence-empty" role="status">
            No participant monitoring records in the selected scope.
          </p>
        )
      ) : null}
    </section>
  );
}
