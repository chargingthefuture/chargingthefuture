'use client';

// Functional WhatWorks admin: moderate suggestions (approve / reject / delete) and curate
// the admin-owned problem categories. Dark admin design system (shared admin look), accent lime.
// Mutations carry the CSRF header via adminMutate().
import { useCallback, useEffect, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import type { WhatWorksProductStatus } from 'lib/what-works/types';
import { adminMutate, type AdminProblem, type AdminProduct } from './ww-admin-shared';
import { getWhatWorksTokens } from './ww-shared';
import { WhatWorksAdminProducts } from './ww-admin-products';
import { WhatWorksAdminProblems } from './ww-admin-problems';
import { responseFailureText } from 'lib/errors/client-failure';

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <div style={{ flex: 1, minWidth: 92, padding: '10px 12px', borderRadius: 10, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? t.TITLE }}>{value}</div>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function WhatWorksAdminShell() {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [statusFilter, setStatusFilter] = useState<WhatWorksProductStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadProducts = useCallback(async (status: WhatWorksProductStatus | 'all') => {
    const query = status === 'all' ? '' : `?status=${status}`;
    const res = await fetch(`/api/what-works/admin/products${query}`);
    if (!res.ok) {
      throw new Error(await responseFailureText(res, 'Could not load suggestions.'));
    }
    const data = (await res.json()) as { products: AdminProduct[] };
    setProducts(data.products ?? []);
  }, []);

  const loadProblems = useCallback(async () => {
    const res = await fetch('/api/what-works/admin/problems');
    if (!res.ok) {
      throw new Error(await responseFailureText(res, 'Could not load problems.'));
    }
    const data = (await res.json()) as { problems: AdminProblem[] };
    setProblems(data.problems ?? []);
  }, []);

  useEffect(() => {
    // Initial load only (default filter is "pending"); later filter changes go through changeFilter.
    void (async () => {
      try {
        await Promise.all([loadProducts('pending'), loadProblems()]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load the admin data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProducts, loadProblems]);

  async function run(id: string, action: () => Promise<void>): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  function changeFilter(status: WhatWorksProductStatus | 'all'): void {
    setStatusFilter(status);
    setError(null);
    void loadProducts(status).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not load suggestions.');
    });
  }

  // Rejection reason now comes from an inline textarea in the products list (see ww-admin-products),
  // not a blocking window.prompt: it is themable, testable, and never blocks the main thread.
  function reviewProduct(id: string, action: 'approve' | 'reject', rejectionReason?: string): void {
    void run(id, async () => {
      const result = await adminMutate(`/api/what-works/admin/products/${id}`, 'PATCH', { action, rejectionReason });
      if (!result.ok) {
        setError(result.message ?? 'Could not update the suggestion.');
        return;
      }
      await Promise.all([loadProducts(statusFilter), loadProblems()]);
    });
  }

  // Correct an entry's own details (name, link, note, emoji, kind) after it is already approved,
  // without unpublishing it. Sends no `action`, so the products route takes its field-edit path.
  function editProduct(id: string, patch: { emoji: string; name: string; kind: string; note: string; purchaseUrl: string }): void {
    void run(id, async () => {
      const result = await adminMutate(`/api/what-works/admin/products/${id}`, 'PATCH', patch);
      if (!result.ok) {
        setError(result.message ?? 'Could not update the tool.');
        return;
      }
      await Promise.all([loadProducts(statusFilter), loadProblems()]);
    });
  }

  // Delete confirmation is now an inline step inside the products/problems lists (themable and
  // testable), not a blocking window.confirm.
  function deleteProduct(id: string): void {
    void run(id, async () => {
      const result = await adminMutate(`/api/what-works/admin/products/${id}`, 'DELETE');
      if (!result.ok) {
        setError(result.message ?? 'Could not delete the suggestion.');
        return;
      }
      await Promise.all([loadProducts(statusFilter), loadProblems()]);
    });
  }

  async function createProblem(draft: { emoji: string; title: string; context: string }): Promise<boolean> {
    setCreating(true);
    setError(null);
    try {
      const result = await adminMutate('/api/what-works/admin/problems', 'POST', draft);
      if (!result.ok) {
        setError(result.message ?? 'Could not create the problem.');
        return false;
      }
      await loadProblems();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the problem.');
      return false;
    } finally {
      setCreating(false);
    }
  }

  function toggleProblemActive(problem: AdminProblem): void {
    void run(problem.id, async () => {
      const result = await adminMutate(`/api/what-works/admin/problems/${problem.id}`, 'PATCH', { isActive: !problem.is_active });
      if (!result.ok) {
        setError(result.message ?? 'Could not update the problem.');
        return;
      }
      await loadProblems();
    });
  }

  async function editProblem(problem: AdminProblem, patch: { emoji: string; title: string; context: string }): Promise<boolean> {
    setBusyId(problem.id);
    setError(null);
    try {
      const result = await adminMutate(`/api/what-works/admin/problems/${problem.id}`, 'PATCH', {
        emoji: patch.emoji,
        title: patch.title,
        context: patch.context,
      });
      if (!result.ok) {
        setError(result.message ?? 'Could not update the problem.');
        return false;
      }
      await loadProblems();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the problem.');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function deleteProblem(problem: AdminProblem): void {
    void run(problem.id, async () => {
      const result = await adminMutate(`/api/what-works/admin/problems/${problem.id}`, 'DELETE');
      if (!result.ok) {
        setError(result.message ?? 'Could not delete the problem.');
        return;
      }
      await Promise.all([loadProblems(), loadProducts(statusFilter)]);
    });
  }

  const pendingCount = problems.reduce((total, problem) => total + problem.pendingCount, 0);
  const approvedCount = problems.reduce((total, problem) => total + problem.approvedCount, 0);

  return (
    <div
      style={{
        // Desktop locks html/body to 100vh + overflow:hidden (globals.css), so each admin shell must
        // own its vertical scroll or its lower rows are clipped and unreachable. On mobile the document
        // scrolls, so only set a min-height there. Matches the unlock / skills-hunt admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="WhatWorks Admin" accent={t.ACCENT} icon={<ThumbsUp size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/what-works" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* No in-page title card here: MobileScreenHeader above already names the screen and
            carries the icon, back control, and Member view. Repeating it cost a screen of phone
            height for no new information (owner report, 2026-07-27). */}

        {/* Snapshot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <StatBlock label="Problems" value={problems.length} />
          <StatBlock label="Pending review" value={pendingCount} accent="#F59E0B" />
          <StatBlock label="Approved tools" value={approvedCount} accent="#22C55E" />
        </div>

        {error ? (
          <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13 }}>{error}</div>
        ) : null}

        {loading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>Loading…</div>
        ) : (
          <>
            <WhatWorksAdminProducts
              products={products}
              busyId={busyId}
              statusFilter={statusFilter}
              onChangeFilter={changeFilter}
              onReview={reviewProduct}
              onEdit={editProduct}
              onDelete={deleteProduct}
            />
            <WhatWorksAdminProblems
              problems={problems}
              busyId={busyId}
              creating={creating}
              onCreate={createProblem}
              onEdit={editProblem}
              onToggleActive={toggleProblemActive}
              onDelete={deleteProblem}
            />
          </>
        )}
      </div>
    </div>
  );
}
