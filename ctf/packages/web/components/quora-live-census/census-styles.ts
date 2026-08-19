// Shared layout styles for the census admin screens.

import type { CSSProperties } from 'react';
import type { CensusTokens } from './census-theme';

export function pageStyle(t: CensusTokens): CSSProperties {
  return {
    minHeight: '100dvh',
    background: t.BG,
    color: t.TITLE,
    fontFamily: "'Inter',system-ui,sans-serif",
  };
}

export const columnStyle: CSSProperties = {
  maxWidth: 900,
  margin: '0 auto',
  padding: '28px 16px 56px',
};

export function cardStyle(t: CensusTokens): CSSProperties {
  return {
    marginTop: 14,
    borderRadius: 14,
    background: t.SURFACE,
    border: `1px solid ${t.BORDER_SOLID}`,
    padding: 16,
  };
}

export function labelStyle(t: CensusTokens): CSSProperties {
  return { display: 'block', fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 6 };
}

export function inputStyle(t: CensusTokens): CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 11px',
    borderRadius: 10,
    background: t.INPUT_BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    color: t.TEXT,
    fontSize: 14,
    fontFamily: 'inherit',
  };
}

export function buttonStyle(t: CensusTokens, primary = false): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '9px 14px',
    borderRadius: 10,
    background: primary ? t.ACCENT : 'transparent',
    border: `1px solid ${primary ? t.ACCENT : t.BORDER_SOLID}`,
    color: primary ? '#0F1117' : t.TEXT,
    fontSize: 14,
    fontWeight: primary ? 700 : 400,
    textDecoration: 'none',
    cursor: 'pointer',
  };
}

export function errorStyle(t: CensusTokens): CSSProperties {
  return {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    border: '1px solid #B91C1C',
    background: '#B91C1C22',
    color: t.TEXT,
    fontSize: 14,
    lineHeight: 1.55,
  };
}

export function mutedStyle(t: CensusTokens): CSSProperties {
  return { fontSize: 12, lineHeight: 1.55, color: t.MUTED, margin: '6px 0 0' };
}
