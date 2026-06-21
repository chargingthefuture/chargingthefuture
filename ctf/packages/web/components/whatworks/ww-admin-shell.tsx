'use client';

// Functional WhatWorks admin: moderate suggestions (approve / reject / delete) and curate
// the admin-owned problem categories. Dark admin design system (shared admin look), accent lime.
// Mutations carry the CSRF header via adminMutate().
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import type { WhatWorksProductStatus } from 'lib/whatworks/types';
import { adminMutate, type AdminProblem, type AdminProduct } from './ww-admin-shared';
import { WhatWorksAdminProducts } from './ww-admin-products';
import { WhatWorksAdminProblems } from './ww-admin-problems';

// Admin design tokens (shared admin look from the design system). WhatWorks accent is lime.
const COLOR = '#84CC16';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

function StatBlock({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 92, padding: '10px 12px', borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? TEXT }}>{value}</div>
      <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function WhatWorksAdminShell() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [statusFilter, setStatusFilter] = useState<WhatWorksProductStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadProducts = useCallback(async (status: WhatWorksProductStatus | 'all') => {
    const query = status === 'all' ? '' : `?status=${status}`;
    const res = await fetch(`/api/whatworks/admin/products${query}`);
    if (!res.ok) {
      throw new Error('Could not load suggestions.');
    }
    const data = (await res.json()) as { products: AdminProduct[] };
    setProducts(data.products ?? []);
  }, []);

  const loadProblems = useCallback(async () => {
    const res = await fetch('/api/whatworks/admin/problems');
    if (!res.ok) {
      throw new Error('Could not load problems.');
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

  function reviewProduct(id: string, action: 'approve' | 'reject'): void {
    const rejectionReason = action === 'reject' ? window.prompt('Reason (optional, shown only to admins):') ?? undefined : undefined;
    void run(id, async () => {
      const result = await adminMutate(`/api/whatworks/admin/products/${id}`, 'PATCH', { action, rejectionReason });
      if (!result.ok) {
        setError(result.message ?? 'Could not update the suggestion.');
        return;
      }
      await Promise.all([loadProducts(statusFilter), loadProblems()]);
    });
  }

  function deleteProduct(id: string): void {
    if (!window.confirm('Delete this suggestion permanently?')) return;
    void run(id, async () => {
      const result = await adminMutate(`/api/whatworks/admin/products/${id}`, 'DELETE');
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
      const result = await adminMutate('/api/whatworks/admin/problems', 'POST', draft);
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
      const result = await adminMutate(`/api/whatworks/admin/problems/${problem.id}`, 'PATCH', { isActive: !problem.is_active });
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
      const result = await adminMutate(`/api/whatworks/admin/problems/${problem.id}`, 'PATCH', {
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
    if (!window.confirm(`Delete “${problem.title}” and its ${problem.productCount} tool(s)? This cannot be undone.`)) return;
    void run(problem.id, async () => {
      const result = await adminMutate(`/api/whatworks/admin/problems/${problem.id}`, 'DELETE');
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
    <div style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: PANEL, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ThumbsUp size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>WhatWorks Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Entry moderation</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, color: '#6366F1', fontWeight: 700 }}>ADMIN</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Link href="/apps/whatworks" style={{ fontSize: 13, color: COLOR, textDecoration: 'underline', textUnderlineOffset: 4 }}>
            Open the WhatWorks list
          </Link>
        </div>

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
          <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>Loading…</div>
        ) : (
          <>
            <WhatWorksAdminProducts
              products={products}
              busyId={busyId}
              statusFilter={statusFilter}
              onChangeFilter={changeFilter}
              onReview={reviewProduct}
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
