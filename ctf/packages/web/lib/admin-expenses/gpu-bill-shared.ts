// What /admin/expenses knows about the RunPod drafting bill. Import-safe from a client component.
//
// The bill is read from RunPod (lib/admin-expenses/gpu-bill.ts). When it has been read, its last 30
// full days replace whatever figure was typed on the RunPod line; when it has not, the typed figure
// stands and the screen says why the bill is not being read.

export type GpuBillDay = {
  billDate: string;
  amountCents: number;
  // false while RunPod may still add to the day (today, and yesterday until a few hours after it ended).
  settled: boolean;
};

export type GpuBillState = {
  // Why the bill is not being read, in plain words; null when it is.
  unavailableReason: string | null;
  endpointIds: string[];
  lastReadAt: string | null;
  // The 30 full days before today, every endpoint added together. null until the first read.
  last30DaysCents: number | null;
  last30DaysFrom: string | null;
  last30DaysTo: string | null;
  // Today so far (UTC). Still growing, so it is never part of the monthly figure.
  todayCents: number | null;
  // Newest first, at most 7.
  recentDays: GpuBillDay[];
};

// A provider name that means the RunPod line, however it was typed ("RunPod", "Runpod", "run pod").
export function isGpuBillProvider(provider: string): boolean {
  return provider.toLowerCase().replace(/[^a-z]/g, '') === 'runpod';
}

// The measured monthly figure when there is one to use, or null to keep the typed figure.
export function measuredGpuMonthlyCents(state: GpuBillState | null): number | null {
  if (!state || state.unavailableReason !== null) return null;
  return state.last30DaysCents;
}
