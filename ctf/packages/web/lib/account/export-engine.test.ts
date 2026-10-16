import { describe, expect, it } from 'vitest';
import { getDeletionEntry } from './deletion-registry';
import { planExport } from './export-engine';

describe('account export plan', () => {
  it('reads Mood check-ins through the member pseudonym (issue #2774)', () => {
    const entry = getDeletionEntry('mood');
    expect(entry).toBeDefined();
    const statements = planExport(entry!);
    const checkIns = statements.find((statement) => statement.table === 'mood_submissions');
    expect(checkIns?.sql).toBe(
      'SELECT * FROM mood_submissions WHERE user_id = $1 OR pseudonym IN (SELECT pseudonym FROM mood_client_identities WHERE user_id = $1)',
    );
    expect(checkIns?.readThrough).toBe('pseudonym in mood_client_identities');
    const mapping = statements.find((statement) => statement.table === 'mood_client_identities');
    expect(mapping?.sql).toBe('SELECT * FROM mood_client_identities WHERE user_id = $1');
    expect(mapping?.readThrough).toBeUndefined();
  });
});
