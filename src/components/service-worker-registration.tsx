"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("OCATMS service worker registration failed.", error);
    });
  }, []);

  return null;
}
