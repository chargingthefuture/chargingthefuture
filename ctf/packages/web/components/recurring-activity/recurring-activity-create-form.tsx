'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import {
  CADENCE_LABEL,
  SECTOR_LABEL,
  mapDirectoryToMembers,
  type Currency,
  type MemberOption,
  type RecurringActivityCadence,
  type RecurringActivitySector,
  type RecurringActivityTokens,
} from './recurring-activity-shared';

const SECTORS: RecurringActivitySector[] = ['housing', 'service', 'favor', 'general'];
const CADENCES: RecurringActivityCadence[] = ['weekly', 'biweekly', 'monthly', 'quarterly'];

export interface CreateActivityInput {
  counterpartyUserId: string;
  sector: RecurringActivitySector;
  currencyCode: string;
  cadence: RecurringActivityCadence;
  scValue?: number;
}

export function RecurringActivityCreateForm({
  currencies,
  t,
  submitting,
  error,
  onSubmit,
}: {
  currencies: Currency[];
  t: RecurringActivityTokens;
  submitting: boolean;
  error: string | null;
  onSubmit: (input: CreateActivityInput) => void;
}) {
  const [counterparty, setCounterparty] = useState<MemberOption | null>(null);
  const [sector, setSector] = useState<RecurringActivitySector>('general');
  const [currencyCode, setCurrencyCode] = useState<string>(currencies[0]?.code ?? '');
  const [cadence, setCadence] = useState<RecurringActivityCadence>('monthly');
  const [scValue, setScValue] = useState<string>('');

  useEffect(() => {
    if (!currencyCode && currencies[0]) {
      setCurrencyCode(currencies[0].code);
    }
  }, [currencies, currencyCode]);

  const { isServiceCredits, scNumber, canSubmit } = deriveCreateFormState({
    currencies,
    currencyCode,
    submitting,
    counterparty,
    scValue,
  });

  const submit = useCallback(() => {
    if (!counterparty || currencyCode === '') {
      return;
    }
    const input: CreateActivityInput = {
      counterpartyUserId: counterparty.userId,
      sector,
      currencyCode,
      cadence,
    };
    if (isServiceCredits && scValue !== '' && Number.isFinite(scNumber) && scNumber > 0) {
      input.scValue = scNumber;
    }
    onSubmit(input);
  }, [counterparty, currencyCode, sector, cadence, isServiceCredits, scValue, scNumber, onSubmit]);

  const labelStyle: React.CSSProperties = { fontSize: 12, color: t.SUBTLE, marginBottom: 6, display: 'block' };
  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 13,
    color: t.TEXT,
    background: t.INPUT_BG,
    border: `1px solid ${t.BORDER_STRONG}`,
    outline: 'none',
    marginBottom: 14,
    boxSizing: 'border-box',
    appearance: 'auto',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>Acknowledge an ongoing activity</div>
      <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, margin: '0 0 16px' }}>
        Recognize something ongoing you share with another member. It is a note to each other, not a bill —
        the other member confirms it, and it stays private unless you change that.
      </p>

      <span style={labelStyle}>Other member</span>
      <CounterpartyPicker t={t} selected={counterparty} onSelect={setCounterparty} onClear={() => setCounterparty(null)} />

      <label htmlFor="ra-sector" style={labelStyle}>What is it</label>
      <select id="ra-sector" value={sector} onChange={(e) => setSector(e.target.value as RecurringActivitySector)} style={selectStyle}>
        {SECTORS.map((s) => (
          <option key={s} value={s} style={{ color: t.BG }}>{SECTOR_LABEL[s]}</option>
        ))}
      </select>

      <label htmlFor="ra-currency" style={labelStyle}>Currency</label>
      <select id="ra-currency" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} style={selectStyle}>
        {currencies.map((c) => (
          <option key={c.code} value={c.code} style={{ color: t.BG }}>{c.label}</option>
        ))}
      </select>

      <label htmlFor="ra-cadence" style={labelStyle}>How often</label>
      <select id="ra-cadence" value={cadence} onChange={(e) => setCadence(e.target.value as RecurringActivityCadence)} style={selectStyle}>
        {CADENCES.map((c) => (
          <option key={c} value={c} style={{ color: t.BG }}>{CADENCE_LABEL[c]}</option>
        ))}
      </select>

      {isServiceCredits && (
        <>
          <label htmlFor="ra-sc-value" style={labelStyle}>ServiceCredits value (optional)</label>
          <input
            id="ra-sc-value"
            type="number"
            min="1"
            inputMode="numeric"
            value={scValue}
            onChange={(e) => setScValue(e.target.value)}
            placeholder="e.g. 120"
            style={{ ...selectStyle, appearance: 'auto' }}
          />
        </>
      )}

      {error ? <div style={{ fontSize: 12, color: t.SUBTLE, marginBottom: 10 }}>{error}</div> : null}

      <SubmitButton t={t} canSubmit={canSubmit} submitting={submitting} onSubmit={submit} />
    </div>
  );
}

