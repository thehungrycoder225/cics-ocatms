import assert from "node:assert/strict";
import test from "node:test";
import { loginIdentifierSchema } from "../src/lib/login-identifier.ts";

test("login identifiers accept and normalize usernames and existing emails", () => {
  assert.equal(loginIdentifierSchema.parse("  Dean.Test  "), "dean.test");
  assert.equal(loginIdentifierSchema.parse(" USER@EXAMPLE.ORG "), "user@example.org");
  assert.equal(loginIdentifierSchema.parse("participant_01"), "participant_01");
});

test("invalid or ambiguous login identifiers are rejected", () => {
  for (const value of ["", "ab", "bad name", "bad@name", "-invalid", "x".repeat(33)]) {
    assert.equal(loginIdentifierSchema.safeParse(value).success, false, value);
  }
});
