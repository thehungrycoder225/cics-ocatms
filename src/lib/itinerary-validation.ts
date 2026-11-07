import { z } from "zod";
import { travelModes } from "./travel-mode.ts";

export function hasRequiredDepartureLocation(travelMode: string, departureLocation: string | null | undefined): boolean {
  return (travelMode !== "VAN" && travelMode !== "SHIP") || Boolean(departureLocation?.trim());
}

const fields = {
  day: z.number().int().min(1).max(31),
  sequence: z.number().int().min(1).max(100),
  destination: z.string().trim().min(1).max(300),
  departureLocation: z.string().trim().min(1).max(300).nullable().optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  geofenceRadiusM: z.number().int().min(25).max(5000),
  plannedDeparture: z.string().datetime({ offset: true }).nullable().optional(),
  plannedArrival: z.string().datetime({ offset: true }).nullable().optional(),
  travelMode: z.enum(travelModes).default("DRIVE"),
};

export const itineraryStopCreateSchema = z
  .object(fields)
  .refine((value) => hasRequiredDepartureLocation(value.travelMode, value.departureLocation), {
    message: "Departure location is required for van and ship legs.",
    path: ["departureLocation"],
  })
  .refine((value) => {
    if (!value.plannedDeparture || !value.plannedArrival) return true;
    return Date.parse(value.plannedArrival) >= Date.parse(value.plannedDeparture);
  }, {
    message: "Planned arrival must not precede planned departure.",
    path: ["plannedArrival"],
  });

export const itineraryStopUpdateSchema = z
  .object({
    day: fields.day.optional(),
    sequence: fields.sequence.optional(),
    destination: fields.destination.optional(),
    departureLocation: fields.departureLocation,
    latitude: fields.latitude.optional(),
    longitude: fields.longitude.optional(),
    geofenceRadiusM: fields.geofenceRadiusM.optional(),
    plannedDeparture: fields.plannedDeparture,
    plannedArrival: fields.plannedArrival,
    travelMode: z.enum(travelModes).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one stop field to update.")
  .refine((value) => {
    if (!value.plannedDeparture || !value.plannedArrival) return true;
    return Date.parse(value.plannedArrival) >= Date.parse(value.plannedDeparture);
  }, {
    message: "Planned arrival must not precede planned departure.",
    path: ["plannedArrival"],
  });
