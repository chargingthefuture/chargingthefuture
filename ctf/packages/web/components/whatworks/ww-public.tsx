'use client';

// STATE: Unauthenticated — public visitor. The list is publicly readable (a teaser slice);
// suggesting is gated behind sign-in. Matched to design/.../survivor-hub/WhatWorksPublic.tsx.
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ListChecks, UserPlus, BadgeCheck, ExternalLink, ShieldCheck, Ban, Lock, ChevronRight,
} from 'lucide-react';
import {
  BG, BRAND, BORDER, SURFACE, SUBTLE, TEXT,
  type WhatWorksProblem, type WhatWorksStats,
} from './ww-shared';
import { WhatWorksLoading } from './ww-loading';

const TRUST: { icon: ReactNode; title: string; detail: string }[] = [
  { icon: <BadgeCheck size={15} color={BRAND} />, title: 'Survivor-verified', detail: 'Used by a real member who said it helped.' },
  { icon: <Ban size={15} color={BRAND} />, title: 'No ads or affiliates', detail: 'Nothing here is sponsored.' },
  { icon: <Lock size={15} color={BRAND} />, title: 'Anonymous', detail: 'Suggesting never reveals who you are.' },
];

export function WhatWorksPublic() {
  const [loading, setLoading] = useState(true);
  const [problems, setProblems] = useState<WhatWorksProblem[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/whatworks/public');
        if (res.ok) {
          const data = (await res.json()) as { problems: WhatWorksProblem[]; stats: WhatWorksStats };
          if (active) setProblems(data.problems ?? []);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return <WhatWorksLoading />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100%', background: BG, fontFamily: "'Inter',system-ui", color: TEXT, overflow: 'hidden' }}>
      <div style={{ height: 52, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10, flexShrink: 0, background: '#0D0F14' }}>
        <ListChecks size={18} color={BRAND} />
        <span style={{ fontSize: 16, fontWeight: 700 }}>What Works</span>
        <span style={{ fontSize: 12, color: SUBTLE, marginLeft: 4 }}>· survivor-verified tools</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link href="/sign-in" style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
          <Link href="/sign-up" style={{ padding: '7px 16px', borderRadius: 8, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <UserPlus size={13} /> Create Account
          </Link>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ padding: '44px 64px 28px', display: 'flex', gap: 48, alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ padding: '4px 14px', borderRadius: 20, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, fontSize: 12, color: BRAND, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
              <BadgeCheck size={13} /> One shared, survivor-verified list
            </span>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em' }}>
              The tools that<br /><span style={{ color: BRAND }}>actually work</span>.
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: '#9CA3AF', maxWidth: 520, lineHeight: 1.7 }}>
              Pick a problem you&apos;re facing. Underneath it is a list of specific products a survivor here bought, used, and said helped — each with a direct link to get it. No ads. No affiliates. Nothing sold.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <Link href="/sign-up" style={{ padding: '13px 28px', borderRadius: 10, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={16} /> Join to suggest items
              </Link>
            </div>
          </div>
          <div style={{ width: 260, flexShrink: 0 }}>
            <div style={{ padding: '18px', borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND, marginBottom: 14 }}>Why trust this list?</div>
              {TRUST.map((item) => (
                <div key={item.title} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 11.5, color: SUBTLE, lineHeight: 1.5 }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 64px 56px', maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>A look at the list</span>
            <span style={{ fontSize: 12, color: SUBTLE }}>· publicly readable — no account needed to browse</span>
          </div>

          {problems.length === 0 ? (
            <div style={{ fontSize: 13, color: SUBTLE, padding: '8px 0 24px' }}>The list is just getting started. Be the first to add what worked for you.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {problems.map((problem) => (
                <section key={problem.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{problem.emoji || '🧰'}</div>
                    <div style={{ flex: 1, paddingTop: 1 }}>
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>{problem.title}</h2>
                      {problem.context ? <div style={{ fontSize: 12.5, color: SUBTLE, lineHeight: 1.5, marginTop: 2 }}>{problem.context}</div> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {problem.products.map((product) => (
                      <div key={product.id} style={{ flex: 1, display: 'flex', gap: 12, padding: '14px', borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}` }}>
                        <div style={{ width: 46, height: 46, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{product.emoji || '🧰'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{product.name}</div>
                          {product.kind ? <div style={{ fontSize: 11.5, color: SUBTLE }}>{product.kind}</div> : null}
                          {product.note ? <div style={{ fontSize: 12.5, color: '#C4CAD3', lineHeight: 1.5, marginTop: 6, fontStyle: 'italic' }}>“{product.note}”</div> : null}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: BRAND, fontWeight: 600 }}>
                              <ShieldCheck size={12} /> {product.verifiedCount} verified
                            </span>
                            <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: BRAND, fontWeight: 700, textDecoration: 'none' }}>
                              View <ExternalLink size={11} />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div style={{ marginTop: 28, padding: '24px', borderRadius: 16, background: `${BRAND}08`, border: `1px solid ${BRAND}25`, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>See every problem — and add what worked for you</div>
              <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6 }}>Create a free, verified account to view the full list and suggest the tools that helped you.</div>
            </div>
            <Link href="/sign-up" style={{ padding: '13px 26px', borderRadius: 10, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              Get started <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
