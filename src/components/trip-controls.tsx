"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ParticipantStopSummary } from "@/lib/participant-journey";
import { EvidencePreview } from "@/components/evidence-preview";

interface LocationFix {
  latitude: number;
  longitude: number;
  accuracyM: number;
  gpsAcquiredAt: string;
}

interface TripControlsProps {
  initialStop: ParticipantStopSummary;
}

function getLocation(): Promise<LocationFix> {
  if (!("geolocation" in navigator)) {
    return Promise.reject(new Error("Location services are not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          gpsAcquiredAt: new Date(position.timestamp).toISOString(),
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Location permission was denied. Allow location access in your browser settings, then try again.",
          2: "Your location could not be determined. Check device location services and try again.",
          3: "Location request timed out. Move to an area with a clearer GPS signal and try again.",
        };
        reject(new Error(messages[error.code] ?? "Location could not be obtained."));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 },
    );
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function postJson(url: string, value: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    cache: "no-store",
  });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Request failed.");
  return result;
}

export function TripControls({ initialStop }: TripControlsProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stop, setStop] = useState(initialStop);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastFix, setLastFix] = useState<Pick<LocationFix, "accuracyM" | "gpsAcquiredAt"> | null>(
    initialStop.lastGpsAcquiredAt && initialStop.lastAccuracyM !== null
      ? {
          accuracyM: initialStop.lastAccuracyM,
          gpsAcquiredAt: initialStop.lastGpsAcquiredAt,
        }
      : null,
  );

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch((error: unknown) => {
        console.error("Camera preview could not start.", error);
        setErrorMessage("Camera preview could not start. Check camera permission and try again.");
      });
    }
  }, [cameraActive]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  function getActionError(error: unknown, fallback: string): string {
    if (!navigator.onLine) {
      return "You are offline. This action was not submitted; reconnect and retry. Evidence is not queued for offline upload.";
    }
    return error instanceof Error ? error.message : fallback;
  }

  async function refreshStop() {
    const response = await fetch(`/api/participant/stops/${stop.id}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = await response.json() as { stop?: ParticipantStopSummary; error?: string };
    if (!response.ok || !payload.stop) {
      throw new Error(payload.error ?? "Could not refresh the trip state.");
    }
    setStop(payload.stop);
    router.refresh();
  }

  async function startTrip() {
    setWorking(true);
    setErrorMessage("");
    setMessage("");
    try {
      const fix = await getLocation();
      const result = await postJson("/api/trips/start", {
        itineraryStopId: stop.id,
        idempotencyKey: crypto.randomUUID(),
        fix,
      });
      setLastFix(fix);
      setMessage(result.etaStatus === "AVAILABLE"
        ? "Travel started. ETA is a route estimate, not a live location."
        : "Travel started. Route ETA is unavailable; your trip remains active.");
      await refreshStop();
    } catch (error) {
      setErrorMessage(getActionError(error, "Travel could not be started."));
    } finally {
      setWorking(false);
    }
  }

  async function updateLocation() {
    if (!stop.sessionId) return;
    setWorking(true);
    setErrorMessage("");
    setMessage("");
    try {
      const fix = await getLocation();
      const result = await postJson(`/api/trips/${stop.sessionId}/location`, {
        idempotencyKey: crypto.randomUUID(),
        fix,
      });
      setLastFix(fix);
      setMessage(result.etaStatus === "AVAILABLE"
        ? "Location update received. The route ETA was refreshed from this reported fix."
        : "Location update received. Route ETA is unavailable.");
      await refreshStop();
    } catch (error) {
      setErrorMessage(getActionError(error, "Location update failed."));
    } finally {
      setWorking(false);
    }
  }

  async function openCamera() {
    setErrorMessage("");
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Camera capture is not supported in this browser. Use a current HTTPS-capable browser.");
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      setCameraActive(true);
    } catch (error) {
      console.error("OCATMS camera permission was not granted.", error);
      setErrorMessage("Camera access was unavailable or denied. Allow camera access in browser settings and retry.");
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorMessage("Camera is not ready yet. Wait for the preview, then capture again.");
      return;
    }
    setWorking(true);
    setErrorMessage("");
    try {
      const maximumUploadBytes = 3 * 1024 * 1024;
      let blob: Blob | null = null;
      for (const maximumDimension of [1600, 1400, 1200, 1000]) {
        const scale = Math.min(1, maximumDimension / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("The camera image could not be prepared. Please try again.");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.85, 0.75, 0.65]) {
          blob = await canvasToJpeg(canvas, quality);
          if (blob && blob.size <= maximumUploadBytes) break;
        }
        if (blob && blob.size <= maximumUploadBytes) break;
      }
      if (!blob || blob.size > maximumUploadBytes) {
        throw new Error("The captured photo could not be compressed to a safe upload size. Please try again.");
      }
      setPhoto(blob);
      setMessage("Camera photo captured. A visible server-time and coordinate stamp will be generated on submission.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The camera image could not be prepared.");
    } finally {
      setWorking(false);
    }
  }

  async function submitMilestone(kind: "ARRIVAL" | "CHECKOUT") {
    if (!stop.sessionId) return;
    setWorking(true);
    setErrorMessage("");
    setMessage("");
    try {
      const fix = await getLocation();
      setLastFix(fix);
      const form = new FormData();
      form.set("milestone", JSON.stringify({ idempotencyKey: crypto.randomUUID(), fix }));
      if (photo) form.set("photo", photo, `${kind.toLowerCase()}.jpg`);
      const response = await fetch(
        `/api/trips/${stop.sessionId}/check-ins/${kind === "ARRIVAL" ? "arrival" : "checkout"}`,
        { method: "POST", credentials: "same-origin", body: form, cache: "no-store" },
      );
      const result = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "Milestone submission failed.");
      }
      setPhoto(null);
      const flags = Array.isArray(result.reviewFlags) ? result.reviewFlags.join(", ") : "";
      setMessage(
        `${kind === "ARRIVAL" ? "Arrival" : "Check-out"} received at ${String(result.serverReceivedAt)}. ` +
        `Geofence: ${String(result.geofenceStatus)}. Validation: ${String(result.validationStatus)}.` +
        (flags ? ` Review flags: ${flags}.` : ""),
      );
      await refreshStop();
    } catch (error) {
      setErrorMessage(getActionError(error, "Milestone submission failed."));
    } finally {
      setWorking(false);
    }
  }

  const inTransit = stop.status === "IN_TRANSIT";
  const arrivalExists = Boolean(stop.arrivalAt);
  const checkoutExists = Boolean(stop.checkoutAt);

  return (
    <section className="card mt-6 p-5 sm:p-7" aria-labelledby="trip-controls-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Participant-controlled milestones</p>
          <h2 className="mt-1 text-xl font-bold" id="trip-controls-heading">Trip actions</h2>
        </div>
        <span className="rounded-full bg-[#e4f2ec] px-3 py-1 text-xs font-bold text-[#245b4e]">
          {stop.status.replaceAll("_", " ")}
        </span>
      </div>

      <p className="muted mt-3 text-sm leading-6">
        Location is requested only after you choose an action. This page does not track location in
        the background. Every reported fix shows its device accuracy; the server records the
        authoritative receipt time.
      </p>
      {!isOnline ? (
        <p className="mt-3 rounded-lg bg-[#fff9e9] p-3 text-sm leading-6" role="status">
          You are offline. Trip actions cannot be submitted, and evidence is not queued for offline upload.
          A captured photo remains only in this page until submitted or discarded.
        </p>
      ) : null}

      {stop.etaStatus === "AVAILABLE" && stop.etaAt ? (
        <p className="mt-3 rounded-lg bg-[#f5f8f6] p-3 text-sm">
          <strong>Estimated arrival:</strong> {new Date(stop.etaAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}{" "}
          <span className="muted">(route estimate; not a live position)</span>
        </p>
      ) : stop.sessionId && inTransit ? (
        <p className="muted mt-3 text-sm">Route ETA unavailable.</p>
      ) : null}

      {lastFix ? (
        <p className="muted mt-3 rounded-lg bg-[#f5f8f6] p-3 text-xs leading-5">
          Last submitted fix: ±{Math.round(lastFix.accuracyM)} m accuracy ·{" "}
          {new Date(lastFix.gpsAcquiredAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.
          {stop.lastLocationReceivedAt
            ? ` Received by server ${new Date(stop.lastLocationReceivedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.`
            : ""}
          {" "}This is the last reported fix, not a live location.
        </p>
      ) : null}

      {!stop.sessionId || stop.status === "NOT_STARTED" ? (
        <button className="button-primary mt-5 w-full sm:w-auto" disabled={working || !isOnline} onClick={startTrip} type="button">
          {working ? "Requesting location…" : "Start Travel"}
        </button>
      ) : null}

      {inTransit ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button className="button-primary" disabled={working || !isOnline} onClick={updateLocation} type="button">
            {working ? "Requesting location…" : "Update Location"}
          </button>
          <button
            className="min-h-11 rounded-xl border border-[#dce5e1] px-4 py-3 font-semibold"
            disabled={working || !isOnline}
            onClick={() => void submitMilestone("ARRIVAL")}
            type="button"
          >
            {working ? "Submitting…" : "Check In (Arrival)"}
          </button>
        </div>
      ) : null}

      {arrivalExists && !checkoutExists ? (
        <div className="mt-5 rounded-xl border border-[#ead8aa] bg-[#fff9e9] p-4">
          <h3 className="font-bold">Arrival submitted · check-out is still required</h3>
          <p className="muted mt-2 text-sm leading-6">
            Check Out is a separate action. It requests a fresh GPS fix and records a distinct event;
            it does not change the arrival record or automatically start another trip.
          </p>
          <button
            className="button-primary mt-4 w-full sm:w-auto"
            disabled={working || cameraActive || !isOnline}
            onClick={() => void submitMilestone("CHECKOUT")}
            type="button"
          >
            {working ? "Submitting check-out…" : "Check Out"}
          </button>
        </div>
      ) : null}

      {!checkoutExists && stop.sessionId && !photo && (inTransit || arrivalExists) ? (
        <div className="mt-5 border-t border-[#dce5e1] pt-5">
          <h3 className="font-bold">In-app photo evidence</h3>
          <p className="muted mt-1 text-sm leading-6">
            Capture a photo for this milestone. The original is retained privately; the derivative
            receives a visible server-time and GPS stamp. A stamp does not independently verify presence.
          </p>
          {!cameraActive ? (
            <button className="mt-3 min-h-11 rounded-xl border border-[#dce5e1] px-4 py-3 font-semibold" disabled={!isOnline} onClick={openCamera} type="button">
              Open camera
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <video aria-label="Live camera preview" autoPlay className="w-full rounded-xl bg-black" playsInline ref={videoRef} />
              <div className="flex flex-wrap gap-3">
                <button className="button-primary" disabled={working || !isOnline} onClick={capturePhoto} type="button">
                  {working ? "Preparing photo…" : "Capture photo"}
                </button>
                <button
                  className="min-h-11 rounded-xl border border-[#dce5e1] px-4 py-3 font-semibold"
                  onClick={() => {
                    streamRef.current?.getTracks().forEach((track) => track.stop());
                    streamRef.current = null;
                    setCameraActive(false);
                  }}
                  type="button"
                >
                  Cancel camera
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {photo ? (
        <div className="mt-5 rounded-xl bg-[#e4f2ec] p-4">
          <p className="text-sm font-bold">Photo ready ({Math.round(photo.size / 1024)} KB)</p>
          <p className="muted mt-1 text-xs">The photo is submitted with the next arrival or check-out action.</p>
          <button className="mt-2 min-h-11 text-sm font-semibold underline" onClick={() => setPhoto(null)} type="button">
            Remove captured photo
          </button>
        </div>
      ) : null}

      {checkoutExists ? (
        <p className="mt-5 rounded-lg bg-[#e4f2ec] p-3 text-sm leading-6">
          Check-out was received at{" "}
          {new Date(stop.checkoutAt ?? "").toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.
          Dwell time: {stop.dwellSeconds === null ? "pending" : `${Math.floor(stop.dwellSeconds / 60)} min`}{" "}
          {stop.dwellProvisional ? "(provisional; evidence review pending)" : ""}.
        </p>
      ) : null}
      {stop.arrivalEvidenceId ? (
        <EvidencePreview evidenceId={stop.arrivalEvidenceId} title="Arrival evidence" />
      ) : null}
      {stop.checkoutEvidenceId ? (
        <EvidencePreview evidenceId={stop.checkoutEvidenceId} title="Check-out evidence" />
      ) : null}

      {message ? <p className="mt-4 rounded-lg bg-[#e4f2ec] p-3 text-sm leading-6" role="status">{message}</p> : null}
      {errorMessage ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800" role="alert">{errorMessage}</p> : null}
      <p className="muted mt-4 text-xs leading-5">
        You may submit without a photo if capture is unavailable; that submission is flagged for
        human review. Outside-geofence and low-accuracy fixes are flagged rather than represented
        as verified.
      </p>
    </section>
  );
}
