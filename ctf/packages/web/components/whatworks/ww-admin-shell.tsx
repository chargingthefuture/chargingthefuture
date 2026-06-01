'use client';

// Functional WhatWorks admin: moderate suggestions (approve / reject / delete) and curate
// the admin-owned problem categories. Generic admin aesthetic, consistent with other
// /admin/{plugin} surfaces. Mutations carry the CSRF header via adminMutate().
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { WhatWorksProductStatus } from 'lib/whatworks/types';
import { adminMutate, type AdminProblem, type AdminProduct } from './ww-admin-shared';
import { WhatWorksAdminProducts } from './ww-admin-products';
import { WhatWorksAdminProblems } from './ww-admin-problems';

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
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">WhatWorks Admin</h1>
        <p className="text-sm text-muted-foreground">
          Curate problem categories and review survivor-suggested tools before they join the one shared list.
        </p>
        <p className="text-sm">
          <Link className="underline underline-offset-4" href="/apps/whatworks">Open the WhatWorks list</Link>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs text-muted-foreground">Problems</p>
          <p className="text-2xl font-semibold">{problems.length}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs text-muted-foreground">Pending review</p>
          <p className="text-2xl font-semibold">{pendingCount}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-xs text-muted-foreground">Approved tools</p>
          <p className="text-2xl font-semibold">{approvedCount}</p>
        </article>
      </section>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
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
            onToggleActive={toggleProblemActive}
            onDelete={deleteProblem}
          />
        </>
      )}
    </main>
  );
}
