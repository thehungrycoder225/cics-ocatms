"use client";

import { useMemo, useState } from "react";
import MapboxMap, { Marker, NavigationControl, Popup } from "react-map-gl";
import type { MonitoringRecord } from "@/lib/monitoring";
import { clusterExactCoordinates } from "@/lib/map-location-clusters";

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
  const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
  const clusters = useMemo(() => clusterExactCoordinates(locations), [locations]);
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
        {clusters.map((cluster) => (
          <Marker
            anchor="bottom"
            key={cluster.key}
            latitude={cluster.latitude}
            longitude={cluster.longitude}
          >
            {cluster.locations.length === 1 ? (
              <button
                aria-label={`Open ${cluster.locations[0].record.participantName}, last reported ${displayTime(cluster.locations[0].reportedAt)}`}
                className="map-intelligence-marker"
                onClick={() => onSelectParticipant(cluster.locations[0].record)}
                title={`${cluster.locations[0].record.participantName} · ${displayTime(cluster.locations[0].reportedAt)}`}
                type="button"
              >
                <span aria-hidden="true" />
              </button>
            ) : (
              <button
                aria-label={`${cluster.locations.length} records at the same recorded coordinates`}
                aria-expanded={activeClusterKey === cluster.key}
                className="map-intelligence-marker map-intelligence-marker-cluster"
                onClick={() => setActiveClusterKey(
                  activeClusterKey === cluster.key ? null : cluster.key,
                )}
                title={`${cluster.locations.length} records share these recorded coordinates`}
                type="button"
              >
                <span aria-hidden="true">{cluster.locations.length}</span>
              </button>
            )}
          </Marker>
        ))}
        {clusters.map((cluster) =>
          cluster.locations.length > 1 && activeClusterKey === cluster.key ? (
            <Popup
              key={`cluster-popup-${cluster.key}`}
              anchor="top"
              latitude={cluster.latitude}
              longitude={cluster.longitude}
              onClose={() => setActiveClusterKey(null)}
              closeOnClick={false}
              maxWidth="280px"
            >
              <ul aria-label="Records at the same recorded coordinates" className="map-intelligence-cluster-list">
                {cluster.locations.map(({ record, reportedAt }) => (
                  <li key={`${record.participantId}-${record.activityId}`}>
                    <button
                      className="map-intelligence-cluster-item"
                      onClick={() => onSelectParticipant(record)}
                      type="button"
                    >
                      <strong>{record.participantName}</strong>
                      <span>{record.activityTitle}</span>
                      <span>Last reported {displayTime(reportedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Popup>
          ) : null,
        )}
      </MapboxMap>
      <p className="map-intelligence-provider-note">
        Mapbox receives displayed coordinates to render this map. Fixes are last reported, not live locations.
      </p>
    </div>
  );
}
