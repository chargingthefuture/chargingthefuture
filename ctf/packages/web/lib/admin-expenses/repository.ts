import { queryDb } from 'lib/db/postgres';
import type { Expense } from './summary';
import type { ExpenseInput } from './parse';

type ExpenseRow = {
  id: string;
  provider: string;
  purpose: string;
  kind: Expense['kind'];
  billing: Expense['billing'];
  amount_cents: number | null;
  amount_max_cents: number | null;
  paid_on: string | null;
  last_checked_on: string | null;
  stopped_on: string | null;
  notes: string;
  created_at: string | Date;
  updated_at: string | Date;
};

// Dates are read back as text so a DATE column never shifts a day through a time zone on the way to
// the screen.
const SELECT_COLUMNS = `
  id, provider, purpose, kind, billing, amount_cents, amount_max_cents,
  to_char(paid_on, 'YYYY-MM-DD') AS paid_on,
  to_char(last_checked_on, 'YYYY-MM-DD') AS last_checked_on,
  to_char(stopped_on, 'YYYY-MM-DD') AS stopped_on,
  notes, created_at, updated_at
`;

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    provider: row.provider,
    purpose: row.purpose,
    kind: row.kind,
    billing: row.billing,
    amountCents: row.amount_cents,
    amountMaxCents: row.amount_max_cents,
    paidOn: row.paid_on,
    lastCheckedOn: row.last_checked_on,
    stoppedOn: row.stopped_on,
    notes: row.notes,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

// Every row, stopped ones included (an admin list hides nothing, rule 131).
export async function listExpenses(): Promise<Expense[]> {
  const result = await queryDb<ExpenseRow>(`SELECT ${SELECT_COLUMNS} FROM admin_expenses ORDER BY provider ASC, created_at ASC`);
  return result.rows.map(mapRow);
}

export async function getExpense(id: string): Promise<Expense | null> {
  const result = await queryDb<ExpenseRow>(`SELECT ${SELECT_COLUMNS} FROM admin_expenses WHERE id = $1::uuid`, [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const result = await queryDb<ExpenseRow>(
    `
      INSERT INTO admin_expenses
        (provider, purpose, kind, billing, amount_cents, amount_max_cents, paid_on, last_checked_on, stopped_on, notes)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9::date, $10)
      RETURNING ${SELECT_COLUMNS}
    `,
    [
      input.provider,
      input.purpose,
      input.kind,
      input.billing,
      input.amountCents,
      input.amountMaxCents,
      input.paidOn,
      input.lastCheckedOn,
      input.stoppedOn,
      input.notes,
    ],
  );
  return mapRow(result.rows[0]);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense | null> {
  const result = await queryDb<ExpenseRow>(
    `
      UPDATE admin_expenses
      SET provider = $2, purpose = $3, kind = $4, billing = $5, amount_cents = $6, amount_max_cents = $7,
          paid_on = $8::date, last_checked_on = $9::date, stopped_on = $10::date, notes = $11,
          updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING ${SELECT_COLUMNS}
    `,
    [
      id,
      input.provider,
      input.purpose,
      input.kind,
      input.billing,
      input.amountCents,
      input.amountMaxCents,
      input.paidOn,
      input.lastCheckedOn,
      input.stoppedOn,
      input.notes,
    ],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const result = await queryDb(`DELETE FROM admin_expenses WHERE id = $1::uuid`, [id]);
  return (result.rowCount ?? 0) > 0;
}

// Members who hold full access through Unlock — the same 'approved_full' tier every gated feature
// checks. Counted per person, since a member can have more than one submission row.
export async function countApprovedMembers(): Promise<number> {
  const result = await queryDb<{ approved: string }>(
    `SELECT COUNT(DISTINCT user_id)::text AS approved FROM unlock_verification_submissions WHERE access_tier = 'approved_full'`,
  );
  return Number.parseInt(result.rows[0]?.approved ?? '0', 10) || 0;
}
