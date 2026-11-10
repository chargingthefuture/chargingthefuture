import { seArchiveReplayForDay, seReplayBroadcastLine, seReplayIsRecent, type SeTodayCard } from '@ctf/shared';
import { listBeaconReplays } from 'lib/beacon/repository';
import { toPublicBeaconReplay, type PublicBeaconReplay } from 'lib/beacon/replays';
import { action, card, startOfTodayIso } from './card';

// Beacon replays on Today (owner decision, 2026-11-03): every replay broadcast in the last 7 days,
// and one older replay a day from the archive, the same for everybody (seArchiveReplayForDay in
// @ctf/shared). Both carry the card id `beacon-replay:<id>`, so a replay the member marked done or
// Not for me stays that way when the rotation brings it round again.

const PAGE = 100;
const MAX_PAGES = 20;

async function allReplays(): Promise<PublicBeaconReplay[]> {
  const all: PublicBeaconReplay[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await listBeaconReplays(PAGE, page * PAGE);
    all.push(...rows.map(toPublicBeaconReplay));
    if (rows.length < PAGE) break;
  }
  return all;
}

const broadcastIso = (replay: PublicBeaconReplay) => replay.endedAtIso ?? replay.startedAtIso ?? new Date(0).toISOString();

function replayCard(replay: PublicBeaconReplay, label: string, body: string | null, createdAtIso: string): SeTodayCard {
  return card({
    source: 'beacon-replay',
    sourceId: replay.id,
    kind: 'replay',
    label,
    title: replay.title,
    body,
    createdAtIso,
    href: replay.watchUrl,
    actions: [action('open', 'Watch', replay.watchUrl)],
  });
}

export async function replayCards(now = new Date()): Promise<SeTodayCard[]> {
  const day = startOfTodayIso(now).slice(0, 10);
  const replays = (await allReplays()).map((replay) => ({ ...replay, broadcastIso: broadcastIso(replay) }));
  const recent = replays
    .filter((replay) => seReplayIsRecent(replay, day))
    .map((replay) => replayCard(replay, 'Replay', replay.description || null, replay.broadcastIso));
  const archived = seArchiveReplayForDay(replays, day);
  if (!archived) return recent;
  const body = [seReplayBroadcastLine(archived.broadcastIso), archived.description].filter(Boolean).join('. ');
  // Dated to the start of today: it is the day's card, as a story is.
  return [...recent, replayCard(archived, 'Replay · from the archive', body, startOfTodayIso(now))];
}
