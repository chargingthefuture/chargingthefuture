// Layout styles shared by the survey's public surfaces, kept out of the shells so each shell
// reads as a description of its page rather than a wall of style objects.

import type { CSSProperties } from 'react';
import type { SurveyTokens } from './survey-theme';

export const columnStyle: CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '28px 16px 56px',
};

export function pageStyle(t: SurveyTokens): CSSProperties {
  return {
    minHeight: '100dvh',
    background: t.BG,
    color: t.TITLE,
    fontFamily: "'Inter',system-ui,sans-serif",
  };
}

export function cardStyle(t: SurveyTokens): CSSProperties {
  return {
    marginTop: 16,
    borderRadius: 14,
    background: t.HEADER,
    border: `1px solid ${t.BORDER_SOLID}`,
    padding: 16,
  };
}

export function cardTitleStyle(t: SurveyTokens): CSSProperties {
  return { fontSize: 15, fontWeight: 700, margin: '0 0 10px', color: t.TITLE };
}

export function choiceChipStyle(t: SurveyTokens, active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
    borderRadius: 10,
    border: `1px solid ${active ? t.ACCENT : t.BORDER_SOLID}`,
    background: active ? `${t.ACCENT}22` : t.INPUT_BG,
    color: t.TEXT,
    fontSize: 14,
    cursor: 'pointer',
  };
}

export function secondaryButtonStyle(t: SurveyTokens): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    padding: '10px 14px',
    borderRadius: 10,
    background: 'transparent',
    border: `1px solid ${t.BORDER_SOLID}`,
    color: t.TEXT,
    fontSize: 14,
    cursor: 'pointer',
  };
}

export function primaryButtonStyle(t: SurveyTokens, disabled: boolean): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    marginTop: 22,
    padding: '15px',
    borderRadius: 12,
    background: disabled ? t.BORDER_SOLID : t.ACCENT,
    border: 'none',
    color: disabled ? t.MUTED : '#0F1117',
    fontSize: 16,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export function errorStyle(t: SurveyTokens): CSSProperties {
  return {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    border: '1px solid #B91C1C',
    background: '#B91C1C22',
    color: t.TEXT,
    fontSize: 14,
    lineHeight: 1.55,
  };
}