// Pure derivation of the create form's currency/validation state, kept out of the component so its
// several boolean checks do not inflate the component's complexity.
function deriveCreateFormState({
  currencies,
  currencyCode,
  submitting,
  counterparty,
  scValue,
}: {
  currencies: Currency[];
  currencyCode: string;
  submitting: boolean;
  counterparty: MemberOption | null;
  scValue: string;
}): { isServiceCredits: boolean; scNumber: number; scValid: boolean; canSubmit: boolean } {
  const selectedCurrency = currencies.find((c) => c.code === currencyCode) ?? null;
  const isServiceCredits = selectedCurrency?.isServiceCredits ?? currencyCode === 'SC';

  const scNumber = Number(scValue);
  const scValid = !isServiceCredits || scValue === '' || (Number.isFinite(scNumber) && scNumber > 0);
  const canSubmit = !submitting && counterparty !== null && currencyCode !== '' && scValid;

  return { isServiceCredits, scNumber, scValid, canSubmit };
}

function SubmitButton({
  t,
  canSubmit,
  submitting,
  onSubmit,
}: {
  t: RecurringActivityTokens;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!canSubmit}
      onClick={onSubmit}
      style={{
        width: '100%',
        padding: '11px',
        borderRadius: 10,
        background: canSubmit ? t.ACCENT : `${t.ACCENT}55`,
        border: 'none',
        color: t.BG,
        fontSize: 14,
        fontWeight: 700,
        cursor: canSubmit ? 'pointer' : 'not-allowed',
        fontFamily: 'inherit',
      }}
    >
      {submitting ? 'Recording…' : 'Acknowledge activity'}
    </button>
  );
}

// A calm member picker: type to filter the directory, click a member to select them. The typed text
// is only a filter — the value that is committed is always a real member choice, never free text.
function CounterpartyPicker({
  t,
  selected,
  onSelect,
  onClear,
}: {
  t: RecurringActivityTokens;
  selected: MemberOption | null;
  onSelect: (member: MemberOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) {
      return;
    }
    // Require a couple of characters before hitting the directory, mirroring the mobile picker. An
    // empty query would otherwise return the first page of every member as soon as the form mounts.
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const controller = new AbortController();
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('q', term);
        const res = await fetch(`/api/directory/list?${params.toString()}`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as Parameters<typeof mapDirectoryToMembers>[0];
          setResults(mapDirectoryToMembers(data).slice(0, 8));
        }
      } catch {
        // Aborted or transient; the picker simply shows no new results.
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      controller.abort();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, selected]);

  if (selected) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 8,
          marginBottom: 14,
          background: `${t.ACCENT}12`,
          border: `1px solid ${t.ACCENT}40`,
        }}
      >
        <Check size={14} color={t.ACCENT} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: t.TEXT }}>{selected.name}</span>
        <button
          type="button"
          onClick={() => {
            onClear();
            setQuery('');
          }}
          aria-label="Choose a different member"
          style={{ display: 'flex', background: 'transparent', border: 'none', color: t.MUTED, cursor: 'pointer', padding: 2 }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ position: 'relative', marginBottom: results.length > 0 ? 8 : 0 }}>
        <Search size={14} color={t.MUTED} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search members by name"
          placeholder="Search members by name…"
          style={{
            width: '100%',
            padding: '10px 12px 10px 32px',
            borderRadius: 8,
            fontSize: 13,
            color: t.TEXT,
            background: t.INPUT_BG,
            border: `1px solid ${t.BORDER_STRONG}`,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>
      {loading && results.length === 0 ? (
        <div style={{ fontSize: 12, color: t.MUTED, padding: '4px 2px' }}>Searching…</div>
      ) : null}
      {results.length > 0 && (
        <div style={{ border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 8, overflow: 'hidden' }}>
          {results.map((member) => (
            <button
              key={member.userId}
              type="button"
              onClick={() => onSelect(member)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                fontSize: 13,
                color: t.TEXT,
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${t.BORDER_SOLID}`,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {member.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
