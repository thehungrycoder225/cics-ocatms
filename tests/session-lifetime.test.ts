import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SESSION_SECONDS, REMEMBERED_SESSION_SECONDS, isSessionWithinDeadline, sessionDeadline } from "../src/lib/session-lifetime.ts";

test("session deadlines are absolute for ordinary and remembered sessions", () => {
  const start = 1_000_000;
  for (const [remember, duration] of [[false, DEFAULT_SESSION_SECONDS], [true, REMEMBERED_SESSION_SECONDS]] as const) {
    const deadline = sessionDeadline(start, remember);
    assert.equal(deadline, start + duration);
    assert.equal(isSessionWithinDeadline({ sessionDeadline: deadline }, deadline - 1), true);
    assert.equal(isSessionWithinDeadline({ sessionDeadline: deadline }, deadline), false);
  }
});

test("existing sessions keep the prior eight-hour limit", () => {
  assert.equal(isSessionWithinDeadline({ iat: 100 }, 100 + DEFAULT_SESSION_SECONDS - 1), true);
  assert.equal(isSessionWithinDeadline({ iat: 100 }, 100 + DEFAULT_SESSION_SECONDS), false);
  assert.equal(isSessionWithinDeadline({}, 100), false);
});
