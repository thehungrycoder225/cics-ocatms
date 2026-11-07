import type { TravelMode } from "./travel-mode.ts";

export interface RouteEstimate {
  etaAt: Date;
  durationSeconds: number;
  distanceMeters: number;
  provider: "mapbox-directions";
}

export interface RouteRequest {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  travelMode: TravelMode;
}

export interface RoutingProvider {
  estimate(request: RouteRequest, now?: Date): Promise<RouteEstimate | null>;
}

const profiles = {
  DRIVE: "driving",
  WALK: "walking",
  BICYCLE: "cycling",
  TWO_WHEELER: null,
  VAN: null,
  SHIP: null,
} as const satisfies Record<RouteRequest["travelMode"], string | null>;

export class MapboxDirectionsProvider implements RoutingProvider {
  private readonly accessToken: string | undefined;

  constructor(accessToken = process.env.MAPBOX_ACCESS_TOKEN) {
    this.accessToken = accessToken;
  }

  async estimate(request: RouteRequest, now?: Date): Promise<RouteEstimate | null> {
    const profile = profiles[request.travelMode];
    if (!this.accessToken || !profile) return null;

    const coordinates = `${request.origin.longitude},${request.origin.latitude};${request.destination.longitude},${request.destination.latitude}`;
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`);
    url.searchParams.set("access_token", this.accessToken);
    url.searchParams.set("overview", "false");
    url.searchParams.set("steps", "false");

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
    } catch {
      throw new Error("Mapbox Directions request failed or timed out.");
    }

    if (!response.ok) {
      throw new Error(`Mapbox Directions request failed with HTTP ${response.status}.`);
    }

    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || !("code" in payload)) {
      throw new Error("Mapbox Directions returned an invalid response.");
    }
    const result = payload as { code: unknown; routes?: unknown };
    if (result.code === "NoRoute" || result.code === "NoSegment") return null;
    if (result.code !== "Ok" || !Array.isArray(result.routes) || result.routes.length === 0) {
      throw new Error("Mapbox Directions did not return a valid route.");
    }
    const first: unknown = result.routes[0];
    if (typeof first !== "object" || first === null || !("duration" in first) || !("distance" in first)) {
      throw new Error("Mapbox Directions returned an invalid route.");
    }
    const { duration, distance } = first;
    if (
      typeof duration !== "number" || !Number.isFinite(duration) || duration < 0 ||
      typeof distance !== "number" || !Number.isFinite(distance) || distance < 0
    ) {
      throw new Error("Mapbox Directions response did not contain a valid duration and distance.");
    }

    return {
      etaAt: new Date((now?.getTime() ?? Date.now()) + duration * 1000),
      durationSeconds: duration,
      distanceMeters: Math.round(distance),
      provider: "mapbox-directions",
    };
  }
}
