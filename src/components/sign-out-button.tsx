"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="button-secondary"
      onClick={() => {
        void signOut({ callbackUrl: "/login" });
      }}
      type="button"
    >
      Sign out
    </button>
  );
}
