'use client';

import {
  Shield, Trash2, Lock, AlertTriangle, Info, ChevronRight, Loader2, Download,
} from 'lucide-react';
import { BackChevronButton } from '@/lib/nav/back-history';
import {
  getAccountDataTokens,
  glyphForService, type AccountService, type AccountDataTokens,
} from './account-data-shared';
import type { AccountDataView } from './account-data-desktop';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '../theme/theme-toggle';

type MobileProps = {
  view: AccountDataView;
  onViewChange: (v: AccountDataView) => void;
  deletable: AccountService[];
  retained: AccountService[];
  deletedSlugs: string[];
  pendingSlug: string | null;
  rowError: { slug: string; message: string } | null;
  /** The export currently in flight: a service slug, or 'full-account'. */
  exportingKey: string | null;
  onDeleteService: (service: AccountService) => void;
  onExportService: (service: AccountService) => void;
  onExportAll: () => void;
  onOpenAccountDelete: () => void;
};

// Mobile (<768px) Account & Data layout. Matches MobileAccountData.tsx / MobileAccountDataEmpty.tsx.
export function AccountDataMobile({
  view, onViewChange, deletable, retained, deletedSlugs, pendingSlug, rowError, exportingKey,
  onDeleteService, onExportService, onExportAll, onOpenAccountDelete,
}: MobileProps) {
  const { theme } = useTheme();
  const tokens = getAccountDataTokens(theme);
  const { BRAND, BG, BORDER, TEXT, SUBTLE } = tokens;
  const remaining = deletable.filter((s) => !deletedSlugs.includes(s.slug));
  const isEmpty = remaining.length === 0;

  return (
    <div style={{ minHeight: '100dvh', background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {/* Back to the account hub — mobile had no way back from this screen. */}
          <BackChevronButton accent={BRAND} size={34} />
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${BRAND}20`, border: `1px solid ${BRAND}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={16} color={BRAND} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Account &amp; Data</div>
            <div style={{ fontSize: 11, color: SUBTLE }}>{deletable.length + retained.length} services · your control</div>
          </div>
          <ThemeToggle />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['data', 'danger'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onViewChange(t)}
              style={{ flex: 1, padding: '7px', borderRadius: 8, background: view === t ? (t === 'danger' ? 'rgba(239,68,68,0.12)' : `${BRAND}18`) : 'rgba(255,255,255,0.04)', border: `1px solid ${view === t ? (t === 'danger' ? 'rgba(239,68,68,0.4)' : `${BRAND}40`) : BORDER}`, color: view === t ? (t === 'danger' ? '#EF4444' : BRAND) : SUBTLE, fontSize: 12, fontWeight: view === t ? 700 : 400, cursor: 'pointer' }}
            >
              {t === 'data' ? 'Your Data' : '⚠️ Danger Zone'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 16px 24px' }}>
        {view === 'data' ? (
          isEmpty ? (
            <MobileEmpty retained={retained} tokens={tokens} />
          ) : (
            <MobileDataView
              remaining={remaining}
              retained={retained}
              pendingSlug={pendingSlug}
              rowError={rowError}
              exportingKey={exportingKey}
              onDeleteService={onDeleteService}
              onExportService={onExportService}
              onExportAll={onExportAll}
              tokens={tokens}
            />
          )
        ) : (
          <MobileDanger serviceCount={deletable.length} onOpenAccountDelete={onOpenAccountDelete} tokens={tokens} />
        )}
      </div>
    </div>
  );
}

// The export affordance shared by every service card: a small download button that mirrors the
// delete button's shape, in the brand color instead of the danger red (export is safe/read-only).
function ExportButton({ service, isExporting, tokens, onExportService }: {
  service: AccountService;
  isExporting: boolean;
  tokens: AccountDataTokens;
  onExportService: (service: AccountService) => void;
}) {
  const { BRAND } = tokens;
  return (
    <button
      type="button"
      onClick={() => onExportService(service)}
      disabled={isExporting}
      aria-label={`Download your ${service.name} data as JSON`}
      title="Download this data (JSON)"
      style={{ flexShrink: 0, padding: '5px 8px', borderRadius: 7, background: `${BRAND}08`, border: `1px solid ${BRAND}25`, color: BRAND, fontSize: 11, fontWeight: 700, cursor: isExporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
    >
      {isExporting ? <Loader2 size={12} className="account-data-spin" /> : <Download size={12} />}
    </button>
  );
}

function MobileDataView({
  remaining, retained, pendingSlug, rowError, exportingKey, onDeleteService, onExportService, onExportAll, tokens,
}: {
  remaining: AccountService[];
  retained: AccountService[];
  pendingSlug: string | null;
  rowError: { slug: string; message: string } | null;
  exportingKey: string | null;
  onDeleteService: (service: AccountService) => void;
  onExportService: (service: AccountService) => void;
  onExportAll: () => void;
  tokens: AccountDataTokens;
}) {
  const { BRAND, SURFACE, BORDER, TEXT, SUBTLE } = tokens;
  const exportingAll = exportingKey === 'full-account';
  const fullExportError = rowError?.slug === 'full-account' ? rowError.message : null;
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: `${BRAND}06`, border: `1px solid ${BRAND}18`, marginBottom: 12 }}>
        <Info size={13} color={BRAND} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>Deleting from a service is permanent. Some audit records are retained for platform integrity.</div>
      </div>

      {/* Take your data with you (issue #1264): one action downloads every service's data as a
          single JSON file. The per-service download sits on each card below. */}
      <button
        type="button"
        onClick={onExportAll}
        disabled={exportingAll}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: `${BRAND}0C`, border: `1px solid ${fullExportError ? 'rgba(239,68,68,0.35)' : `${BRAND}30`}`, color: BRAND, fontSize: 13, fontWeight: 700, cursor: exportingAll ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}
      >
        {exportingAll ? <Loader2 size={14} className="account-data-spin" /> : <Download size={14} />}
        {exportingAll ? 'Preparing your download…' : 'Download all my data (JSON)'}
      </button>
      {fullExportError ? (
        <div style={{ fontSize: 11, color: '#F87171', lineHeight: 1.4, marginBottom: 10 }}>{fullExportError}</div>
      ) : (
        <div style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.4, marginBottom: 10 }}>One JSON file with your own rows from every service. Money ledgers and audit records are retained by design and not included.</div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: SUBTLE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Personal data — {remaining.length} {remaining.length === 1 ? 'service' : 'services'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 24 }}>
        {remaining.map((service) => {
          const isPending = pendingSlug === service.slug;
          const isExporting = exportingKey === service.slug;
          const error = rowError?.slug === service.slug ? rowError.message : null;
          return (
            <div key={service.slug} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, background: SURFACE, border: `1px solid ${error ? 'rgba(239,68,68,0.35)' : BORDER}`, opacity: isPending ? 0.7 : 1 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${BRAND}10`, border: `1px solid ${BRAND}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                {glyphForService(service.slug)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{service.name}</div>
                <div style={{ fontSize: 11, color: error ? '#F87171' : '#4B5563', lineHeight: 1.3, marginTop: 1 }}>{error ?? service.summary}</div>
              </div>
              {service.exportable ? (
                <ExportButton service={service} isExporting={isExporting} tokens={tokens} onExportService={onExportService} />
              ) : null}
              <button
                type="button"
                onClick={() => onDeleteService(service)}
                disabled={isPending}
                aria-label={`Delete your ${service.name} data`}
                style={{ flexShrink: 0, padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 11, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {isPending ? <Loader2 size={12} className="account-data-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          );
        })}
      </div>

      {retained.length > 0 ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: SUBTLE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Always retained — {retained.length} {retained.length === 1 ? 'service' : 'services'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {retained.map((service) => {
              const error = rowError?.slug === service.slug ? rowError.message : null;
              return (
                <div key={service.slug} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.01)', border: `1px solid ${error ? 'rgba(239,68,68,0.35)' : BORDER}` }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{glyphForService(service.slug)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: SUBTLE }}>{service.name}</span>
                      <Lock size={10} color="#374151" />
                    </div>
                    <div style={{ fontSize: 11, color: error ? '#F87171' : '#4B5563', lineHeight: 1.4 }}>{error ?? service.summary}</div>
                  </div>
                  {/* A retained service can still hold the member's own exportable rows (e.g.
                      Notifications) — export is read-only, so it is offered even where delete is not. */}
                  {service.exportable ? (
                    <ExportButton service={service} isExporting={exportingKey === service.slug} tokens={tokens} onExportService={onExportService} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}

function MobileEmpty({ retained, tokens }: { retained: AccountService[]; tokens: AccountDataTokens }) {
  const { BRAND, TEXT, SUBTLE } = tokens;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 4px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: `${BRAND}08`, border: `1px dashed ${BRAND}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Shield size={24} color={`${BRAND}50`} />
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: TEXT, marginBottom: 8 }}>No personal data stored yet</div>
      <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6, marginBottom: 20 }}>
        As you use Survivor Hub apps, any personal data they hold will appear here for you to see and delete.
      </div>
      {retained.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px', borderRadius: 12, background: `${BRAND}05`, border: `1px solid ${BRAND}15`, width: '100%', textAlign: 'left' }}>
          <Info size={13} color={BRAND} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5 }}>
            ServiceCredits ledger and community totals are always retained for financial integrity. They hold no personal identifiers.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileDanger({ serviceCount, onOpenAccountDelete, tokens }: { serviceCount: number; onOpenAccountDelete: () => void; tokens: AccountDataTokens }) {
  const { TEXT } = tokens;
  return (
    <div>
      <div style={{ padding: '18px', borderRadius: 14, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <AlertTriangle size={16} color="#EF4444" />
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Delete Entire Account</span>
        </div>
        <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 14 }}>
          Removes your profile and all personal data across all {serviceCount} services. Your ServiceCredits are settled — not destroyed. Some audit records are retained by design.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {([
            { t: 'All personal data permanently deleted', warn: true },
            { t: 'ServiceCredits settled via standard process', warn: false },
            { t: 'Audit records retained (by design)', warn: false },
            { t: 'Profile removed from all directories', warn: true },
          ]).map(({ t, warn }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: warn ? '#EF4444' : '#4B5563', flexShrink: 0, marginTop: 5 }} />
              <span style={{ color: warn ? '#F87171' : '#9CA3AF', lineHeight: 1.4 }}>{t}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenAccountDelete}
          style={{ width: '100%', padding: '11px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <AlertTriangle size={14} /> Continue to confirmation <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
