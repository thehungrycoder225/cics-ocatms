import assert from "node:assert/strict";
import test from "node:test";
import { clusterExactCoordinates } from "../src/lib/map-location-clusters.ts";

test("clusters records at exactly equal coordinates and preserves every record", () => {
  const locations = [
    { id: "one", latitude: 14.6, longitude: 121.0 },
    { id: "two", latitude: 14.6, longitude: 121.0 },
    { id: "nearby", latitude: 14.60001, longitude: 121.0 },
  ];

  const clusters = clusterExactCoordinates(locations);

  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters[0].locations.map((location) => location.id), ["one", "two"]);
  assert.deepEqual(clusters[1].locations.map((location) => location.id), ["nearby"]);
  assert.equal(clusters.reduce((count, cluster) => count + cluster.locations.length, 0), locations.length);
});

test("treats positive and negative zero as the same coordinate", () => {
  const clusters = clusterExactCoordinates([
    { id: "positive", latitude: 0, longitude: 0 },
    { id: "negative", latitude: -0, longitude: 0 },
  ]);

  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].locations.map((location) => location.id), ["positive", "negative"]);
});
