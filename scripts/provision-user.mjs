import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hash } from "bcryptjs";
import postgres from "postgres";
import { readSecret } from "./read-secret.mjs";
import { getOperatorDatabaseUrl } from "./database-url.mjs";

const connectionString = getOperatorDatabaseUrl(process.env);
const sql = postgres(connectionString, { max: 1 });
const prompt = createInterface({ input: stdin, output: stdout });

try {
  const fullName = (await prompt.question("Full name: ")).trim();
  const email = (await prompt.question("Institutional email: ")).trim().toLowerCase();
  const username = (await prompt.question("Username (optional, 3-32 letters, numbers, '.', '_' or '-'): "))
    .trim().toLowerCase();
  const role = (await prompt.question("Primary role (PARTICIPANT, DEAN, VPSAS): ")).trim().toUpperCase();
  if (
    !fullName ||
    fullName.length > 200 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (username && !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) ||
    !["PARTICIPANT", "DEAN", "VPSAS"].includes(role)
  ) {
    throw new Error("Provide a full name, valid email, optional valid username, and one of the three primary roles.");
  }

  let collegeId = null;
  let collegeName = null;
  if (role !== "VPSAS") {
    const colleges = await sql`SELECT id, name FROM college ORDER BY name`;
    colleges.forEach((college, index) => {
      console.log(`${index + 1}. ${college.name} (${college.id})`);
    });
    collegeName = (await prompt.question("College name (existing or new): ")).trim();
    if (!collegeName || collegeName.length > 200) {
      throw new Error("A college is required for Participant and Dean accounts.");
    }
  }

  prompt.close();
  const password = await readSecret("Initial password (at least 12 characters)");
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password must be at least 12 characters and no more than 72 UTF-8 bytes.");
  }

  const passwordHash = await hash(password, 12);
  await sql.begin(async (transaction) => {
    if (collegeName) {
      const [college] = await transaction`
        INSERT INTO college (name) VALUES (${collegeName})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      collegeId = college.id;
    }

    const [canonicalParticipant] = await transaction`
      SELECT u.id
      FROM app_user u
      WHERE u.full_name = ${fullName}
        AND u.status = 'PENDING'
        AND u.email IS NULL
        AND EXISTS (
          SELECT 1
          FROM participation p
          WHERE p.user_id = u.id
            AND p.activity_id = '11000000-0000-4000-8000-000000000001'
        )
      FOR UPDATE
    `;
    const [user] = canonicalParticipant
      ? await transaction`
          UPDATE app_user
          SET email = ${email},
              username = ${username || null},
              password_hash = ${passwordHash},
              college_id = ${collegeId},
              status = 'ACTIVE',
              updated_at = now()
          WHERE id = ${canonicalParticipant.id}
          RETURNING id
        `
      : await transaction`
          INSERT INTO app_user (full_name, email, username, password_hash, college_id, status)
          VALUES (${fullName}, ${email}, ${username || null}, ${passwordHash}, ${collegeId}, 'ACTIVE')
          RETURNING id
        `;
    await transaction`
      INSERT INTO role_assignment (user_id, role, college_id)
      VALUES (${user.id}, ${role}::primary_role, ${collegeId})
    `;
    await transaction`
      INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
      VALUES (
        NULL,
        'USER_PROVISIONED',
        'app_user',
        ${user.id},
        ${JSON.stringify({ role, provisionedBy: "trusted_cli" })}::text::jsonb
      )
    `;
  });

  console.log(`Provisioned ${role} account for ${email}. Password was hashed and is not stored in plaintext.`);
} finally {
  prompt.close();
  await sql.end();
}
