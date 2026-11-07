"use client";

import { signIn } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import { useState, type FormEvent } from "react";

export function SignInForm() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reducedMotion = useReducedMotion();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        identifier: formData.get("identifier"),
        password: formData.get("password"),
        rememberMe: formData.has("rememberMe") ? "true" : "false",
        redirect: false,
        callbackUrl: "/",
      });

      if (result?.error) {
        setErrorMessage("Sign-in failed. Check your account details or contact your administrator.");
        return;
      }
      window.location.assign(result?.url ?? "/");
    } catch (error) {
      console.error("OCATMS sign-in request failed.", error);
      setErrorMessage("Sign-in failed. Check your account details or contact your administrator.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-7 space-y-5" method="post" onSubmit={submit}>
      <noscript>
        <p className="text-sm text-red-800" role="alert">JavaScript is required to sign in.</p>
      </noscript>
      <label className="block space-y-2 text-sm font-semibold" htmlFor="identifier">
        Username or email
        <input
          autoComplete="username"
          className="input-field"
          id="identifier"
          maxLength={254}
          name="identifier"
          required
          type="text"
        />
      </label>
      <label className="block space-y-2 text-sm font-semibold" htmlFor="password">
        Password
        <input
          autoComplete="current-password"
          className="input-field"
          id="password"
          maxLength={72}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input className="mt-1 h-5 w-5 accent-[var(--primary)]" name="rememberMe" type="checkbox" />
        <span>Keep me signed in for 30 days on this device. Use only on a trusted device.</span>
      </label>
      {errorMessage ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <motion.button
        className="button-primary w-full"
        disabled={isSubmitting}
        transition={{ duration: 0.14 }}
        type="submit"
        whileTap={reducedMotion === false ? { scale: 0.98 } : undefined}
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </motion.button>
    </form>
  );
}
