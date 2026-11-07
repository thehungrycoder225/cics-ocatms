import assert from "node:assert/strict";
import test from "node:test";
import { getOperatorDatabaseUrl } from "../scripts/database-url.mjs";

test("operator database commands prefer the direct connection when configured", () => {
  assert.equal(
    getOperatorDatabaseUrl({
      DATABASE_URL: "postgresql://runtime.example/db",
      DIRECT_URL: "postgresql://direct.example/db",
    }),
    "postgresql://direct.example/db",
  );
});

test("operator database commands fall back to the runtime URL", () => {
  assert.equal(
    getOperatorDatabaseUrl({ DATABASE_URL: "postgresql://runtime.example/db" }),
    "postgresql://runtime.example/db",
  );
});

test("operator database commands fail explicitly without either URL", () => {
  assert.throws(
    () => getOperatorDatabaseUrl({}),
    /Set DATABASE_URL or DIRECT_URL/,
  );
});
