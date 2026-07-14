import { NextResponse } from 'next/server';
import { requireGdpReadAccess } from 'lib/gdp/_lib';
import { listMemberCountsByCountry } from 'lib/gdp/repository';

// Real per-country member distribution for the GDP dashboard's "Top Countries" panel. Location is
// read from members' directory profiles (the shared member profile); this is a people-count
// per country, never an invented per-country money figure. Behind the same read gate as the report.
export async function GET() {
  const gate = await requireGdpReadAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const countries = await listMemberCountsByCountry();
  const totalMembers = countries.reduce((sum, c) => sum + c.members, 0);
  return NextResponse.json({ ok: true, countries, totalMembers }, { status: 200 });
}
