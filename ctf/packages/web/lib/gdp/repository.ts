import { queryDb } from 'lib/db/postgres';
import { countTotalMembers } from 'lib/engagement/login-activity';
import { recognizeCommunityValueIndex } from 'lib/gdp/recognition';

export async function getGdpShellStats(): Promise<{ memberCount: number | null; gdpValueUsd: number | null }> {
  // Member count is the total number of people signed up (every account), read directly from the identity
  // table. There is deliberately NO USD-denominated GDP figure to surface on the community home shell: the
  // live Community Value Index is a relative, unitless measure (shown only inside the GDP app, never with a
  // currency symbol), so gdpValueUsd stays null and the home shell shows its untapped-opportunity framing
  // against a fixed target instead of rendering the index as a dollar amount. (Before the GDP admin was
  // retired this read the latest published report's USD revenue metric, which no member ever published.)
  const memberCount = await countTotalMembers().catch(() => null);
  return { memberCount, gdpValueUsd: null };
}

// === Live report (GDP dashboard) ===
// The dashboard reads a LIVE report computed on each request — no weekly publish/snapshot step and no
// owner-curated inputs. The headline is the Community Value Index recomputed from every registered
// recognition source right now (folded with the fixed, built-in contribution weights in
// lib/gdp/recognition.ts); member counts come straight from the activity tables. A standing "live"
// narrative heading is always synthesized. This read never writes anything.

/** A live metric row, shaped exactly like the rows the web shell and Android read. */
export type GdpLiveMetricRow = {
  metricKey: string;
  metricValue: number;
  dpSuppressed: boolean;
  lawfulBasis: string;
  sourcePlugin: string;
  isEstimate: boolean;
};

/** One registered recognition source's contribution to the live Community Value Index. */
export type GdpLiveSource = { pluginSlug: string; label: string; valueIndex: number };

export type GdpLiveReport = {
  publication: { id: string; weekStartDate: string; title: string; summary: string; status: 'draft' | 'published' };
  metrics: GdpLiveMetricRow[];
  sources: GdpLiveSource[];
};

const LIVE_PUBLICATION_TITLE = 'TI Skills Economy — Live';
const LIVE_PUBLICATION_SUMMARY =
  'Live measure of every recognized non-incentive exchange across the community, recomputed on each visit — no weekly publish step. Incentives (rewards, bonuses, thank-you grants) and plain transfers are not counted.';

// Monday (UTC) of the current week, matching the week-start convention used by scripts/recognizeGdp.mjs,
// so the synthesized live narrative is dated to the same week the recognition pipeline would record.
function currentWeekStartIso(now = new Date()): string {
  const day = now.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const backToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + backToMonday));
  return monday.toISOString().slice(0, 10);
}

export async function buildLiveGdpReport(): Promise<GdpLiveReport> {
  const [breakdown, totalMembers] = await Promise.all([
    recognizeCommunityValueIndex(),
    countTotalMembers().catch(() => null),
  ]);

  // Community Value Index is the headline: a normalized, weighted estimate (no currency symbol), so it
  // carries is_estimate = true exactly like the weekly pipeline writes it.
  const metrics: GdpLiveMetricRow[] = [
    {
      metricKey: 'gdp_value_index',
      metricValue: Math.round(breakdown.valueIndex),
      dpSuppressed: false,
      lawfulBasis: 'service-delivery',
      sourcePlugin: 'gdp',
      isEstimate: true,
    },
  ];
  if (totalMembers !== null) {
    metrics.push({
      metricKey: 'total_members',
      metricValue: totalMembers,
      dpSuppressed: false,
      lawfulBasis: 'engagement',
      sourcePlugin: 'gdp',
      isEstimate: false,
    });
  }

  // No owner-published narrative overlay any more (the publications admin was retired); always synthesize
  // the standing live heading so the surface has a title.
  const publication = {
    id: 'live',
    weekStartDate: currentWeekStartIso(),
    title: LIVE_PUBLICATION_TITLE,
    summary: LIVE_PUBLICATION_SUMMARY,
    status: 'published' as const,
  };

  return { publication, metrics, sources: breakdown.perSource };
}

// === Country distribution (Top Countries panel) ===
// Real per-country member distribution — the honest "location tied to people" signal for the GDP
// country breakdown. Location lives once on the member's claimed directory profile (the shared
// member profile); this counts CLAIMED, active directory profiles that have a country set. Ordered
// most members first. No small-count suppression (owner decision, 2026-07-11): every country with a
// member is shown. This is a people-count, never an invented per-country money figure.
export async function listMemberCountsByCountry(): Promise<Array<{ country: string; members: number }>> {
  const result = await queryDb<{ country: string; members: string }>(
    `SELECT btrim(country) AS country, COUNT(*)::text AS members
       FROM directory_profiles
       WHERE claimed_by_user_id IS NOT NULL
         AND country IS NOT NULL
         AND btrim(country) <> ''
         AND is_active = true
         AND deleted_at IS NULL
       GROUP BY btrim(country)
       ORDER BY COUNT(*) DESC, btrim(country) ASC`,
  );
  return result.rows.map((row) => ({ country: row.country, members: Number(row.members) }));
}
