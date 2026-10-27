'use client';

import { SE_ME_WORDS as W, SE_THEME_COLORS, SE_THEME_LABELS, SE_THEME_MODES, seTheme, type SeThemeChoice } from '@ctf/shared';
import styles from './me.module.css';

// The wallpaper colors, each dark or light. The swatch shows the color's own background and button.
export function ThemePicker({ theme, onChange }: { theme: SeThemeChoice; onChange: (_next: SeThemeChoice) => void }) {
  return (
    <div className={styles.picker}>
      <p className={styles.subLabel}>{W.theme}</p>
      <div className={styles.row} role="radiogroup" aria-label={W.theme}>
        {SE_THEME_COLORS.map((color) => {
          const look = seTheme(color, theme.mode);
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={theme.color === color}
              className={styles.swatch}
              onClick={() => onChange({ ...theme, color })}
            >
              <span className={styles.swatchDot} style={{ background: look.bg, borderColor: look.btn }} aria-hidden="true" />
              {SE_THEME_LABELS[color]}
            </button>
          );
        })}
      </div>
      <div className={styles.row} role="radiogroup" aria-label="Dark or light">
        {SE_THEME_MODES.map((mode) => (
          <button key={mode} type="button" role="radio" aria-checked={theme.mode === mode} className={styles.swatch} onClick={() => onChange({ ...theme, mode })}>
            {mode === 'dark' ? W.dark : W.light}
          </button>
        ))}
      </div>
      <p className={styles.text}>{W.themeText}</p>
    </div>
  );
}
