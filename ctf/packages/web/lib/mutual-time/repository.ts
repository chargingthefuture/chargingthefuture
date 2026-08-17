import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  MUTUAL_TIME_DEFAULT_WINDOW_DAYS,
  MUTUAL_TIME_MAX_DESCRIPTION_LENGTH,
  MUTUAL_TIME_MAX_PICKS,
  MUTUAL_TIME_MAX_TITLE_LENGTH,
  MUTUAL_TIME_MEETING_PLUGINS,
  MUTUAL_TIME_ERROR_CODE,
  type MutualTimeErrorCode,
  type MutualTimeMeetingPlugin,
} from './constants';
import {
  candidateSlotSet,
  dateUtcMidnightMs,
  generateSlotsFrom,
  normalizeSlotIso,
  rollingWindowStartMs,
} from './slots';
import { meetingPluginName, meetingPluginRoute } from './meeting-plugin';
import { generateEventSlug } from './slug';
import type {
  MutualTimeEffectiveState,
  MutualTimeEvent,
  MutualTimePublicEvent,
} from './types';

// A typed error the routes map to an error code + HTTP status (keeps HTTP concerns out of the SQL layer).
export class MutualTimeError extends Error {
  code: MutualTimeErrorCode;
  constructor(code: MutualTimeErrorCode, message: string) {
    super(message);
    this.name = 'MutualTimeError';
    this.code = code;
  }
}

type EventRow = {
  id: string;
  slug: string;
  created_by_user_id: string;
  title: string | null;
  description: string | null;
  meeting_plugin: string;
  window_start_date: string; // selected as text 'YYYY-MM-DD'
  window_days: number;
  opens_at: Date | null;
  closes_at: Date | null;
  status: string;
  result_slot_start: Date | null;
  result_can_make_it: number | null;
  created_at: Date;
  closed_at: Date | null;
  auto_closed: boolean;
};

const EVENT_COLUMNS = `
  id::text,
  slug,
  created_by_user_id,
  title,
  description,
  meeting_plugin,
  to_char(window_start_date, 'YYYY-MM-DD') AS window_start_date,
  window_days,
  opens_at,
  closes_at,
  status,
  result_slot_start,
  result_can_make_it,
  created_at,
  closed_at,
  auto_closed
`;

function normalizeMeetingPlugin(raw: unknown): MutualTimeMeetingPlugin {
  if (typeof raw === 'string' && (MUTUAL_TIME_MEETING_PLUGINS as readonly string[]).includes(raw)) {
    return raw as MutualTimeMeetingPlugin;
  }
  throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.invalidPayload, 'Pick a valid meeting place.');
}

function trimToNull(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, max);
}

function parseOptionalIso(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (typeof raw !== 'string') {
    throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.invalidPayload, 'Invalid date.');
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.invalidPayload, 'Invalid date.');
  }
  return new Date(ms);
}

// The effective, time-aware state (distinct from stored status): a future opens_at means 'scheduled',
// and a past closes_at means 'closed' even before the row is auto-closed on the next read — so a vote
// arriving after the close time is rejected consistently.
function effectiveState(row: EventRow, now: Date): MutualTimeEffectiveState {
  if (row.status === 'closed') {
    return 'closed';
  }
  if (row.opens_at && now < row.opens_at) {
    return 'scheduled';
  }
  if (row.closes_at && now >= row.closes_at) {
    return 'closed';
  }
  return 'open';
}

// Where the candidate window starts for this event, right now:
//   closed    — frozen at the stored window_start_date, so a stamped result keeps its context;
//   scheduled — the moment voting opens, so a future-dated survey offers days from its open time;
//   open      — rolling: the next half-hour from now, so the days on offer are always upcoming.
// Every read, the vote guard, and the winner computation go through this one function, so the grid a
// voter sees, the picks the server accepts, and the times that can win are always the same set.
function candidateWindowStartMs(row: EventRow, now: Date): number {
  if (row.status === 'closed') {
    return dateUtcMidnightMs(row.window_start_date);
  }
  if (row.opens_at && now < row.opens_at) {
    return rollingWindowStartMs(row.opens_at);
  }
  return rollingWindowStartMs(now);
}

