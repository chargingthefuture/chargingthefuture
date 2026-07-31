import { queryDb } from 'lib/db/postgres';
import { reportError } from 'lib/observability/report';
import {
  deactivateMemberPresence,
  getMemberPresence,
  upsertMemberPresence,
  type MemberPresenceEntry,
} from './repository';

// Self-heal re-derivation of one member's cross-plugin presence.
//
// The shared index (member_plugin_presence) is normally kept current by each source plugin's live
// write hooks. Those hooks are best-effort: a write that fails after the listing commits is logged
// and dropped, and any listing made before the hooks shipped was only ever seeded by the one-time
// backfill, which has been removed. That leaves no recovery path for a missing row.
//
// This module rebuilds the index for a SINGLE member straight from the same source tables the live
// hooks and the original backfill used, so a member's own "Also active in" list always reflects their
// real current listings even if an index row was dropped or never written. It is the presence
// equivalent of the trust "self" route, which recomputes the caller's signal on read.

// A presence row that SHOULD be active right now for this member, derived from a source table.
interface DesiredPresenceRow {
  pluginSlug: string;
  refType: string;
  refId: string;
  label: string;
  deepLink: string;
}

// One source the re-derivation reads. `slug` lets reconciliation deactivate only within sources that
// were read successfully, so a briefly-missing source table never wipes another plugin's rows.
interface PresenceSource {
  slug: string;
  read: (userId: string) => Promise<DesiredPresenceRow[]>;
}

// TrustTransport `status` is free text with no schema-level enum, so "active" is everything that is
// not one of these terminal states — mirroring the original backfill rather than guessing the active
// set. Kept in sync with the live TrustTransport write hooks.
const TRUST_TRANSPORT_TERMINAL_STATUSES = [
  'canceled',
  'completed',
  'closed',
  'withdrawn',
  'declined',
  'expired',
  'rejected',
];

const PRESENCE_SOURCES: PresenceSource[] = [
  {
    slug: 'lighthouse',
    read: async (userId) => {
      const result = await queryDb<{ id: string }>(
        `SELECT id::text AS id FROM lighthouse_properties WHERE host_user_id = $1 AND is_active = TRUE`,
        [userId],
      );
      return result.rows.map((row) => ({
        pluginSlug: 'lighthouse',
        refType: 'property',
        refId: row.id,
        label: 'Housing listing',
        deepLink: '/apps/lighthouse',
      }));
    },
  },
  {
    slug: 'trust-transport',
    read: async (userId) => {
      const [requests, offers] = await Promise.all([
        queryDb<{ id: string }>(
          `SELECT id::text AS id FROM trust_transport_requests
           WHERE requester_user_id = $1 AND LOWER(status) <> ALL($2::text[])`,
          [userId, TRUST_TRANSPORT_TERMINAL_STATUSES],
        ),
        queryDb<{ id: string }>(
          `SELECT id::text AS id FROM trust_transport_offers
           WHERE provider_user_id = $1 AND LOWER(status) <> ALL($2::text[])`,
          [userId, TRUST_TRANSPORT_TERMINAL_STATUSES],
        ),
      ]);
      return [
        ...requests.rows.map((row) => ({
          pluginSlug: 'trust-transport',
          refType: 'request',
          refId: row.id,
          label: 'Ride request',
          deepLink: '/apps/trust-transport',
        })),
        ...offers.rows.map((row) => ({
          pluginSlug: 'trust-transport',
          refType: 'offer',
          refId: row.id,
          label: 'Offering rides',
          deepLink: '/apps/trust-transport',
        })),
      ];
    },
  },
  {
    slug: 'foundation',
    read: async (userId) => {
      const result = await queryDb<{ skill_id: string }>(
        `SELECT skill_id::text AS skill_id FROM foundation_provider_skills WHERE user_id = $1`,
        [userId],
      );
      return result.rows.map((row) => ({
        pluginSlug: 'foundation',
        refType: 'provider-skill',
        refId: row.skill_id,
        label: 'Provider offering',
        deepLink: '/apps/foundation',
      }));
    },
  },
  {
    slug: 'socket-relay',
    read: async (userId) => {
      const result = await queryDb<{ id: string }>(
        `SELECT id::text AS id FROM socket_relay_requests WHERE owner_user_id = $1 AND status = 'open'`,
        [userId],
      );
      return result.rows.map((row) => ({
        pluginSlug: 'socket-relay',
        refType: 'post',
        refId: row.id,
        label: 'Help post',
        deepLink: '/apps/socket-relay',
      }));
    },
  },
];

