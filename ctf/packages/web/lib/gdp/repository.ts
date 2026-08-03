import { queryDb } from 'lib/db/postgres';
import { countActiveDirectoryProfiles } from 'lib/directory/repository';
import { countTotalMembers } from 'lib/engagement/login-activity';
import { recognizeCommunityValueIndex } from 'lib/gdp/recognition';
import { projectOpenValueIndex } from 'lib/gdp/projection';

// Canonical community member count (owner decision 2026-07-15): the active Directory roster —
// countActiveDirectoryProfiles (is_active AND NOT deleted, claimed or not) — the SAME definition the
// Workforce dashboard and the Directory use, so GDP shows the identical number as those two surfaces.
// Falls back to the Clerk `users` / login_events signup count only if the Directory read fails, so the
// figure never blanks. (`users` is a different population — accounts, not directory profiles — which is
// why GDP used to read a lower number than the Directory roster.)
async function resolveMemberCount(): Promise<number | null> {
  const roster = await countActiveDirectoryProfiles().catch(() => null);
  if (roster !== null) {
    return roster;
  }
  return countTotalMembers().catch(() => null);
}

export async function getGdpShellStats(): Promise<{ memberCount: number | null; gdpValueUsd: number | null }> {
  // Member count is the active Directory roster (see resolveMemberCount) so GDP matches Workforce and the
  // Directory exactly. There is deliberately NO USD-denominated GDP figure to surface on the community home
  // shell: the live Community Value Index is a relative, unitless measure (shown only inside the GDP app,
  // never with a currency symbol), so gdpValueUsd stays null and the home shell shows its untapped-
  // opportunity framing against a fixed target instead of rendering the index as a dollar amount.
  const memberCount = await resolveMemberCount();
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

/**
 * The projected figure and its breakdown, carried in its OWN field — never inside `metrics` and never
 * inside `sources`. It measures open posts that have not closed yet (lib/gdp/projection.ts), so it is
 * deliberately kept out of every field a caller might sum into the Community Value Index. `null` when
 * the projection read fails: the panel disappears and the real report is untouched.
 */
export type GdpLiveProjection = {
  projectedValueIndex: number;
  openPostCount: number;
  perSource: Array<{ pluginSlug: string; label: string; valueIndex: number; openCount: number }>;
};

export type GdpLiveReport = {
  publication: { id: string; weekStartDate: string; title: string; summary: string; status: 'draft' | 'published' };
  metrics: GdpLiveMetricRow[];
  sources: GdpLiveSource[];
  projection: GdpLiveProjection | null;
};

const LIVE_PUBLICATION_TITLE = 'Skills Economy — Live';
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
  // The projection is a separate, marketing-facing read of open posts. It is fetched alongside the real
  // recognition but never folded into it, and a failure here must never take the dashboard down — so it
  // resolves to null and the panel is simply omitted.
  const [breakdown, totalMembers, projection] = await Promise.all([
    recognizeCommunityValueIndex(),
    resolveMemberCount(),
    projectOpenValueIndex().catch(() => null),
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

  // `metrics` carries ONLY recognized (settled) figures — the projected number is never appended there,
  // so nothing downstream (the weekly job, the snapshot table, the Weekly Performance goal snapshot)
  // can pick it up by metric key.
  return {
    publication,
    metrics,
    sources: breakdown.perSource,
    projection: projection
      ? {
          projectedValueIndex: Math.round(projection.projectedValueIndex),
          openPostCount: projection.openPostCount,
          perSource: projection.perSource.map((s) => ({
            pluginSlug: s.pluginSlug,
            label: s.label,
            valueIndex: Math.round(s.valueIndex),
            openCount: s.openCount,
          })),
        }
      : null,
  };
}

// === Country distribution (Top Countries panel) ===
// Real per-country member distribution — the honest "location tied to people" signal for the GDP
// country breakdown. Location lives once on the member's directory profile (the shared member profile,
// where country is a required field). This counts EVERY active directory profile that has a country —
// claimed or not — so it uses the SAME member population as the dashboard's total member count
// (countActiveDirectoryProfiles: is_active AND not deleted), not just the claimed subset. Filtering to
// claimed_by_user_id previously collapsed the panel to the one claimed profile even though the member
// total counts every active profile. Ordered most members first. No small-count suppression (owner
// decision, 2026-07-11): every country with a member is shown. A people-count, never a per-country
// money figure.
export async function listMemberCountsByCountry(): Promise<Array<{ country: string; members: number }>> {
  const result = await queryDb<{ country: string; members: string }>(
    `SELECT btrim(country) AS country, COUNT(*)::text AS members
       FROM directory_profiles
       WHERE country IS NOT NULL
         AND btrim(country) <> ''
         AND is_active = true
         AND deleted_at IS NULL
       GROUP BY btrim(country)
       ORDER BY COUNT(*) DESC, btrim(country) ASC`,
  );
  return result.rows.map((row) => ({ country: row.country, members: Number(row.members) }));
}
