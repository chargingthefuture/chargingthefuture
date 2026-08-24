'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccountDataTokens } from './account-data-shared';
import type { AccountDataView, AccountService, AccountServicesResponse } from './account-data-shared';

// Loading and error states are intentionally NOT theme-aware: per COMIC_THEME_TOKENS.md §11 loading
// screens never adopt the comic theme, and the error state matches that default-dark treatment.
const { BG, TEXT } = getAccountDataTokens('default');
import { AccountDataMobile } from './account-data-mobile';
import { AccountDataConfirmDelete } from './account-data-confirm-delete';

type LoadState = 'loading' | 'ready' | 'error';

// Account & Data surface. Fetches the live service list from GET /api/account/services (a read-only
// projection of the deletion registry), lets the user delete one service at a time via
// DELETE /api/account/services/:slug, and delete the whole account via DELETE /api/account/full-account.
// Desktop and mobile share this state; the layout switches on useIsMobile().
export function AccountDataShell() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [deletable, setDeletable] = useState<AccountService[]>([]);
  const [retained, setRetained] = useState<AccountService[]>([]);
  const [view, setView] = useState<AccountDataView>('data');
  const [deletedSlugs, setDeletedSlugs] = useState<string[]>([]);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ slug: string; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Which export is in flight: a service slug, or 'full-account' for the download-all action.
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoadState('loading');
      try {
        const res = await fetch('/api/account/services', { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setLoadState('error');
          return;
        }
        const data = (await res.json()) as AccountServicesResponse;
        setDeletable(data.deletable ?? []);
        setRetained(data.retained ?? []);
        setLoadState('ready');
      } catch {
        if (!controller.signal.aborted) setLoadState('error');
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const handleDeleteService = useCallback(async (service: AccountService) => {
    // Two-step confirm gesture for a single service: the browser confirm dialog states exactly what
    // is removed before any request is sent. (Full-account deletion uses the stronger type-the-phrase
    // gesture in the modal.)
    const ok = window.confirm(
      `Delete your ${service.name} data?\n\n${service.summary}\n\nThis is permanent and cannot be undone. Some audit records may be retained for platform integrity. Your account stays open.`,
    );
    if (!ok) return;

    setPendingSlug(service.slug);
    setRowError(null);
    try {
      const res = await fetch(`/api/account/services/${encodeURIComponent(service.slug)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      });
      if (!res.ok) {
        let message = 'Unable to delete this data. Please try again.';
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // keep default message
        }
        setRowError({ slug: service.slug, message });
        return;
      }
      setDeletedSlugs((prev) => (prev.includes(service.slug) ? prev : [...prev, service.slug]));
    } catch {
      setRowError({ slug: service.slug, message: 'Network error. Please try again.' });
    } finally {
      setPendingSlug(null);
    }
  }, []);

  // Download a JSON export (issue #1264): fetch the export route, then hand the payload to the
  // browser as a file download. fetch → blob (rather than a bare navigation) so a failure can show
  // an inline error instead of replacing the page with raw JSON.
  const downloadExport = useCallback(async (url: string, filename: string, key: string, errorSlug: string) => {
    setExportingKey(key);
    setRowError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let message = 'Unable to export this data. Please try again.';
        try {
          const body = (await res.json()) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // keep default message
        }
        setRowError({ slug: errorSlug, message });
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setRowError({ slug: errorSlug, message: 'Network error. Please try again.' });
    } finally {
      setExportingKey(null);
    }
  }, []);

  const handleExportService = useCallback((service: AccountService) => {
    const date = new Date().toISOString().slice(0, 10);
    void downloadExport(
      `/api/account/services/${encodeURIComponent(service.slug)}/export`,
      `ctf-account-data-${service.slug}-${date}.json`,
      service.slug,
      service.slug,
    );
  }, [downloadExport]);

  const handleExportAll = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    void downloadExport(
      '/api/account/full-account/export',
      `ctf-account-data-full-account-${date}.json`,
      'full-account',
      'full-account',
    );
  }, [downloadExport]);

  const handleConfirmFullAccount = useCallback(async () => {
    const res = await fetch('/api/account/full-account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
    });
    if (!res.ok) {
      let message = 'Unable to complete full-account deletion. Please try again.';
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }
  }, []);

  if (loadState === 'loading') {
    return <AccountDataLoadingState />;
  }

  if (loadState === 'error') {
    return <AccountDataErrorState />;
  }

  const layout = (
    <AccountDataMobile
      view={view}
      onViewChange={setView}
      deletable={deletable}
      retained={retained}
      deletedSlugs={deletedSlugs}
      pendingSlug={pendingSlug}
      rowError={rowError}
      exportingKey={exportingKey}
      onDeleteService={handleDeleteService}
      onExportService={handleExportService}
      onExportAll={handleExportAll}
      onOpenAccountDelete={() => setConfirmOpen(true)}
    />
  );

  return (
    <>
      <style>{'@keyframes account-data-spin{to{transform:rotate(360deg)}}.account-data-spin{animation:account-data-spin 0.8s linear infinite}'}</style>
      {layout}
      {confirmOpen ? (
        <AccountDataConfirmDelete
          serviceCount={deletable.length + retained.length}
          isMobile={true}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirmFullAccount}
        />
      ) : null}
    </>
  );
}

function AccountDataLoadingState() {
  return (
    <div style={{ display: 'flex', height: '100dvh', background: BG, alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',system-ui" }}>
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', fontWeight: 500, marginBottom: 16, lineHeight: 2 }}>EXIT THEIR ECONOMY</div>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', fontWeight: 500, lineHeight: 2 }}>EXIT THE PSYOP</div>
      </div>
    </div>
  );
}

function AccountDataErrorState() {
  return (
    <div style={{ display: 'flex', height: '100dvh', background: BG, color: TEXT, alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',system-ui", padding: '0 32px' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>We couldn&apos;t load your data right now</div>
        <div style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.6 }}>Please refresh the page to try again. Your data and deletion controls will be here.</div>
      </div>
    </div>
  );
}
