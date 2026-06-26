'use client';

// Moderation queue (functional admin surface, dark admin design system — accent lime).
// Submitter identity is never shown; admins moderate content.
import { CheckCircle, XCircle, Trash2 } from 'lucide-react';
import type { WhatWorksProductStatus } from 'lib/what-works/types';
import type { AdminProduct } from './ww-admin-shared';

const COLOR = '#84CC16';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

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

const STATUS_STYLE: Record<WhatWorksProductStatus, { bg: string; color: string; border: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  approved: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444', border: 'rgba(239,68,68,0.3)' },
};

export function WhatWorksAdminProducts({ products, busyId, statusFilter, onChangeFilter, onReview, onDelete }: Props) {
  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: TEXT, margin: 0 }}>Suggestions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => onChangeFilter(filter.value)}
                aria-pressed={active}
                style={{ padding: '6px 14px', borderRadius: 8, background: active ? COLOR : SURFACE, border: `1px solid ${active ? COLOR : BORDER}`, color: active ? '#0F1117' : SUBTLE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {products.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14, borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
          No suggestions in this view.
        </div>
      ) : (
        products.map((product) => {
          const busy = busyId === product.id;
          const status = STATUS_STYLE[product.status];
          return (
            <div key={product.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span aria-hidden>{product.emoji || '🧰'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{product.name}</span>
                    {product.kind ? <span style={{ fontSize: 12, color: SUBTLE }}>{product.kind}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: SUBTLE, marginTop: 4 }}>Problem: {product.problemTitle}</div>
                  {product.note ? <div style={{ fontSize: 13, color: SUBTLE, fontStyle: 'italic', marginTop: 4 }}>“{product.note}”</div> : null}
                  <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 4, fontSize: 12, color: COLOR, textDecoration: 'underline', textUnderlineOffset: 4, wordBreak: 'break-all' }}>
                    {product.purchaseUrl}
                  </a>
                </div>
                <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>{product.status}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <span style={{ fontSize: 12, color: SUBTLE, marginRight: 'auto' }}>{product.verifiedCount} verified</span>
                {product.status !== 'approved' ? (
                  <button type="button" disabled={busy} onClick={() => onReview(product.id, 'approve')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <CheckCircle size={13} /> Approve
                  </button>
                ) : null}
                {product.status !== 'rejected' ? (
                  <button type="button" disabled={busy} onClick={() => onReview(product.id, 'reject')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                    <XCircle size={13} /> {product.status === 'approved' ? 'Unpublish' : 'Reject'}
                  </button>
                ) : null}
                <button type="button" disabled={busy} onClick={() => onDelete(product.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
