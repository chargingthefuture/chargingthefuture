import { queryDb } from 'lib/db/postgres';

// Collusion review (inventory Gaps #4).
//
// A recurring activity counts toward the Community Value Index and toward a member's Trust breadth
// only after the other member confirms it. That two-sided rule is the defense against one member
// inflating their own standing — but it does nothing against a small group who confirm each other's
// arrangements. The bilateral graph needed to see that pattern has always been recorded; this module
// is the read that surfaces it.
//
// Everything here is READ-ONLY and admin-only. It flags patterns for a person to look at; it never
// judges, never scores a member, and never changes a row. A flag is a question, not a finding — real
// members in a small town genuinely do have several arrangements with each other.

/** A confirmed arrangement between two members, the edge the review works on. */
type ActiveEdge = {
  activityId: string;
  ownerUserId: string;
  counterpartyUserId: string;
  createdAt: Date;
  confirmedAt: Date | null;
};

/** Two members who each declared an arrangement with the other. */
export interface ReciprocalPair {
  userA: string;
  userB: string;
  activityIds: string[];
}

/** An arrangement confirmed almost immediately after it was declared. */
export interface FastConfirmation {
  activityId: string;
  ownerUserId: string;
  counterpartyUserId: string;
  secondsToConfirm: number;
}

/** A small group whose confirmed arrangements point mostly at each other. */
export interface TightCluster {
  memberUserIds: string[];
  arrangementCount: number;
  /** Edges per member. Above 1 means the group contains a loop rather than a simple chain. */
  density: number;
}

export interface CollusionReview {
  /** Every confirmed arrangement the review looked at. */
  activeArrangementCount: number;
  reciprocalPairs: ReciprocalPair[];
  fastConfirmations: FastConfirmation[];
  tightClusters: TightCluster[];
  /** True when the edge cap was hit, so the reader knows the picture is partial rather than complete. */
  truncated: boolean;
}

// An arrangement confirmed within this many seconds of being declared was almost certainly not read.
// Generous on purpose: two people sitting together can legitimately confirm in a minute, so this is
// set to catch rubber-stamping, not promptness.
const FAST_CONFIRM_SECONDS = 60;

// A group bigger than this is a community, not a ring — flagging it would bury the real signal.
const MAX_CLUSTER_SIZE = 8;

// The review holds the graph in memory to find loops, so it reads a bounded slice. Far above any
// plausible real volume; if it is ever hit, `truncated` says so rather than quietly showing a
// partial picture as if it were the whole one.
const MAX_EDGES = 5000;

async function loadActiveEdges(): Promise<{ edges: ActiveEdge[]; truncated: boolean }> {
  const result = await queryDb<{
    id: string;
    owner_user_id: string;
    counterparty_user_id: string;
    created_at: Date;
    confirmed_at: Date | null;
  }>(
    `SELECT id, owner_user_id, counterparty_user_id, created_at, confirmed_at
       FROM recurring_activities
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT ${MAX_EDGES + 1}`,
  );
  const rows = result.rows.slice(0, MAX_EDGES);
  return {
    truncated: result.rows.length > MAX_EDGES,
    edges: rows.map((row) => ({
      activityId: row.id,
      ownerUserId: row.owner_user_id,
      counterpartyUserId: row.counterparty_user_id,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
    })),
  };
}

/** A stable key for an unordered pair, so A→B and B→A land on the same entry. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Members who each declared an arrangement with the other. One arrangement between two people is
 * ordinary; two, one declared in each direction, is the shape of a trade of confirmations.
 */
export function findReciprocalPairs(edges: ActiveEdge[]): ReciprocalPair[] {
  const directed = new Set(edges.map((e) => `${e.ownerUserId}->${e.counterpartyUserId}`));
  const byPair = new Map<string, string[]>();
  for (const edge of edges) {
    const isReciprocal = directed.has(`${edge.counterpartyUserId}->${edge.ownerUserId}`);
    if (!isReciprocal) continue;
    const key = pairKey(edge.ownerUserId, edge.counterpartyUserId);
    byPair.set(key, [...(byPair.get(key) ?? []), edge.activityId]);
  }
  return [...byPair.entries()].map(([key, activityIds]) => {
    const [userA, userB] = key.split('|');
    return { userA, userB, activityIds };
  });
}

/** Arrangements confirmed so fast that nobody plausibly read what they were confirming. */
export function findFastConfirmations(edges: ActiveEdge[]): FastConfirmation[] {
  const fast: FastConfirmation[] = [];
  for (const edge of edges) {
    if (!edge.confirmedAt) continue;
    const seconds = (edge.confirmedAt.getTime() - edge.createdAt.getTime()) / 1000;
    // A negative gap would mean the clocks disagree, not that someone was quick — skip it rather than
    // reporting a nonsense number.
    if (seconds < 0 || seconds > FAST_CONFIRM_SECONDS) continue;
    fast.push({
      activityId: edge.activityId,
      ownerUserId: edge.ownerUserId,
      counterpartyUserId: edge.counterpartyUserId,
      secondsToConfirm: Math.round(seconds),
    });
  }
  return fast.sort((a, b) => a.secondsToConfirm - b.secondsToConfirm);
}

/**
 * Small groups whose confirmed arrangements point at each other. Built by walking the graph into
 * connected groups, then keeping the ones that are both SMALL (at most MAX_CLUSTER_SIZE members) and
 * LOOPED (at least as many arrangements as members, which a simple chain can never have). That
 * combination is the "same handful of people confirming each other" shape; a big community and a
 * simple chain of introductions both fall out.
 */
export function findTightClusters(edges: ActiveEdge[]): TightCluster[] {
  const neighbors = new Map<string, Set<string>>();
  const addNeighbor = (from: string, to: string) => {
    const set = neighbors.get(from) ?? new Set<string>();
    set.add(to);
    neighbors.set(from, set);
  };
  for (const edge of edges) {
    addNeighbor(edge.ownerUserId, edge.counterpartyUserId);
    addNeighbor(edge.counterpartyUserId, edge.ownerUserId);
  }

  const seen = new Set<string>();
  const clusters: TightCluster[] = [];
  for (const start of neighbors.keys()) {
    if (seen.has(start)) continue;
    const group: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      group.push(current);
      for (const next of neighbors.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    if (group.length < 3 || group.length > MAX_CLUSTER_SIZE) continue;
    const members = new Set(group);
    // Count each arrangement once, not once per endpoint.
    const arrangementCount = edges.filter(
      (e) => members.has(e.ownerUserId) && members.has(e.counterpartyUserId),
    ).length;
    const density = arrangementCount / group.length;
    if (density < 1) continue;
    clusters.push({ memberUserIds: [...group].sort(), arrangementCount, density });
  }
  return clusters.sort((a, b) => b.density - a.density);
}

/**
 * Run the whole review. Read-only: it loads confirmed arrangements and reports the three patterns.
 * The caller (the admin route) resolves member ids to names for display and writes the audit row.
 */
export async function reviewRecurringActivityForCollusion(): Promise<CollusionReview> {
  const { edges, truncated } = await loadActiveEdges();
  return {
    activeArrangementCount: edges.length,
    reciprocalPairs: findReciprocalPairs(edges),
    fastConfirmations: findFastConfirmations(edges),
    tightClusters: findTightClusters(edges),
    truncated,
  };
}
