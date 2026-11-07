export const travelModes = ["DRIVE", "WALK", "BICYCLE", "TWO_WHEELER", "VAN", "SHIP"] as const;

export type TravelMode = (typeof travelModes)[number];
