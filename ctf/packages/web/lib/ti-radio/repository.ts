import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  TI_RADIO_ERROR_CODE,
  TI_RADIO_GUIDE_DAYS,
  TI_RADIO_MAX_DESCRIPTION_LENGTH,
  TI_RADIO_MAX_SLOTS_PER_DAY,
  TI_RADIO_MAX_TITLE_LENGTH,
  TI_RADIO_MIN_TITLE_LENGTH,
  TI_RADIO_ROLLING_WINDOW_HOURS,
  TI_RADIO_SLOT_MINUTES,
} from './constants';
import { TiRadioError } from './errors';
import {
  currentSlotStartMs,
  exceedsRollingCap,
  guideSlotStarts,
  isWithinGuideWindow,
  normalizeSlotIso,
  TI_RADIO_SLOT_MS,
} from './slots';
import type { TiRadioBooking, TiRadioGuide, TiRadioGuideSlot, TiRadioViewerState } from './types';

// Reading and writing the schedule. The grid itself is never stored — only bookings are — so an
// empty slot costs nothing and the guide can be lengthened by changing one constant.

type SlotRow = {
  id: string;
  slot_start_utc: Date;
  host_user_id: string;
  host_username: string;
  title: string;
  description: string | null;
  status: string;
  created_at: Date;
};

const SLOT_COLUMNS = `
  id::text,
  slot_start_utc,
  host_user_id,
  host_username,
  title,
  description,
  status,
  created_at
`;

function trimTitle(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value.length < TI_RADIO_MIN_TITLE_LENGTH) {
    throw new TiRadioError(
      TI_RADIO_ERROR_CODE.invalidPayload,
      `Say what the discussion is about, in at least ${TI_RADIO_MIN_TITLE_LENGTH} characters.`,
    );
  }
  return value.slice(0, TI_RADIO_MAX_TITLE_LENGTH);
}

function trimDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim();
  return value.length === 0 ? null : value.slice(0, TI_RADIO_MAX_DESCRIPTION_LENGTH);
}

/** Parse and check a requested start against the grid and the window the guide currently covers. */
function requireBookableSlot(raw: unknown, now: Date): string {
  const iso = normalizeSlotIso(raw);
  if (!iso) {
    throw new TiRadioError(TI_RADIO_ERROR_CODE.invalidPayload, 'That is not one of the times on the guide.');
  }
  const ms = Date.parse(iso);
  // The slot already on air cannot be claimed — its 90 minutes are partly gone, and somebody
  // arriving at the published time would find a discussion that started without them.
  if (ms <= currentSlotStartMs(now)) {
    throw new TiRadioError(TI_RADIO_ERROR_CODE.slotPast, 'That time has already started. Pick a later one.');
  }
  if (!isWithinGuideWindow(ms, now)) {
    throw new TiRadioError(
      TI_RADIO_ERROR_CODE.slotPast,
      `The guide runs ${TI_RADIO_GUIDE_DAYS} days ahead. Pick a time inside it.`,
    );
  }
  return iso;
}

function mapBooking(row: SlotRow, viewerUserId: string | null): TiRadioBooking {
  return {
    id: row.id,
    hostUsername: row.host_username,
    title: row.title,
    description: row.description,
    createdAtIso: row.created_at.toISOString(),
    isViewerHost: viewerUserId !== null && row.host_user_id === viewerUserId,
  };
}

/**
 * The entire guide: every slot start in the window, with the booking on it when there is one. The
 * viewer block is worked out here rather than in the page so one answer decides what the page shows
 * and what the routes will accept.
 */
export async function getGuide(viewer: {
  userId: string | null;
  canHost: boolean;
  isAdmin: boolean;
}): Promise<TiRadioGuide> {
  const now = new Date();
  const starts = guideSlotStarts(now);
  const windowStartIso = starts[0];
  const windowEndIso = new Date(Date.parse(starts[starts.length - 1]) + TI_RADIO_SLOT_MS).toISOString();

  const result = await queryDb<SlotRow>(
    `SELECT ${SLOT_COLUMNS} FROM ti_radio_slots
     WHERE status = 'booked' AND slot_start_utc >= $1 AND slot_start_utc < $2
     ORDER BY slot_start_utc ASC`,
    [windowStartIso, windowEndIso],
  );

  const bookedByStart = new Map<string, SlotRow>();
  for (const row of result.rows) {
    bookedByStart.set(row.slot_start_utc.toISOString(), row);
  }

  const onAirIso = new Date(currentSlotStartMs(now)).toISOString();
  const slots: TiRadioGuideSlot[] = starts.map((slotStartIso) => {
    const row = bookedByStart.get(slotStartIso);
    return {
      slotStartIso,
      slotEndIso: new Date(Date.parse(slotStartIso) + TI_RADIO_SLOT_MS).toISOString(),
      state: row ? 'booked' : 'open',
      booking: row ? mapBooking(row, viewer.userId) : null,
      isOnAir: slotStartIso === onAirIso,
    };
  });

  const viewerState: TiRadioViewerState = {
    isSignedIn: viewer.userId !== null,
    canHost: viewer.canHost,
    isAdmin: viewer.isAdmin,
    bookedSlotStarts: viewer.userId
      ? result.rows.filter((row) => row.host_user_id === viewer.userId).map((row) => row.slot_start_utc.toISOString())
      : [],
  };

  return {
    slots,
    windowStartIso,
    windowEndIso,
    slotMinutes: TI_RADIO_SLOT_MINUTES,
    maxSlotsPerDay: TI_RADIO_MAX_SLOTS_PER_DAY,
    viewer: viewerState,
  };
}

