import assert from "node:assert/strict";
import test from "node:test";
import { MapboxDirectionsProvider, type RouteRequest } from "../src/lib/routing.ts";

const request: RouteRequest = {
  origin: { latitude: 14.6, longitude: 121.0 },
  destination: { latitude: 14.7, longitude: 121.1 },
  travelMode: "DRIVE",
};

test("missing token and unsupported modes return unavailable without a request", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("unexpected request"); };
  try {
    assert.equal(await new MapboxDirectionsProvider("").estimate(request), null);
    for (const travelMode of ["TWO_WHEELER", "VAN", "SHIP"] as const) {
      assert.equal(await new MapboxDirectionsProvider("test-token").estimate({
        ...request, travelMode,
      }), null);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Mapbox profiles, coordinates, duration and distance produce provider-backed ETAs", async () => {
  const originalFetch = globalThis.fetch;
  let actualUrl: URL | undefined;
  globalThis.fetch = async (input, init) => {
    actualUrl = new URL(String(input));
    assert.equal(init?.cache, "no-store");
    return new Response(JSON.stringify({
      code: "Ok", routes: [{ duration: 120.5, distance: 1234.6 }],
    }), { status: 200 });
  };
  try {
    for (const [mode, profile] of [["DRIVE", "driving"], ["WALK", "walking"], ["BICYCLE", "cycling"]] as const) {
      const estimate = await new MapboxDirectionsProvider("test-token").estimate(
        { ...request, travelMode: mode },
        new Date("2026-11-07T12:00:00.000Z"),
      );
      assert.equal(actualUrl?.pathname, `/directions/v5/mapbox/${profile}/121,14.6;121.1,14.7`);
      assert.equal(actualUrl?.searchParams.get("access_token"), "test-token");
      assert.equal(actualUrl?.searchParams.get("overview"), "false");
      assert.equal(estimate?.etaAt.toISOString(), "2026-11-07T12:02:00.500Z");
      assert.equal(estimate?.distanceMeters, 1235);
      assert.equal(estimate?.provider, "mapbox-directions");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("no route is unavailable; invalid payloads and HTTP errors surface safely", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ code: "NoRoute", routes: [] });
    assert.equal(await new MapboxDirectionsProvider("test-token").estimate(request), null);
    globalThis.fetch = async () => Response.json({ code: "Ok", routes: [{ duration: -1, distance: 10 }] });
    await assert.rejects(new MapboxDirectionsProvider("test-token").estimate(request), /valid duration and distance/);
    globalThis.fetch = async () => new Response("test-token", { status: 401 });
    await assert.rejects(new MapboxDirectionsProvider("test-token").estimate(request), (error: Error) =>
      error.message.includes("HTTP 401") && !error.message.includes("test-token"));
    globalThis.fetch = async () => { throw new Error("sensitive test-token"); };
    await assert.rejects(new MapboxDirectionsProvider("test-token").estimate(request), (error: Error) =>
      !error.message.includes("test-token"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
