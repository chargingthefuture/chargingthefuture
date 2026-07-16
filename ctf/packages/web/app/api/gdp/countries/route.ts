import { NextResponse } from 'next/server';
import { requireGdpReadAccess } from 'lib/gdp/_lib';
import { listMemberCountsByCountry } from 'lib/gdp/repository';
import { countActiveDirectoryProfiles } from 'lib/directory/repository';

// Per-country member distribution for the GDP dashboard's "All Countries" panel. Location is read from
// members' directory profiles (the shared member profile); this is a people-count per country, never an
// invented per-country money figure. Members who are on the active roster but have no country recorded are
// returned as a single `unspecified` bucket so the panel reconciles to the full active-Directory member
// roster — the same count the dashboard hero shows. Behind the same read gate as the report.
export async function GET() {
  const gate = await requireGdpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const countries = await listMemberCountsByCountry();
  const located = countries.reduce((sum, c) => sum + c.members, 0);
  // Reconcile to the full member roster (active, non-deleted directory profiles — the same population
  // getGdpShellStats/buildLiveGdpReport count). Anyone active but without a country falls into unspecified.
  // If the roster read fails, fall back to the located total so the bucket is simply omitted (never negative).
  const roster = (await countActiveDirectoryProfiles().catch(() => null)) ?? located;
  const unspecified = Math.max(0, roster - located);
  return NextResponse.json({ ok: true, countries, unspecified, totalMembers: roster }, { status: 200 });
}