function mapEvent(row: EventRow, voterCount: number, now: Date): MutualTimeEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    meetingPlugin: row.meeting_plugin as MutualTimeMeetingPlugin,
    windowStartDate: row.window_start_date,
    windowDays: row.window_days,
    opensAtIso: row.opens_at ? row.opens_at.toISOString() : null,
    closesAtIso: row.closes_at ? row.closes_at.toISOString() : null,
    status: row.status === 'closed' ? 'closed' : 'open',
    effectiveState: effectiveState(row, now),
    voterCount,
    resultSlotStartIso: row.result_slot_start ? row.result_slot_start.toISOString() : null,
    resultCanMakeIt: row.result_can_make_it,
    createdAtIso: row.created_at.toISOString(),
    closedAtIso: row.closed_at ? row.closed_at.toISOString() : null,
  };
}

// How many distinct members have a live vote. While a survey is open, a pick whose time has gone by
// no longer counts (it has rolled out of the window), so the count reflects who is actually still in
// the running. A closed survey keeps its full historical count — its result is already stamped.
async function voterCountFor(client: PoolClient, eventId: string, upcomingOnly: boolean): Promise<number> {
  const result = await client.query<{ c: number }>(
    `SELECT COUNT(DISTINCT voter_user_id)::int AS c FROM mutual_time_votes
     WHERE event_id = $1 AND ($2::boolean IS FALSE OR slot_start_utc > NOW())`,
    [eventId, upcomingOnly],
  );
  return result.rows[0]?.c ?? 0;
}

// The most-overlap winner: the candidate slot the most distinct voters picked; ties go to the earliest
// slot. Returns null when there are no votes. Simple COUNT/ORDER BY — deterministic and honest.
// Only slots still ahead of now are eligible: with a rolling window an old pick can no longer be
// chosen, so closing a long-open survey can never stamp a time that has already been and gone.
async function computeWinner(
  client: PoolClient,
  eventId: string,
): Promise<{ slotStart: Date; canMakeIt: number } | null> {
  const result = await client.query<{ slot_start_utc: Date; c: number }>(
    `
      SELECT slot_start_utc, COUNT(DISTINCT voter_user_id)::int AS c
      FROM mutual_time_votes
      WHERE event_id = $1 AND slot_start_utc > NOW()
      GROUP BY slot_start_utc
      ORDER BY c DESC, slot_start_utc ASC
      LIMIT 1
    `,
    [eventId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return { slotStart: row.slot_start_utc, canMakeIt: row.c };
}

// Close an event (idempotent) and stamp the computed winner. Runs inside the caller's transaction.
// `autoClosed` records which of the two ways it happened: the survey reaching its close time on its
// own, or an admin pressing Close. The admin-landing dot reads it — an admin who closed a survey by
// hand already knows the time; one whose survey closed itself has to be told.
async function closeAndComputeTx(client: PoolClient, row: EventRow, autoClosed: boolean): Promise<EventRow> {
  if (row.status === 'closed') {
    return row;
  }
  const winner = await computeWinner(client, row.id);
  const updated = await client.query<EventRow>(
    `
      UPDATE mutual_time_events
      SET status = 'closed', closed_at = NOW(), result_slot_start = $2, result_can_make_it = $3,
          auto_closed = $4
      WHERE id = $1
      RETURNING ${EVENT_COLUMNS}
    `,
    [row.id, winner ? winner.slotStart.toISOString() : null, winner ? winner.canMakeIt : null, autoClosed],
  );
  return updated.rows[0];
}

export type CreateEventInput = {
  title?: unknown;
  description?: unknown;
  meetingPlugin?: unknown;
  opensAt?: unknown;
  closesAt?: unknown;
};

export async function createEvent(createdByUserId: string, input: CreateEventInput): Promise<MutualTimeEvent> {
  const title = trimToNull(input.title, MUTUAL_TIME_MAX_TITLE_LENGTH);
  const description = trimToNull(input.description, MUTUAL_TIME_MAX_DESCRIPTION_LENGTH);
  const meetingPlugin = normalizeMeetingPlugin(input.meetingPlugin);
  const opensAt = parseOptionalIso(input.opensAt);
  const closesAt = parseOptionalIso(input.closesAt);

  if (opensAt && closesAt && closesAt <= opensAt) {
    throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.invalidPayload, 'The close time must be after the open time.');
  }

  const now = new Date();
  // Candidate meeting week anchors on when voting opens (or now). v1 simplification: a fixed 7-day
  // window from the open date; making the target week separately configurable is a documented follow-up.
  const anchor = opensAt && opensAt > now ? opensAt : now;
  const windowStartDate = anchor.toISOString().slice(0, 10);

  return withDbTransaction(async (client) => {
    // We always store status='open' at creation, even when opensAt is in the future. The stored
    // status is only ever 'open' or 'closed'; the not-yet-open 'scheduled' state is derived at read
    // time by effectiveState() from opens_at, which every read and the vote guard go through — so a
    // future-dated event is never votable early. Keeping one lazy source of truth (opens_at) avoids a
    // second background transition writing 'scheduled'→'open'.
    // Retry slug generation on the rare unique collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = generateEventSlug(title);
      try {
        const inserted = await client.query<EventRow>(
          `
            INSERT INTO mutual_time_events (
              slug, created_by_user_id, title, description, meeting_plugin,
              window_start_date, window_days, opens_at, closes_at, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')
            RETURNING ${EVENT_COLUMNS}
          `,
          [
            slug,
            createdByUserId,
            title,
            description,
            meetingPlugin,
            windowStartDate,
            MUTUAL_TIME_DEFAULT_WINDOW_DAYS,
            opensAt ? opensAt.toISOString() : null,
            closesAt ? closesAt.toISOString() : null,
          ],
        );
        return mapEvent(inserted.rows[0], 0, now);
      } catch (error) {
        // 23505 = unique_violation (slug clash) — try a fresh slug.
        if ((error as { code?: string })?.code === '23505' && attempt < 4) {
          continue;
        }
        throw error;
      }
    }
    throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.internalError, 'Could not create the event.');
  });
}

