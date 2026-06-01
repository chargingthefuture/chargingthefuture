'use client';

// Moderation queue (functional admin surface, generic Tailwind aesthetic — consistent with
// other /admin/{plugin} surfaces). Submitter identity is never shown; admins moderate content.
import type { WhatWorksProductStatus } from 'lib/whatworks/types';
import type { AdminProduct } from './ww-admin-shared';

type Props = {
  products: AdminProduct[];
  busyId: string | null;
  statusFilter: WhatWorksProductStatus | 'all';
  onChangeFilter: (status: WhatWorksProductStatus | 'all') => void;
  onReview: (id: string, action: 'approve' | 'reject') => void;
  onDelete: (id: string) => void;
};

const FILTERS: { value: WhatWorksProductStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS_CLASS: Record<WhatWorksProductStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export function WhatWorksAdminProducts({ products, busyId, statusFilter, onChangeFilter, onReview, onDelete }: Props) {
  return (
    <section className="rounded-lg border bg-card p-5 text-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Suggestions</h2>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => onChangeFilter(filter.value)}
              className={`rounded-md border px-3 py-1 text-xs font-medium ${statusFilter === filter.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground">No suggestions in this view.</p>
      ) : (
        <ul className="space-y-3">
          {products.map((product) => (
            <li key={product.id} className="rounded-lg border bg-background/40 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{product.emoji || '🧰'}</span>
                    <span className="font-semibold">{product.name}</span>
                    {product.kind ? <span className="text-xs text-muted-foreground">{product.kind}</span> : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Problem: {product.problemTitle}</p>
                  {product.note ? <p className="text-sm mt-1 italic text-muted-foreground">“{product.note}”</p> : null}
                  <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-4 break-all">
                    {product.purchaseUrl}
                  </a>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${STATUS_CLASS[product.status]}`}>{product.status}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground mr-auto">{product.verifiedCount} verified</span>
                {product.status !== 'approved' ? (
                  <button type="button" disabled={busyId === product.id} onClick={() => onReview(product.id, 'approve')} className="rounded-md border border-lime-500/40 bg-lime-500/10 px-3 py-1 text-xs font-medium text-lime-300 disabled:opacity-50">Approve</button>
                ) : null}
                {product.status !== 'rejected' ? (
                  <button type="button" disabled={busyId === product.id} onClick={() => onReview(product.id, 'reject')} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 disabled:opacity-50">{product.status === 'approved' ? 'Unpublish' : 'Reject'}</button>
                ) : null}
                <button type="button" disabled={busyId === product.id} onClick={() => onDelete(product.id)} className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300 disabled:opacity-50">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
