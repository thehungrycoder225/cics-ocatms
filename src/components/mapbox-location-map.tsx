"use client";

import MapboxMap, { Marker, NavigationControl } from "react-map-gl";
import type { MonitoringRecord } from "@/lib/monitoring";

export interface MapLocation {
  record: MonitoringRecord;
  latitude: number;
  longitude: number;
  reportedAt: string;
}

interface MapboxLocationMapProps {
  locations: MapLocation[];
  accessToken: string;
  onSelectParticipant: (record: MonitoringRecord) => void;
  onMapError: () => void;
}

function displayTime(value: string): string {
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

export function MapboxLocationMap({
  locations,
  accessToken,
  onSelectParticipant,
  onMapError,
}: MapboxLocationMapProps) {
  const center = locations[0];
  if (!center) return null;
  const latitudes = locations.map((location) => location.latitude);
  const longitudes = locations.map((location) => location.longitude);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const hasDistinctLocations = south !== north || west !== east;
  const bounds: [[number, number], [number, number]] = [[west, south], [east, north]];
  const initialViewState = hasDistinctLocations
    ? {
        bounds,
        fitBoundsOptions: { padding: 48, maxZoom: 10 },
      }
    : { latitude: center.latitude, longitude: center.longitude, zoom: 9 };

  return (
    <div className="map-intelligence-canvas">
      <MapboxMap
        mapboxAccessToken={accessToken}
        mapStyle="mapbox://styles/mapbox/light-v11"
        initialViewState={initialViewState}
        onError={onMapError}
        reuseMaps
      >
        <NavigationControl position="top-right" />
        {locations.map(({ record, latitude, longitude, reportedAt }) => (
          <Marker
            anchor="bottom"
            key={`${record.participantId}-${record.activityId}`}
            latitude={latitude}
            longitude={longitude}
          >
            <button
              aria-label={`Open ${record.participantName}, last reported ${displayTime(reportedAt)}`}
              className="map-intelligence-marker"
              onClick={() => onSelectParticipant(record)}
              title={`${record.participantName} · ${displayTime(reportedAt)}`}
              type="button"
            >
              <span aria-hidden="true" />
            </button>
          </Marker>
        ))}
      </MapboxMap>
      <p className="map-intelligence-provider-note">
        Mapbox receives displayed coordinates to render this map. Fixes are last reported, not live locations.
      </p>
    </div>
  );
}