// The admin dashboard list — the events THIS admin created, newest first. Auto-closes any that are due.
export async function listEventsForAdmin(createdByUserId: string): Promise<MutualTimeEvent[]> {
  return withDbTransaction(async (client) => {
    const now = new Date();
    // Close any of this admin's events whose close time has passed, then read them all.
    const due = await client.query<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM mutual_time_events
       WHERE created_by_user_id = $1 AND status = 'open' AND closes_at IS NOT NULL AND closes_at <= NOW()`,
      [createdByUserId],
    );
    for (const row of due.rows) {
      // Reached its close time on its own — nobody pressed anything.
      await closeAndComputeTx(client, row, true);
    }

    // One query, no N+1: the distinct voter count is a correlated subquery per row so the whole list
    // returns in a single round-trip. (The close loop above stays sequential — it holds FOR UPDATE.)
    const result = await client.query<EventRow & { voter_count: number }>(
      `SELECT ${EVENT_COLUMNS},
         (SELECT COUNT(DISTINCT v.voter_user_id)::int
          FROM mutual_time_votes v
          WHERE v.event_id = e.id AND (e.status = 'closed' OR v.slot_start_utc > NOW())) AS voter_count
       FROM mutual_time_events e
       WHERE e.created_by_user_id = $1
       ORDER BY e.created_at DESC`,
      [createdByUserId],
    );
    return result.rows.map((row) => mapEvent(row, row.voter_count ?? 0, now));
  });
}

// Admin closes a survey now and the winner is computed. Only the creator (or any admin — enforced at
// the route) may call; here we require the actor to be the creator for a clean ownership check.
export async function closeEvent(actorUserId: string, eventId: string): Promise<MutualTimeEvent> {
  return withDbTransaction(async (client) => {
    const found = await client.query<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM mutual_time_events WHERE id = $1 AND created_by_user_id = $2`,
      [eventId, actorUserId],
    );
    const row = found.rows[0];
    if (!row) {
      throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.notFound, 'Event not found.');
    }
    const closed = await closeAndComputeTx(client, row, false);
    const count = await voterCountFor(client, closed.id, false);
    return mapEvent(closed, count, new Date());
  });
}

