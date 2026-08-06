'use client';

import {
  Shield, Database, Trash2, Lock, AlertTriangle, Info, Loader2,
} from 'lucide-react';
import {
  getAccountDataTokens,
  glyphForService, type AccountService, type AccountDataTokens,
} from './account-data-shared';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '../theme/theme-toggle';
import { AccountIconRail } from '@/components/account/account-icon-rail';

type View = 'data' | 'danger';

type DesktopProps = {
  view: View;
  onViewChange: (v: View) => void;
  deletable: AccountService[];
  retained: AccountService[];
  deletedSlugs: string[];
  pendingSlug: string | null;
  rowError: { slug: string; message: string } | null;
  onDeleteService: (service: AccountService) => void;
  onOpenAccountDelete: () => void;
};

// Desktop (>=768px) Account & Data layout. Matches AccountData.tsx / AccountDataEmpty.tsx.
export function AccountDataDesktop({
  view, onViewChange, deletable, retained, deletedSlugs, pendingSlug, rowError,
  onDeleteService, onOpenAccountDelete,
}: DesktopProps) {
  const { theme } = useTheme();
  const tokens = getAccountDataTokens(theme);
  const { BRAND, BG, BORDER, TEXT, SUBTLE } = tokens;
  const remaining = deletable.filter((s) => !deletedSlugs.includes(s.slug));
  const isEmpty = remaining.length === 0;

  return (
    <div style={{ display: 'flex', height: '100dvh', background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, overflow: 'hidden' }}>
      {/* Uniform left icon rail (brand mark + shared footer: back to your account, settings, avatar). */}
      <AccountIconRail brand={BRAND} bg="#0D0F14" border={BORDER} />

      {/* Left sidebar */}
      <aside style={{ width: 240, background: '#0D0F14', borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: SUBTLE, textTransform: 'uppercase', marginBottom: 4 }}>🔒 Account &amp; Data</div>
          <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.5 }}>Your data — transparent, under your control</div>
        </div>
        <div style={{ padding: '0 12px', flex: 1 }}>
          {([
            { label: 'Your Data', key: 'data' as const, Icon: Database },
            { label: 'Danger Zone', key: 'danger' as const, Icon: AlertTriangle },
          ]).map(({ label, key, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onViewChange(key)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer', background: view === key ? `${BRAND}15` : 'transparent', borderLeft: view === key ? `2px solid ${BRAND}` : '2px solid transparent', color: view === key ? TEXT : SUBTLE, fontSize: 13, border: 'none', textAlign: 'left' }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
          <div style={{ margin: '16px 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase' }}>Summary</div>
          {([
            { l: 'Services with your data', v: `${remaining.length} of ${deletable.length}` },
            { l: 'Always retained', v: `${retained.length}` },
            { l: 'Deleted this session', v: `${deletedSlugs.length}` },
          ]).map(({ l, v }) => (
            <div key={l} style={{ padding: '5px 2px', fontSize: 12, color: SUBTLE }}>
              {l}: <span style={{ color: TEXT, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.5 }}>🔒 Deletions are permanent and cannot be undone.</div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
          <Shield size={18} color={BRAND} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Your Data &amp; Privacy</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>See and delete the data Survivor Hub holds across all services</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: SUBTLE, textTransform: 'uppercase' }}>Theme</span>
            <ThemeToggle />
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '28px 40px' }}>
          {view === 'data' ? (
            isEmpty ? (
              <EmptyState retained={retained} tokens={tokens} />
            ) : (
              <DataView
                remaining={remaining}
                retained={retained}
                pendingSlug={pendingSlug}
                rowError={rowError}
                onDeleteService={onDeleteService}
                tokens={tokens}
              />
            )
          ) : (
            <DangerZone serviceCount={deletable.length} onOpenAccountDelete={onOpenAccountDelete} tokens={tokens} />
          )}
        </div>
      </div>
    </div>
  );
}

function DataView({
  remaining, retained, pendingSlug, rowError, onDeleteService, tokens,
}: {
  remaining: AccountService[];
  retained: AccountService[];
  pendingSlug: string | null;
  rowError: { slug: string; message: string } | null;
  onDeleteService: (service: AccountService) => void;
  tokens: AccountDataTokens;
}) {
  const { BRAND, SURFACE, BORDER, TEXT, SUBTLE } = tokens;
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', borderRadius: 12, background: `${BRAND}06`, border: `1px solid ${BRAND}18`, marginBottom: 24 }}>
        <Info size={15} color={BRAND} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
          Deleting data from a service removes your records from that service permanently. Some audit records may be retained for platform integrity. Deleting from one service does not close your account.
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 14 }}>
        Personal data — {remaining.length} {remaining.length === 1 ? 'service' : 'services'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 32 }}>
        {remaining.map((service) => {
          const isPending = pendingSlug === service.slug;
          const error = rowError?.slug === service.slug ? rowError.message : null;
          return (
            <div key={service.slug} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${error ? 'rgba(239,68,68,0.35)' : BORDER}`, opacity: isPending ? 0.7 : 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${BRAND}10`, border: `1px solid ${BRAND}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                {glyphForService(service.slug)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{service.name}</div>
                <div style={{ fontSize: 12, color: error ? '#F87171' : SUBTLE, lineHeight: 1.4 }}>
                  {error ?? service.summary}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDeleteService(service)}
                disabled={isPending}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer' }}
              >
                {isPending ? <><Loader2 size={12} className="account-data-spin" /> Deleting…</> : <><Trash2 size={12} /> Delete this data</>}
              </button>
            </div>
          );
        })}
      </div>

      <RetainedList retained={retained} tokens={tokens} />
    </>
  );
}

function RetainedList({ retained, tokens }: { retained: AccountService[]; tokens: AccountDataTokens }) {
  const { BORDER, TEXT, SUBTLE } = tokens;
  if (retained.length === 0) return null;
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Always retained — {retained.length} {retained.length === 1 ? 'service' : 'services'}</div>
      <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 14 }}>These cannot be deleted independently. See each reason below.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {retained.map((service) => (
          <div key={service.slug} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.01)', border: `1px solid ${BORDER}` }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              {glyphForService(service.slug)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: SUBTLE }}>{service.name}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: '#4B5563' }}>Retained by design</span>
              </div>
              <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.5 }}>{service.summary}</div>
            </div>
            <Lock size={13} color="#374151" style={{ flexShrink: 0, marginTop: 3 }} />
          </div>
        ))}
      </div>
    </>
  );
}

function EmptyState({ retained, tokens }: { retained: AccountService[]; tokens: AccountDataTokens }) {
  const { BRAND, TEXT, SUBTLE } = tokens;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center', minHeight: '60vh' }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: `${BRAND}08`, border: `1px dashed ${BRAND}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Shield size={28} color={`${BRAND}50`} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 8 }}>No personal data stored yet</div>
      <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7, maxWidth: 480, marginBottom: 28 }}>
        As you use Survivor Hub apps, any personal data they hold will appear here — where you can see it and delete it on your own terms.
      </div>
      {retained.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', borderRadius: 12, background: `${BRAND}05`, border: `1px solid ${BRAND}15`, maxWidth: 560, width: '100%', textAlign: 'left' }}>
          <Info size={14} color={BRAND} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6 }}>
            ServiceCredits ledger and community totals are always retained for financial integrity and platform accuracy. They hold no personal identifiers.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DangerZone({ serviceCount, onOpenAccountDelete, tokens }: { serviceCount: number; onOpenAccountDelete: () => void; tokens: AccountDataTokens }) {
  const { TEXT } = tokens;
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ padding: '22px 24px', borderRadius: 16, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={18} color="#EF4444" />
          <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Delete Entire Account</span>
        </div>
        <div style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 16 }}>
          This removes your profile and all personal data across all {serviceCount} services. Your ServiceCredits are held for 7 days after the request, then returned to the community treasury — never silently destroyed, and never withdrawable externally. If any of your credits are locked in an active escrow, the return waits until that escrow resolves. Some audit records are retained for platform integrity.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
          {([
            { t: `All personal data across ${serviceCount} services permanently deleted`, warn: true },
            { t: 'ServiceCredits: held 7 days, then returned to the community treasury (an active escrow resolves first)', warn: false },
            { t: 'Some audit records retained for platform integrity (by design)', warn: false },
            { t: 'Profile and username removed from all directories', warn: true },
          ]).map(({ t, warn }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: warn ? '#EF4444' : '#4B5563', flexShrink: 0, marginTop: 6 }} />
              <span style={{ color: warn ? '#F87171' : '#9CA3AF', lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenAccountDelete}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          <AlertTriangle size={15} /> Continue to confirmation →
        </button>
      </div>
    </div>
  );
}

export { type View as AccountDataView };
