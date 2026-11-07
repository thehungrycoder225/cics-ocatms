import assert from "node:assert/strict";
import test from "node:test";
import { hasRole, visibleCollegeIds, type RoleAssignment } from "../src/lib/roles.ts";

test("primary roles stay limited to Participant, Dean, and VPSAS", () => {
  const assignments: RoleAssignment[] = [
    { role: "PARTICIPANT", collegeId: "college-a" },
    { role: "DEAN", collegeId: "college-a" },
    { role: "VPSAS", collegeId: null },
  ];

  assert.equal(hasRole(assignments, "PARTICIPANT"), true);
  assert.equal(hasRole(assignments, "DEAN"), true);
  assert.equal(hasRole(assignments, "VPSAS"), true);
  assert.deepEqual(visibleCollegeIds(assignments), ["college-a"]);
});

test("VPSAS has no college-scoped dean assignment", () => {
  const assignments: RoleAssignment[] = [{ role: "VPSAS", collegeId: null }];

  assert.equal(hasRole(assignments, "VPSAS"), true);
  assert.deepEqual(visibleCollegeIds(assignments), []);
});