// Public read: the event by slug, auto-closing if its close time has passed. Never returns who voted.
export async function getPublicEvent(slug: string): Promise<MutualTimePublicEvent | null> {
  return withDbTransaction(async (client) => {
    const found = await client.query<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM mutual_time_events WHERE slug = $1`,
      [slug],
    );
    let row = found.rows[0];
    if (!row) {
      return null;
    }
    if (row.status === 'open' && row.closes_at && row.closes_at <= new Date()) {
      row = await closeAndComputeTx(client, row, true);
    }
    const now = new Date();
    const count = await voterCountFor(client, row.id, row.status !== 'closed');
    const meetingPlugin = row.meeting_plugin as MutualTimeMeetingPlugin;
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      meetingPlugin,
      meetingPluginName: meetingPluginName(meetingPlugin),
      meetingPluginRoute: meetingPluginRoute(meetingPlugin),
      windowStartDate: row.window_start_date,
      windowDays: row.window_days,
      opensAtIso: row.opens_at ? row.opens_at.toISOString() : null,
      closesAtIso: row.closes_at ? row.closes_at.toISOString() : null,
      effectiveState: effectiveState(row, now),
      candidateSlots: generateSlotsFrom(candidateWindowStartMs(row, now), row.window_days),
      voterCount: count,
      resultSlotStartIso: row.result_slot_start ? row.result_slot_start.toISOString() : null,
      resultCanMakeIt: row.result_can_make_it,
    };
  });
}

// This viewer's current picks for an event (ISO UTC starts), plus how many of their saved picks have
// since gone by. Only upcoming picks come back as picks: with a rolling window a time that has passed
// is no longer on offer and no longer counts, so the form must not show it as a live choice. The
// expired count is what lets the page say so plainly instead of silently dropping their vote.
export async function getViewerPicks(
  slug: string,
  userId: string,
): Promise<{ picks: string[]; expiredCount: number }> {
  const result = await queryDb<{ slot_start_utc: Date; is_expired: boolean }>(
    `
      SELECT v.slot_start_utc, (v.slot_start_utc <= NOW()) AS is_expired
      FROM mutual_time_votes v
      JOIN mutual_time_events e ON e.id = v.event_id
      WHERE e.slug = $1 AND v.voter_user_id = $2
      ORDER BY v.slot_start_utc ASC
    `,
    [slug, userId],
  );
  return {
    picks: result.rows.filter((r) => !r.is_expired).map((r) => r.slot_start_utc.toISOString()),
    expiredCount: result.rows.filter((r) => r.is_expired).length,
  };
}

// Check one submitted pick against the candidate grid and return it in the canonical ISO form. Its own
// function so the three ways a pick can be wrong are named in one place — and so the save transaction
// below stays inside the complexity limit (rule 116).
//   - a wrong element type is a malformed payload (invalidPayload), distinct from a well-formed string
//     that is not a candidate (invalidSlot);
//   - a well-formed time that has gone by gets the same invalidSlot code with wording that says so,
//     because that one the voter can fix by picking again.
function normalizePick(raw: unknown, candidates: Set<string>): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.invalidPayload, 'Picks must be a list of time slots.');
  }
  const iso = normalizeSlotIso(raw);
  if (!iso || !candidates.has(iso)) {
    const passed = iso !== null && Date.parse(iso) <= Date.now();
    throw new MutualTimeError(
      MUTUAL_TIME_ERROR_CODE.invalidSlot,
      passed
        ? 'One of your picks has already passed. Pick a time that is still ahead.'
        : 'One of your picks is not a valid time slot.',
    );
  }
  return iso;
}

// Replace this member's picks for an event (up to MUTUAL_TIME_MAX_PICKS). Rejects when the event is not
// currently open (scheduled or closed) or a pick is not a valid candidate slot.
export async function saveVote(slug: string, userId: string, rawSlots: unknown): Promise<string[]> {
  if (!Array.isArray(rawSlots)) {
    throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.invalidPayload, 'Picks must be a list.');
  }
  if (rawSlots.length > MUTUAL_TIME_MAX_PICKS) {
    throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.tooManyPicks, `Pick at most ${MUTUAL_TIME_MAX_PICKS} windows.`);
  }

  return withDbTransaction(async (client) => {
    const found = await client.query<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM mutual_time_events WHERE slug = $1 FOR UPDATE`,
      [slug],
    );
    const row = found.rows[0];
    if (!row) {
      throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.notFound, 'Event not found.');
    }
    if (effectiveState(row, new Date()) !== 'open') {
      throw new MutualTimeError(MUTUAL_TIME_ERROR_CODE.notOpen, 'Voting is not open for this event.');
    }

    // Validate + dedupe each pick against the candidate grid, built from the same rolling window the
    // voter was shown. A pick whose time has passed while the form sat open is no longer a candidate,
    // so it is rejected here rather than quietly stored as a vote for a time nobody can attend.
    const candidates = candidateSlotSet(candidateWindowStartMs(row, new Date()), row.window_days);
    const picks = new Set<string>();
    for (const raw of rawSlots) {
      picks.add(normalizePick(raw, candidates));
    }

    await client.query(`DELETE FROM mutual_time_votes WHERE event_id = $1 AND voter_user_id = $2`, [row.id, userId]);
    for (const iso of picks) {
      await client.query(
        `INSERT INTO mutual_time_votes (event_id, voter_user_id, slot_start_utc) VALUES ($1, $2, $3)`,
        [row.id, userId, iso],
      );
    }
    return Array.from(picks).sort();
  });
}

// Note: account/service deletion of a member's votes (and any events they created) is handled
// declaratively by the account-deletion engine from lib/account/deletion-registry.ts — no bespoke
// delete function is needed here.
