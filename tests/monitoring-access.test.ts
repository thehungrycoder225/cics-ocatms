import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedIdentity } from "../src/lib/authorization.ts";
import { canMonitorParticipant, getMonitoringAccess, hasMonitoringRole } from "../src/lib/monitoring-access.ts";

const collegeA = "10000000-0000-4000-8000-000000000001";
const collegeB = "10000000-0000-4000-8000-000000000002";
const participantId = "20000000-0000-4000-8000-000000000001";

function identity(
  assignments: AuthenticatedIdentity["assignments"],
  id = "30000000-0000-4000-8000-000000000001",
): AuthenticatedIdentity {
  return {
    id,
    fullName: "Test Reviewer",
    email: null,
    collegeId: null,
    assignments,
  };
}

test("Dean monitoring requires the participant and activity to share the assigned college", () => {
  const dean = identity([{ role: "DEAN", collegeId: collegeA }]);
  assert.equal(canMonitorParticipant(dean, participantId, collegeA, [collegeA]), true);
  assert.equal(canMonitorParticipant(dean, participantId, collegeB, [collegeA, collegeB]), false);
  assert.equal(canMonitorParticipant(dean, participantId, collegeA, [collegeB]), false);
  assert.equal(hasMonitoringRole(dean), true);
});

test("VPSAS is university-wide while participants can access only their own records", () => {
  const vpsas = identity([{ role: "VPSAS", collegeId: null }]);
  assert.equal(canMonitorParticipant(vpsas, participantId, collegeB, [collegeA]), true);

  const participant = identity([{ role: "PARTICIPANT", collegeId: collegeA }], participantId);
  assert.equal(canMonitorParticipant(participant, participantId, collegeA, [collegeA]), true);
  assert.equal(canMonitorParticipant(participant, "40000000-0000-4000-8000-000000000001", collegeA, [collegeA]), false);
  assert.equal(hasMonitoringRole(participant), false);

  const access = getMonitoringAccess(vpsas);
  assert.equal(access.isVpsas, true);
  assert.deepEqual(access.deanCollegeIds, []);
});
