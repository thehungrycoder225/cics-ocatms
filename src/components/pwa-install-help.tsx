"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallHelp() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkInstalled = () =>
      setInstalled(
        window.matchMedia("(display-mode: standalone)").matches ||
          ("standalone" in navigator && navigator.standalone === true),
      );
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("OCATMS was added to your home screen.");
    };

    checkInstalled();
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setMessage(
        choice.outcome === "accepted"
          ? "Follow your browser's instructions to finish installing OCATMS."
          : "Installation was dismissed. You can use the browser menu to install OCATMS later.",
      );
    } catch {
      setMessage("The install prompt could not open. Use your browser menu to install OCATMS.");
    } finally {
      setInstallPrompt(null);
    }
  }

  return (
    <section aria-labelledby="install-heading" className="mt-8 max-w-3xl rounded-xl border border-[#dce5e1] bg-[#f5f8f6] p-5">
      <h2 className="text-lg font-bold" id="install-heading">Install the app</h2>
      <p className="muted mt-2 leading-6">
        On Android, use the browser menu and choose <strong>Install app</strong> or{" "}
        <strong>Add to Home screen</strong>. On iPhone or iPad, open this page in Safari, tap{" "}
        <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Menu labels vary by browser.
      </p>
      {installPrompt && !installed && (
        <button className="button-primary mt-4" onClick={installApp} type="button">
          Install OCATMS
        </button>
      )}
      {installed && <p className="mt-3 font-semibold">OCATMS is installed on this device.</p>}
      {message && <p aria-live="polite" className="mt-3" role="status">{message}</p>}
      <p className="muted mt-3 text-sm">
        Installation does not enable offline travel submissions or background location tracking.
      </p>
    </section>
  );
}
