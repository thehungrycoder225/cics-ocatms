import assert from "node:assert/strict";
import test from "node:test";
import { hasActivityPermission } from "../src/lib/activity-permissions.ts";
import type { AuthenticatedIdentity } from "../src/lib/authorization.ts";
import type { ActivityPermissionGrant } from "../src/lib/activity-permissions-types.ts";

const dean: AuthenticatedIdentity = {
  id: "user-1",
  fullName: "Dean",
  email: "dean@example.invalid",
  collegeId: "college-a",
  assignments: [{ role: "DEAN", collegeId: "college-a" }],
};

const editGrant: ActivityPermissionGrant = {
  permission: "ACTIVITY_EDIT",
  activityId: null,
  collegeId: "college-a",
};

test("editing permission is scoped to its college and cannot approve", () => {
  assert.equal(hasActivityPermission(dean, "ACTIVITY_EDIT", [editGrant], null, ["college-a"]), true);
  assert.equal(hasActivityPermission(dean, "ACTIVITY_APPROVE", [editGrant], null, ["college-a"]), false);
  assert.equal(hasActivityPermission(dean, "ACTIVITY_EDIT", [editGrant], null, ["college-b"]), false);
  assert.equal(
    hasActivityPermission(dean, "ACTIVITY_EDIT", [editGrant], null, ["college-a", "college-b"]),
    false,
  );
});

test("participant cannot manage activities even with a scoped grant", () => {
  const participant: AuthenticatedIdentity = {
    ...dean,
    assignments: [{ role: "PARTICIPANT", collegeId: "college-a" }],
  };
  assert.equal(hasActivityPermission(participant, "ACTIVITY_EDIT", [editGrant], null, ["college-a"]), false);
});

test("an activity-scoped grant is limited to that activity", () => {
  const approvalGrant: ActivityPermissionGrant = {
    permission: "ACTIVITY_APPROVE",
    activityId: "activity-a",
    collegeId: null,
  };
  assert.equal(
    hasActivityPermission(dean, "ACTIVITY_APPROVE", [approvalGrant], "activity-a", []),
    true,
  );
  assert.equal(
    hasActivityPermission(dean, "ACTIVITY_APPROVE", [approvalGrant], "activity-b", []),
    false,
  );
});