function presenceKey(slug: string, refType: string, refId: string): string {
  return `${slug}:${refType}:${refId}`;
}

// Rebuild the member's presence index from the live source tables, then return the current active
// list. Best-effort and self-contained: a source whose table is missing/unavailable is skipped (its
// existing index rows are left untouched, never deactivated), so re-derivation can only add back
// missing rows and retire ones whose source listing is genuinely gone — it can never wipe the index
// because of a transient read failure. Reconciliation only touches sources that read cleanly.
export async function refreshOwnPresence(userId: string): Promise<MemberPresenceEntry[]> {
  const trimmed = userId.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const desired: DesiredPresenceRow[] = [];
  const reconciledSlugs = new Set<string>();

  for (const source of PRESENCE_SOURCES) {
    try {
      const rows = await source.read(trimmed);
      desired.push(...rows);
      // Only a source we read without error is safe to reconcile (deactivate stale rows within).
      reconciledSlugs.add(source.slug);
    } catch {
      // Missing table or transient failure: skip this source so we neither add nor remove its rows.
    }
  }

  const desiredKeys = new Set(desired.map((row) => presenceKey(row.pluginSlug, row.refType, row.refId)));

  // Deactivate any currently-active index rows that the source no longer backs — but only for the
  // plugins whose source read succeeded, so a skipped source never loses its rows.
  try {
    const current = await queryDb<{ plugin_slug: string; ref_type: string; ref_id: string }>(
      `SELECT plugin_slug, ref_type, ref_id FROM member_plugin_presence WHERE user_id = $1 AND is_active = TRUE`,
      [trimmed],
    );
    const rowsToDeactivate = current.rows.filter(
      (row) =>
        reconciledSlugs.has(row.plugin_slug) &&
        !desiredKeys.has(presenceKey(row.plugin_slug, row.ref_type, row.ref_id)),
    );
    // Run deactivations concurrently with per-row error isolation: one failed row must not abort
    // the rest, and every failure is reported rather than silently dropped.
    const deactivationResults = await Promise.allSettled(
      rowsToDeactivate.map((row) =>
        deactivateMemberPresence({
          userId: trimmed,
          pluginSlug: row.plugin_slug,
          refType: row.ref_type,
          refId: row.ref_id,
        }),
      ),
    );
    deactivationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const row = rowsToDeactivate[index];
        reportError(result.reason, {
          area: 'presence',
          op: 'derive_deactivate',
          extra: { pluginSlug: row.plugin_slug, refType: row.ref_type, refId: row.ref_id },
        });
      }
    });
  } catch {
    // If the index itself is unavailable, fall through: any upsert failure below is reported the
    // same way and the caller's read handles an empty result. Nothing was deactivated.
  }

  // Run upserts concurrently with per-row error isolation: one failed row must not abort the rest,
  // and every failure is reported rather than silently dropped.
  const upsertResults = await Promise.allSettled(
    desired.map((row) =>
      upsertMemberPresence({
        userId: trimmed,
        pluginSlug: row.pluginSlug,
        refType: row.refType,
        refId: row.refId,
        label: row.label,
        deepLink: row.deepLink,
      }),
    ),
  );
  upsertResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      const row = desired[index];
      reportError(result.reason, {
        area: 'presence',
        op: 'derive_upsert',
        extra: { pluginSlug: row.pluginSlug, refType: row.refType, refId: row.refId },
      });
    }
  });

  return getMemberPresence(trimmed);
}
