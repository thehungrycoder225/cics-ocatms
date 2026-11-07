import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { decode as decodeJwt } from "next-auth/jwt";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { loginIdentifierSchema } from "@/lib/login-identifier";
import { isSessionWithinDeadline, REMEMBERED_SESSION_SECONDS, sessionDeadline } from "@/lib/session-lifetime";

const credentialsSchema = z.object({
  identifier: loginIdentifierSchema,
  password: z.string().min(1).max(72),
});

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: REMEMBERED_SESSION_SECONDS,
  },
  jwt: {
    async decode(params) {
      const token = await decodeJwt(params);
      return token && isSessionWithinDeadline(token, Math.floor(Date.now() / 1000)) ? token : null;
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Institutional account",
      credentials: {
        identifier: { label: "Username or email", type: "text" },
        email: { label: "Email (legacy)", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Keep me signed in", type: "text" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse({
          identifier: rawCredentials?.identifier ?? rawCredentials?.email,
          password: rawCredentials?.password,
        });
        if (!parsed.success) {
          return null;
        }

        const db = getDb();
        const [user] = await db<
          { id: string; full_name: string; email: string | null; password_hash: string | null }[]
        >`
          SELECT id, full_name, email, password_hash
          FROM app_user
          WHERE (username = ${parsed.data.identifier} OR lower(email) = ${parsed.data.identifier})
            AND status = 'ACTIVE'
            AND (account_expires_at IS NULL OR account_expires_at > now())
          LIMIT 1
        `;
        const forwardedFor = request.headers?.["x-forwarded-for"];
        const clientAddress =
          typeof forwardedFor === "string"
            ? forwardedFor.split(",").at(-1)?.trim() || "unknown"
            : "unknown";
        const accountNetworkKey = createHash("sha256")
          .update(`${user ? `user:${user.id}` : `identifier:${parsed.data.identifier}`}\0${clientAddress}`)
          .digest("hex");
        const networkKey = createHash("sha256").update(`network\0${clientAddress}`).digest("hex");
        const attemptKeys = [accountNetworkKey, networkKey];
        const attemptCounts = await db.begin(async (transaction) => {
          await transaction`
            DELETE FROM auth_login_window
            WHERE updated_at < now() - interval '24 hours'
          `;

          const counts: number[] = [];
          for (const attemptKey of attemptKeys) {
            const [attempt] = await transaction<{ attempt_count: number }[]>`
              INSERT INTO auth_login_window (attempt_key, window_started_at, attempt_count, updated_at)
              VALUES (${attemptKey}, now(), 1, now())
              ON CONFLICT (attempt_key) DO UPDATE SET
                window_started_at = CASE
                  WHEN auth_login_window.window_started_at < now() - interval '15 minutes' THEN now()
                  ELSE auth_login_window.window_started_at
                END,
                attempt_count = CASE
                  WHEN auth_login_window.window_started_at < now() - interval '15 minutes' THEN 1
                  ELSE auth_login_window.attempt_count + 1
                END,
                updated_at = now()
              RETURNING attempt_count
            `;
            counts.push(attempt.attempt_count);
          }
          return counts;
        });
        if (attemptCounts.some((count) => count > 10)) {
          return null;
        }

        if (!user?.password_hash || !(await compare(parsed.data.password, user.password_hash))) {
          return null;
        }

        await db`
          DELETE FROM auth_login_window
          WHERE attempt_key = ${accountNetworkKey} OR attempt_key = ${networkKey}
        `;
        await db`
          INSERT INTO audit_log (actor_id, action, resource_type, resource_id, details)
          VALUES (
            ${user.id},
            'AUTHENTICATION_SUCCESS',
            'app_user',
            ${user.id},
            '{"method":"credentials"}'::jsonb
          )
        `;

        return {
          id: user.id,
          name: user.full_name,
          email: user.email,
          rememberMe: rawCredentials?.rememberMe === "true",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sessionDeadline = sessionDeadline(Math.floor(Date.now() / 1000), user.rememberMe === true);
      } else if (typeof token.sessionDeadline !== "number" && typeof token.iat === "number") {
        token.sessionDeadline = sessionDeadline(token.iat, false);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (typeof token.sessionDeadline === "number") {
        session.expires = new Date(token.sessionDeadline * 1000).toISOString();
      }
      return session;
    },
  },
};
