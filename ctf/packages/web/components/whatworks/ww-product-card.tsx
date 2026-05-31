'use client';

// A single survivor-verified tool card from design/.../survivor-hub/WhatWorks.tsx.
// "Helpful" is the live endorsement toggle; its tally renders as "N survivors verified".
import { ShieldCheck, ThumbsUp, ExternalLink } from 'lucide-react';
import { BRAND, BORDER, SURFACE, SUBTLE, TEXT, type WhatWorksProduct } from './ww-shared';

type Props = {
  product: WhatWorksProduct;
  busy: boolean;
  onToggleHelpful: (product: WhatWorksProduct) => void;
};

export function WhatWorksProductCard({ product, busy, onToggleHelpful }: Props) {
  const endorsed = product.viewerHasEndorsed;
  return (
    <div style={{ display: 'flex', gap: 14, padding: '16px', borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ width: 52, height: 52, borderRadius: 11, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{product.emoji || '🧰'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: TEXT }}>{product.name}</span>
          {product.kind ? <span style={{ fontSize: 12, color: SUBTLE }}>{product.kind}</span> : null}
        </div>
        {product.note ? (
          <div style={{ fontSize: 13, color: '#C4CAD3', lineHeight: 1.55, marginTop: 6, fontStyle: 'italic' }}>“{product.note}”</div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: BRAND, fontWeight: 600 }}>
            <ShieldCheck size={13} /> {product.verifiedCount} survivors verified
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleHelpful(product)}
            aria-pressed={endorsed}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: endorsed ? BRAND : SUBTLE, fontWeight: endorsed ? 700 : 500, background: 'none', border: 'none', padding: 0, cursor: busy ? 'default' : 'pointer' }}
          >
            <ThumbsUp size={12} /> {endorsed ? 'Helped me' : 'Helpful'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
        <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, background: `${BRAND}18`, border: `1px solid ${BRAND}40`, color: BRAND, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          View product <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
