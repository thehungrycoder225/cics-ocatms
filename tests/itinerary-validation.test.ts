import assert from "node:assert/strict";
import test from "node:test";
import { hasRequiredDepartureLocation, itineraryStopCreateSchema, itineraryStopUpdateSchema } from "../src/lib/itinerary-validation.ts";

const validStop = {
  day: 1,
  sequence: 1,
  destination: "Approved destination",
  latitude: 14.6,
  longitude: 121.0,
  geofenceRadiusM: 150,
  plannedDeparture: "2026-11-08T00:00:00.000Z",
  plannedArrival: "2026-11-08T02:00:00.000Z",
  travelMode: "DRIVE",
};

test("itinerary stop requires institution-entered coordinates and geofence radius", () => {
  assert.equal(itineraryStopCreateSchema.safeParse(validStop).success, true);
  assert.equal(itineraryStopCreateSchema.safeParse({ ...validStop, latitude: 91 }).success, false);
  assert.equal(itineraryStopCreateSchema.safeParse({ ...validStop, geofenceRadiusM: 10 }).success, false);
});

test("itinerary stop schedule must be chronologically valid", () => {
  assert.equal(
    itineraryStopCreateSchema.safeParse({
      ...validStop,
      plannedArrival: "2026-11-07T23:00:00.000Z",
    }).success,
    false,
  );
});

test("itinerary updates reject empty changes", () => {
  assert.equal(itineraryStopUpdateSchema.safeParse({}).success, false);
  assert.equal(itineraryStopUpdateSchema.safeParse({ destination: "Approved new destination" }).success, true);
});

test("leg details support optional departure locations and distinct van and ship modes", () => {
  for (const travelMode of ["VAN", "SHIP"]) {
    const result = itineraryStopCreateSchema.safeParse({
      ...validStop, departureLocation: "  Departure location  ", travelMode,
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.departureLocation, "Departure location");
      assert.equal(result.data.travelMode, travelMode);
    }
  }
  assert.equal(itineraryStopCreateSchema.safeParse({ ...validStop, departureLocation: "  " }).success, false);
  assert.equal(itineraryStopCreateSchema.safeParse({ ...validStop, departureLocation: "x".repeat(301) }).success, false);
  assert.equal(itineraryStopUpdateSchema.safeParse({ departureLocation: null }).success, true);
  assert.equal(itineraryStopUpdateSchema.safeParse({ travelMode: "SHIP" }).success, true);
  assert.equal(itineraryStopCreateSchema.safeParse({ ...validStop, latitude: undefined, travelMode: "SHIP" }).success, false);
  assert.equal(itineraryStopCreateSchema.safeParse({ ...validStop, travelMode: "SHIP" }).success, false);
  assert.equal(hasRequiredDepartureLocation("VAN", null), false);
  assert.equal(hasRequiredDepartureLocation("SHIP", "  "), false);
  assert.equal(hasRequiredDepartureLocation("VAN", "Lucena"), true);
  assert.equal(hasRequiredDepartureLocation("DRIVE", null), true);
});