/**
 * The member's other upcoming slot starts near `slotMs`, as epoch milliseconds. Only slots that
 * could share a 24-hour window with the one being booked are loaded, which is every slot that can
 * affect the answer and no more.
 */
async function nearbyStartsMs(client: PoolClient, hostUserId: string, slotMs: number): Promise<number[]> {
  const windowMs = TI_RADIO_ROLLING_WINDOW_HOURS * 60 * 60 * 1000;
  const rows = await client.query<{ slot_start_utc: Date }>(
    `SELECT slot_start_utc FROM ti_radio_slots
     WHERE host_user_id = $1 AND status = 'booked' AND slot_start_utc > $2 AND slot_start_utc < $3`,
    [hostUserId, new Date(slotMs - windowMs).toISOString(), new Date(slotMs + windowMs).toISOString()],
  );
  return rows.rows.map((row) => row.slot_start_utc.getTime());
}

export type BookSlotInput = {
  slotStart?: unknown;
  title?: unknown;
  description?: unknown;
};

/**
 * Claim an empty slot. First come, first served, and the race is settled by the database rather than
 * by a check: a partial unique index allows one booked row per start, so two members pressing at the
 * same moment produce one booking and one honest "somebody just took it".
 */
export async function bookSlot(
  host: { userId: string; username: string | null },
  input: BookSlotInput,
): Promise<TiRadioBooking> {
  const now = new Date();
  const slotStartIso = requireBookableSlot(input.slotStart, now);
  const title = trimTitle(input.title);
  const description = trimDescription(input.description);
  const slotMs = Date.parse(slotStartIso);

  return withDbTransaction(async (client) => {
    const existing = await nearbyStartsMs(client, host.userId, slotMs);
    if (exceedsRollingCap(existing, slotMs)) {
      throw new TiRadioError(
        TI_RADIO_ERROR_CODE.dailyLimit,
        `You can hold ${TI_RADIO_MAX_SLOTS_PER_DAY} slots in any ${TI_RADIO_ROLLING_WINDOW_HOURS} hours. Release one, or pick a time further out.`,
      );
    }

    try {
      const inserted = await client.query<SlotRow>(
        `INSERT INTO ti_radio_slots (slot_start_utc, host_user_id, host_username, title, description, status)
         VALUES ($1, $2, $3, $4, $5, 'booked')
         RETURNING ${SLOT_COLUMNS}`,
        [slotStartIso, host.userId, host.username ?? 'A member', title, description],
      );
      return mapBooking(inserted.rows[0], host.userId);
    } catch (error) {
      // 23505 = unique_violation. The only unique thing here is one booked row per start.
      if ((error as { code?: string })?.code === '23505') {
        throw new TiRadioError(TI_RADIO_ERROR_CODE.slotTaken, 'Somebody just took that slot. Pick another one.');
      }
      throw error;
    }
  });
}

/**
 * Give a slot back. The row is kept with status 'released' rather than deleted, so the trail of who
 * held a time and let it go survives, and the slot returns to the guide as empty for anyone else.
 */
export async function releaseSlot(actor: { userId: string }, slotId: string): Promise<{ slotStartIso: string }> {
  return withDbTransaction(async (client) => {
    const found = await client.query<SlotRow>(
      `SELECT ${SLOT_COLUMNS} FROM ti_radio_slots WHERE id = $1 FOR UPDATE`,
      [slotId],
    );
    const row = found.rows[0];
    if (!row || row.status !== 'booked') {
      throw new TiRadioError(TI_RADIO_ERROR_CODE.notFound, 'That slot is not booked.');
    }
    if (row.host_user_id !== actor.userId) {
      throw new TiRadioError(TI_RADIO_ERROR_CODE.forbidden, 'That is somebody else’s slot.');
    }
    if (row.slot_start_utc.getTime() <= currentSlotStartMs(new Date())) {
      throw new TiRadioError(TI_RADIO_ERROR_CODE.slotPast, 'That slot has already started.');
    }
    await client.query(
      `UPDATE ti_radio_slots SET status = 'released', released_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [slotId],
    );
    return { slotStartIso: row.slot_start_utc.toISOString() };
  });
}

/**
 * An admin takes a slot off the schedule. Separate from a host releasing their own: it keeps who did
 * it and why on the row, and the route writes the audit line. A past slot can be removed too — an
 * admin removing something after the fact is a moderation action, not a scheduling one.
 */
export async function removeSlot(
  admin: { userId: string },
  slotId: string,
  reason: string | null,
): Promise<{ slotStartIso: string; hostUserId: string }> {
  return withDbTransaction(async (client) => {
    const found = await client.query<SlotRow>(
      `SELECT ${SLOT_COLUMNS} FROM ti_radio_slots WHERE id = $1 FOR UPDATE`,
      [slotId],
    );
    const row = found.rows[0];
    if (!row || row.status !== 'booked') {
      throw new TiRadioError(TI_RADIO_ERROR_CODE.notFound, 'That slot is not booked.');
    }
    await client.query(
      `UPDATE ti_radio_slots
       SET status = 'removed', removed_by = $2, removed_at = NOW(), removal_reason = $3, updated_at = NOW()
       WHERE id = $1`,
      [slotId, admin.userId, reason],
    );
    return { slotStartIso: row.slot_start_utc.toISOString(), hostUserId: row.host_user_id };
  });
}

// Note: account and service deletion of a member's slots is handled declaratively by the
// account-deletion engine from lib/account/deletion-registry.ts, so there is no bespoke delete here.
