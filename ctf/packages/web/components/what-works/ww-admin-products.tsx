'use client';

// Moderation queue (functional admin surface, dark admin design system — accent lime).
// Submitter identity is never shown; admins moderate content.
import { useState } from 'react';
import { Check, CheckCircle, Pencil, XCircle, Trash2, X } from 'lucide-react';
import type { WhatWorksProductStatus } from 'lib/what-works/types';
import {
  MAX_EMOJI_LENGTH,
  MAX_PRODUCT_KIND_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_PRODUCT_NOTE_LENGTH,
  MAX_PURCHASE_URL_LENGTH,
} from 'lib/what-works/constants';
import type { AdminProduct } from './ww-admin-shared';
import { useTheme } from '@/hooks/useTheme';
import { getWhatWorksTokens, type WhatWorksTokens } from './ww-shared';

const makeEditInputStyle = (t: WhatWorksTokens): React.CSSProperties => ({
  borderRadius: 8,
  background: t.HEADER,
  border: `1px solid ${t.BORDER_SOLID}`,
  color: t.TITLE,
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
});

export type ProductEditDraft = { emoji: string; name: string; kind: string; note: string; purchaseUrl: string };

type Props = {
  products: AdminProduct[];
  busyId: string | null;
  statusFilter: WhatWorksProductStatus | 'all';
  onChangeFilter: (status: WhatWorksProductStatus | 'all') => void;
  onReview: (id: string, action: 'approve' | 'reject', rejectionReason?: string) => void;
  onEdit: (id: string, patch: ProductEditDraft) => void;
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

type ReviewActionsProps = {
  t: WhatWorksTokens;
  product: AdminProduct;
  busy: boolean;
  confirming: boolean;
  onApprove: () => void;
  onOpenReject: () => void;
  onToggleEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

// Approve / reject-open / edit-toggle / delete row for one suggestion card.
function ProductReviewActions({ t, product, busy, confirming, onApprove, onOpenReject, onToggleEdit, onRequestDelete, onConfirmDelete, onCancelDelete }: ReviewActionsProps) {
  const busyCursor = busy ? 'not-allowed' : 'pointer';
  const busyOpacity = busy ? 0.6 : 1;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <span style={{ fontSize: 12, color: t.MUTED, marginRight: 'auto' }}>{product.verifiedCount} verified</span>
      {product.status !== 'approved' ? (
        <button type="button" disabled={busy} onClick={onApprove} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
          <CheckCircle size={13} /> Approve
        </button>
      ) : null}
      {product.status !== 'rejected' ? (
        <button type="button" disabled={busy} onClick={onOpenReject} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
          <XCircle size={13} /> {product.status === 'approved' ? 'Unpublish' : 'Reject'}
        </button>
      ) : null}
      <button type="button" disabled={busy} onClick={onToggleEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
        <Pencil size={13} /> Edit
      </button>
      {confirming ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: t.MUTED }}>Delete permanently?</span>
          <button type="button" disabled={busy} onClick={onConfirmDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
            <Trash2 size={13} /> Confirm
          </button>
          <button type="button" onClick={onCancelDelete} style={{ padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" disabled={busy} onClick={onRequestDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busyCursor, opacity: busyOpacity }}>
          <Trash2 size={13} /> Delete
        </button>
      )}
    </div>
  );
}

type RejectFormProps = {
  t: WhatWorksTokens;
  product: AdminProduct;
  busy: boolean;
  reason: string;
  setReason: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

// Inline reject form. Replaces the old blocking window.prompt with a themable, testable textarea.
function ProductRejectForm({ t, product, busy, reason, setReason, onCancel, onConfirm }: RejectFormProps) {
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <label htmlFor={`reject-reason-${product.id}`} style={{ display: 'block', fontSize: 12, color: t.MUTED, marginBottom: 6 }}>
        Reason (optional, shown only to admins)
      </label>
      <textarea
        id={`reject-reason-${product.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value.slice(0, MAX_PRODUCT_NOTE_LENGTH))}
        maxLength={MAX_PRODUCT_NOTE_LENGTH}
        rows={3}
        placeholder="Why is this being rejected?"
        style={{ width: '100%', resize: 'vertical', padding: '8px 10px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 13, fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: t.MUTED, marginRight: 'auto' }}>{reason.length}/{MAX_PRODUCT_NOTE_LENGTH}</span>
        <button type="button" onClick={onCancel} style={{ padding: '6px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={onConfirm} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          <XCircle size={13} /> {product.status === 'approved' ? 'Unpublish' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

type EditFormProps = {
  t: WhatWorksTokens;
  editInputStyle: React.CSSProperties;
  busy: boolean;
  draft: ProductEditDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProductEditDraft>>;
  onCancel: () => void;
  onSave: () => void;
};

// Inline edit of a tool's own details. The draft is seeded from the product and saved through the
// same route's field-edit PATCH; status and verified count are unchanged.
function ProductEditForm({ t, editInputStyle, busy, draft, setDraft, onCancel, onSave }: EditFormProps) {
  const canSave = Boolean(draft.name.trim()) && Boolean(draft.purchaseUrl.trim()) && !busy;
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: `${t.ACCENT}08`, border: `1px solid ${t.ACCENT}35` }}>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 10 }}>Correct this tool&apos;s details. Its status and verified count are unchanged.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input value={draft.emoji} onChange={(event) => setDraft((prev) => ({ ...prev, emoji: event.target.value.slice(0, MAX_EMOJI_LENGTH) }))} maxLength={MAX_EMOJI_LENGTH} placeholder="Emoji" aria-label="Edit emoji" style={{ ...editInputStyle, width: 80, flexShrink: 0 }} />
        <input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value.slice(0, MAX_PRODUCT_NAME_LENGTH) }))} maxLength={MAX_PRODUCT_NAME_LENGTH} placeholder="Product name" aria-label="Edit product name" style={{ ...editInputStyle, flex: 1, minWidth: 180 }} />
      </div>
      <input value={draft.kind} onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value.slice(0, MAX_PRODUCT_KIND_LENGTH) }))} maxLength={MAX_PRODUCT_KIND_LENGTH} placeholder="Type (e.g. Headphones)" aria-label="Edit product type" style={{ ...editInputStyle, width: '100%', marginTop: 8, boxSizing: 'border-box' }} />
      <input value={draft.purchaseUrl} onChange={(event) => setDraft((prev) => ({ ...prev, purchaseUrl: event.target.value.slice(0, MAX_PURCHASE_URL_LENGTH) }))} maxLength={MAX_PURCHASE_URL_LENGTH} placeholder="https://…" aria-label="Edit purchase link" inputMode="url" style={{ ...editInputStyle, width: '100%', marginTop: 8, boxSizing: 'border-box' }} />
      <textarea value={draft.note} onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value.slice(0, MAX_PRODUCT_NOTE_LENGTH) }))} maxLength={MAX_PRODUCT_NOTE_LENGTH} rows={2} placeholder="Why it works (optional)" aria-label="Edit note" style={{ ...editInputStyle, width: '100%', marginTop: 8, resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 11, color: t.MUTED, marginRight: 'auto' }}>{draft.note.length}/{MAX_PRODUCT_NOTE_LENGTH}</span>
        <button type="button" onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <X size={13} /> Cancel
        </button>
        <button type="button" disabled={!canSave} onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: `${t.ACCENT}20`, border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.6 }}>
          <Check size={13} /> {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

type ProductCardProps = {
  t: WhatWorksTokens;
  editInputStyle: React.CSSProperties;
  product: AdminProduct;
  busy: boolean;
  editingId: string | null;
  rejectingId: string | null;
  confirmingDeleteId: string | null;
  reason: string;
  setReason: (value: string) => void;
  draft: ProductEditDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProductEditDraft>>;
  onApprove: () => void;
  onOpenReject: () => void;
  onCloseReject: () => void;
  onConfirmReject: () => void;
  onToggleEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

// One suggestion card: header, review actions, and the inline reject / edit forms.
function ProductCard({ t, editInputStyle, product, busy, editingId, rejectingId, confirmingDeleteId, reason, setReason, draft, setDraft, onApprove, onOpenReject, onCloseReject, onConfirmReject, onToggleEdit, onCancelEdit, onSaveEdit, onRequestDelete, onConfirmDelete, onCancelDelete }: ProductCardProps) {
  const status = STATUS_STYLE[product.status];
  return (
    <div style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span aria-hidden>{product.emoji || '🧰'}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>{product.name}</span>
            {product.kind ? <span style={{ fontSize: 12, color: t.MUTED }}>{product.kind}</span> : null}
          </div>
          <div style={{ fontSize: 12, color: t.MUTED, marginTop: 4 }}>Problem: {product.problemTitle}</div>
          {product.note ? <div style={{ fontSize: 13, color: t.MUTED, fontStyle: 'italic', marginTop: 4 }}>“{product.note}”</div> : null}
          <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 4, fontSize: 12, color: t.ACCENT, textDecoration: 'underline', textUnderlineOffset: 4, wordBreak: 'break-all' }}>
            {product.purchaseUrl}
          </a>
        </div>
        <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>{product.status}</span>
      </div>
      <ProductReviewActions
        t={t}
        product={product}
        busy={busy}
        confirming={confirmingDeleteId === product.id}
        onApprove={onApprove}
        onOpenReject={onOpenReject}
        onToggleEdit={onToggleEdit}
        onRequestDelete={onRequestDelete}
        onConfirmDelete={onConfirmDelete}
        onCancelDelete={onCancelDelete}
      />
      {rejectingId === product.id ? (
        <ProductRejectForm t={t} product={product} busy={busy} reason={reason} setReason={setReason} onCancel={onCloseReject} onConfirm={onConfirmReject} />
      ) : null}
      {editingId === product.id ? (
        <ProductEditForm t={t} editInputStyle={editInputStyle} busy={busy} draft={draft} setDraft={setDraft} onCancel={onCancelEdit} onSave={onSaveEdit} />
      ) : null}
    </div>
  );
}

export function WhatWorksAdminProducts({ products, busyId, statusFilter, onChangeFilter, onReview, onEdit, onDelete }: Props) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  const editInputStyle = makeEditInputStyle(t);
  // Which row's inline reject form is open, and the reason text being typed. Replaces the old
  // blocking window.prompt with a themable, testable inline textarea.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  // Inline two-step delete confirmation (replaces window.confirm).
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  // Inline edit of an approved (or any) tool's own details. editingId marks the open card; the
  // draft is seeded from the product and saved through the same route's field-edit PATCH.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductEditDraft>({ emoji: '', name: '', kind: '', note: '', purchaseUrl: '' });

  function openReject(id: string): void {
    setRejectingId(id);
    setReason('');
  }

  function closeReject(): void {
    setRejectingId(null);
    setReason('');
  }

  function confirmReject(id: string): void {
    const trimmed = reason.trim();
    onReview(id, 'reject', trimmed.length > 0 ? trimmed : undefined);
    closeReject();
  }

  function openEdit(product: AdminProduct): void {
    setEditingId(product.id);
    setDraft({
      emoji: product.emoji ?? '',
      name: product.name,
      kind: product.kind ?? '',
      note: product.note ?? '',
      purchaseUrl: product.purchaseUrl,
    });
  }

  function saveEdit(id: string): void {
    onEdit(id, {
      emoji: draft.emoji.trim(),
      name: draft.name.trim(),
      kind: draft.kind.trim(),
      note: draft.note.trim(),
      purchaseUrl: draft.purchaseUrl.trim(),
    });
    setEditingId(null);
  }

  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: t.TITLE, margin: 0 }}>Suggestions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => onChangeFilter(filter.value)}
                aria-pressed={active}
                style={{ padding: '6px 14px', borderRadius: 8, background: active ? t.ACCENT : t.SURFACE, border: `1px solid ${active ? t.ACCENT : t.BORDER_SOLID}`, color: active ? t.BG : t.MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {products.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14, borderRadius: 12, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}` }}>
          No suggestions in this view.
        </div>
      ) : (
        products.map((product) => {
          const busy = busyId === product.id;
          return (
            <ProductCard
              key={product.id}
              t={t}
              editInputStyle={editInputStyle}
              product={product}
              busy={busy}
              editingId={editingId}
              rejectingId={rejectingId}
              confirmingDeleteId={confirmingDeleteId}
              reason={reason}
              setReason={setReason}
              draft={draft}
              setDraft={setDraft}
              onApprove={() => onReview(product.id, 'approve')}
              onOpenReject={() => openReject(product.id)}
              onCloseReject={closeReject}
              onConfirmReject={() => confirmReject(product.id)}
              onToggleEdit={() => (editingId === product.id ? setEditingId(null) : openEdit(product))}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={() => saveEdit(product.id)}
              onRequestDelete={() => setConfirmingDeleteId(product.id)}
              onConfirmDelete={() => { setConfirmingDeleteId(null); onDelete(product.id); }}
              onCancelDelete={() => setConfirmingDeleteId(null)}
            />
          );
        })
      )}
    </section>
  );
}
