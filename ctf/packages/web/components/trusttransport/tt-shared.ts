// Shared constants, types, and helpers for the TrustTransport web shell.
// Palette/layout derive from design/.../survivor-hub/TrustTransport.tsx.
import { Car, Package, Utensils } from "lucide-react";

export const COLOR = "#F97316";
export const BG = "#0F1117";

export interface Mode {
  id: string;
  name: string;
}

export interface TripRequest {
  id: string;
  mode?: string;
  fromLocation?: string;
  toLocation?: string;
  status?: string;
  createdAt?: string;
}

export interface ChatCreds {
  ok: boolean;
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId?: string;
  message?: string;
}

export type Tab = "book" | "tracking" | "chat";

export interface RideType {
  id: string;
  name: string;
  icon: React.ElementType;
  desc: string;
  color: string;
}

export const STATIC_RIDE_TYPES: RideType[] = [
  { id: "ride", name: "Ride", icon: Car, desc: "Safe passenger transport", color: COLOR },
  { id: "package", name: "Package", icon: Package, desc: "Item delivery", color: "#3B82F6" },
  { id: "food", name: "Food", icon: Utensils, desc: "Meal delivery", color: "#22C55E" },
];

// Map server-provided modes onto the design's ride-type cards, falling back to
// a generic card for modes the design doesn't enumerate.
export function deriveRideTypes(modes: Mode[]): RideType[] {
  if (modes.length === 0) return STATIC_RIDE_TYPES;
  return modes.map((m) => {
    const match = STATIC_RIDE_TYPES.find((rt) => rt.id === m.id || rt.name.toLowerCase() === m.name.toLowerCase());
    return match ?? { id: m.id, name: m.name, icon: Car, desc: m.name, color: COLOR };
  });
}

export function rideTypeName(rideTypes: RideType[], id: string): string {
  return rideTypes.find((r) => r.id === id)?.name ?? "Ride";
}
