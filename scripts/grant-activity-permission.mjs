import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { compare } from "bcryptjs";
import postgres from "postgres";
import { readSecret } from "./read-secret.mjs";
import { getOperatorDatabaseUrl } from "./database-url.mjs";

const connectionString = getOperatorDatabaseUrl(process.env);
const sql = postgres(connectionString, { max: 1 });
let prompt = createInterface({ input: stdin, output: stdout });

try {
  const grantorIdentifier = (await prompt.question("Active VPSAS operator username or email: ")).trim().toLowerCase();
  prompt.close();

  const [grantor] = await sql`
    SELECT u.id, u.password_hash
    FROM app_user u
    JOIN role_assignment r ON r.user_id = u.id AND r.role = 'VPSAS'
    WHERE (u.username = ${grantorIdentifier} OR lower(u.email) = ${grantorIdentifier}) AND u.status = 'ACTIVE'
      AND (u.account_expires_at IS NULL OR u.account_expires_at > now())
    LIMIT 1
  `;
  if (!grantor?.password_hash) {
    throw new Error("The operator must be an active VPSAS account.");
  }
  const grantorPassword = await readSecret("VPSAS operator password");
  if (!(await compare(grantorPassword, grantor.password_hash))) {
    throw new Error("VPSAS operator authentication failed.");
  }

  prompt = createInterface({ input: stdin, output: stdout });
  const granteeIdentifier = (await prompt.question("Grantee username or email: ")).trim().toLowerCase();
  const permission = (await prompt.question("Permission (ACTIVITY_EDIT, ACTIVITY_APPROVE): "))
    .trim()
    .toUpperCase();
  const scopeType = (await prompt.question("Scope type (COLLEGE, ACTIVITY): ")).trim().toUpperCase();
  if (!["ACTIVITY_EDIT", "ACTIVITY_APPROVE"].includes(permission)) {
    throw new Error("Choose ACTIVITY_EDIT or ACTIVITY_APPROVE.");
  }
  if (!["COLLEGE", "ACTIVITY"].includes(scopeType)) {
    throw new Error("Choose COLLEGE or ACTIVITY scope.");
  }

  const [grantee] = await sql`
    SELECT u.id
    FROM app_user u
    WHERE (u.username = ${granteeIdentifier} OR lower(u.email) = ${granteeIdentifier})
      AND u.status = 'ACTIVE'
      AND (u.account_expires_at IS NULL OR u.account_expires_at > now())
      AND EXISTS (
        SELECT 1
        FROM role_assignment r
        WHERE r.user_id = u.id AND r.role IN ('DEAN', 'VPSAS')
      )
    LIMIT 1
  `;
  if (!grantee) {
    throw new Error("The grantee must be an active Dean or VPSAS account.");
  }

  let collegeId = null;
  let activityId = null;
  if (scopeType === "COLLEGE") {
    const colleges = await sql`SELECT id, name FROM college ORDER BY name`;
    colleges.forEach((college) => console.log(`${college.name} (${college.id})`));
    collegeId = (await prompt.question("College UUID: ")).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(collegeId)) {
      throw new Error("Enter a valid college UUID.");
    }
    const [college] = await sql`SELECT id FROM college WHERE id = ${collegeId}::uuid`;
    if (!college) {
      throw new Error("Choose an existing college UUID.");
    }
  } else {
    const activities = await sql`SELECT id, title FROM activity ORDER BY start_date DESC`;
    activities.forEach((activity) => console.log(`${activity.title} (${activity.id})`));
    activityId = (await prompt.question("Activity UUID: ")).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(activityId)) {
      throw new Error("Enter a valid activity UUID.");
    }
    const [activity] = await sql`SELECT id FROM activity WHERE id = ${activityId}::uuid`;
    if (!activity) {
      throw new Error("Choose an existing activity UUID.");
    }
  }

  const [createdGrant] = await sql.begin(async (transaction) => {
    const [grant] = await transaction`
      INSERT INTO activity_permission_assignment (
        user_id, permission, activity_id, college_id, granted_by
      )
      VALUES (
        ${grantee.id},
        ${permission}::activity_permission,
        ${activityId}::uuid,
        ${collegeId}::uuid,
        ${grantor.id}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (grant) {
      await transaction`
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
        VALUES (
          ${grantor.id},
          'ACTIVITY_PERMISSION_GRANTED',
          'activity_permission_assignment',
          ${grant.id},
          ${JSON.stringify({ permission, scopeType })}::text::jsonb
        )
      `;
    }
    return [grant];
  });

  console.log(
    createdGrant
      ? `${permission} granted to ${granteeIdentifier} at ${scopeType} scope.`
      : `That ${permission} grant already exists for ${granteeIdentifier} at ${scopeType} scope.`,
  );
} finally {
  prompt.close();
  await sql.end();
}
