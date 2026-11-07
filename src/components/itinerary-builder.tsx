"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { manilaInput, manilaInputToTimestamp } from "@/lib/itinerary-time";
import type { TravelMode } from "@/lib/travel-mode";

export interface BuilderStop {
  id: string;
  day: number;
  sequence: number;
  destination: string;
  departureLocation: string | null;
  latitude: number;
  longitude: number;
  geofenceRadiusM: number;
  plannedDeparture: string | null;
  plannedArrival: string | null;
  travelMode: TravelMode;
  hasTravel: boolean;
}

export function ItineraryBuilder({ activityId, stops, legDetailsAvailable }: { activityId: string; stops: BuilderStop[]; legDetailsAvailable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BuilderStop | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formKey, setFormKey] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const payload = {
      day: Number(value("day")), sequence: Number(value("sequence")), destination: value("destination"),
      ...(legDetailsAvailable ? { departureLocation: value("departureLocation") || null } : {}),
      latitude: Number(value("latitude")), longitude: Number(value("longitude")),
      geofenceRadiusM: Number(value("geofenceRadiusM")), plannedDeparture: manilaInputToTimestamp(value("plannedDeparture")),
      plannedArrival: manilaInputToTimestamp(value("plannedArrival")), travelMode: value("travelMode"),
    };
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/activities/${activityId}/itinerary${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PATCH" : "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; issues?: { message: string }[] };
      if (!response.ok) throw new Error(result.issues?.map((issue) => issue.message).join(" ") || result.error || "Stop could not be saved.");
      setEditing(null);
      setFormKey((key) => key + 1);
      setMessage("Stop saved. The activity requires approval before new travel can begin.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stop could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  async function deactivate(stop: BuilderStop) {
    if (!window.confirm(`Remove ${stop.destination} from the active itinerary? The activity will require approval again.`)) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/activities/${activityId}/itinerary/${stop.id}`, {
        method: "DELETE", credentials: "same-origin", cache: "no-store",
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Stop could not be removed.");
      if (editing?.id === stop.id) {
        setEditing(null);
        setFormKey((key) => key + 1);
      }
      setMessage("Stop removed from the active itinerary. Approval is required again.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stop could not be removed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="card p-5 sm:p-6">
        <h2 className="text-xl font-bold">{editing ? "Edit stop" : "Add stop"}</h2>
        <p className="muted mt-2 text-sm">Enter approved destination coordinates and times. Times are Philippine time (UTC+8). No values are inferred.</p>
        {!legDetailsAvailable ? <p className="muted mt-2 text-sm">Departure locations and van or ship modes are unavailable until the itinerary leg migration is applied.</p> : null}
        <form className="mt-4 grid gap-4 sm:grid-cols-2" key={formKey} onSubmit={submit}>
          <label className="text-sm font-semibold">Day<input className="input-field mt-1" defaultValue={editing?.day} max={31} min={1} name="day" required type="number" /></label>
          <label className="text-sm font-semibold">Stop sequence<input className="input-field mt-1" defaultValue={editing?.sequence} max={100} min={1} name="sequence" required type="number" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Departure location (optional)<input className="input-field mt-1" defaultValue={editing?.departureLocation ?? ""} disabled={!legDetailsAvailable} maxLength={300} name="departureLocation" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Destination<input className="input-field mt-1" defaultValue={editing?.destination} maxLength={300} name="destination" required /></label>
          <label className="text-sm font-semibold">Latitude<input className="input-field mt-1" defaultValue={editing?.latitude} max={90} min={-90} name="latitude" required step="any" type="number" /></label>
          <label className="text-sm font-semibold">Longitude<input className="input-field mt-1" defaultValue={editing?.longitude} max={180} min={-180} name="longitude" required step="any" type="number" /></label>
          <label className="text-sm font-semibold">Geofence radius (m)<input className="input-field mt-1" defaultValue={editing?.geofenceRadiusM} max={5000} min={25} name="geofenceRadiusM" required type="number" /></label>
          <label className="text-sm font-semibold">Travel mode<select className="input-field mt-1" defaultValue={editing?.travelMode ?? ""} name="travelMode" required><option value="" disabled>Select travel mode</option><option value="DRIVE">Drive</option><option value="WALK">Walk</option><option value="BICYCLE">Bicycle</option><option value="TWO_WHEELER">Two-wheeler</option><option value="VAN" disabled={!legDetailsAvailable}>Van</option><option value="SHIP" disabled={!legDetailsAvailable}>Ship</option></select></label>
          <p className="muted text-sm sm:col-span-2">Van and ship legs require a departure location. Their ETA is unavailable until a suitable routing profile is validated.</p>
          <label className="text-sm font-semibold">Planned departure (optional)<input className="input-field mt-1" defaultValue={manilaInput(editing?.plannedDeparture ?? null)} name="plannedDeparture" step="0.001" type="datetime-local" /></label>
          <label className="text-sm font-semibold">Planned arrival (optional)<input className="input-field mt-1" defaultValue={manilaInput(editing?.plannedArrival ?? null)} name="plannedArrival" step="0.001" type="datetime-local" /></label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button className="button-primary" disabled={working} type="submit">{working ? "Saving…" : editing ? "Save changes" : "Add stop"}</button>
            {editing ? <button className="button-secondary" disabled={working} onClick={() => { setEditing(null); setFormKey((key) => key + 1); }} type="button">Cancel edit</button> : null}
          </div>
        </form>
        {error ? <p className="mt-4 text-sm text-red-800" role="alert">{error}</p> : null}
        {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
      </section>
      <section aria-labelledby="builder-stops">
        <h2 className="text-xl font-bold" id="builder-stops">Active stops</h2>
        {stops.length === 0 ? <p className="muted mt-3">No stops have been added.</p> : (
          <ol className="mt-3 space-y-3">
            {stops.map((stop) => <li className="card p-5" key={stop.id}>
              <p className="eyebrow">Day {stop.day} · Stop {stop.sequence}</p>
              <h3 className="mt-1 font-bold">{stop.destination}</h3>
              {stop.departureLocation ? <p className="muted mt-1 text-sm">From: {stop.departureLocation}</p> : null}
              <p className="muted mt-2 text-sm">{stop.latitude}, {stop.longitude} · {stop.geofenceRadiusM} m · {stop.travelMode.replaceAll("_", " ")}</p>
              <p className="muted mt-1 text-sm">Departure: {manilaInput(stop.plannedDeparture).replace("T", " ") || "Not scheduled"} · Arrival: {manilaInput(stop.plannedArrival).replace("T", " ") || "Not scheduled"} (Philippine time)</p>
              {stop.hasTravel ? <p className="muted mt-2 text-sm">Travel history exists; this stop cannot be changed or removed.</p> : <div className="mt-3 flex flex-wrap gap-2"><button className="button-secondary" disabled={working} onClick={() => { setEditing(stop); setFormKey((key) => key + 1); setError(""); setMessage(""); }} type="button">Edit</button><button className="button-secondary" disabled={working} onClick={() => void deactivate(stop)} type="button">Remove</button></div>}
            </li>)}
          </ol>
        )}
      </section>
    </div>
  );
}
