'use client';

import {
  SE_ME_LINKS,
  SE_SETTINGS_WORDS as W,
  SE_THEME_LABELS,
  SE_THEME_MODES,
  SE_THEME_ORDER,
  SE_THEME_SWATCHES,
  seThemeNote,
  type SeThemeChoice,
} from '@ctf/shared';
import { BackHeader } from './back-header';
import styles from './settings.module.css';

// Settings → Theme, built to the approved board "Theme": dark or light first, then the four colors
// (the same as the wallpapers), and where to get the wallpapers and the Android app. The choice is
// saved on the account.
export function ThemeScreen({ theme, onChange, onBack }: { theme: SeThemeChoice; onChange: (_next: SeThemeChoice) => void; onBack: () => void }) {
  return (
    <div className={styles.stack}>
      <BackHeader title={W.theme} back={W.backToSettings} onBack={onBack} />
      <div role="group" aria-label={W.lightOrDark} className={styles.segment}>
        {[...SE_THEME_MODES].map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={theme.mode === mode}
            className={styles.segmentButton}
            onClick={() => onChange({ ...theme, mode })}
          >
            {mode === 'dark' ? W.dark : W.light}
          </button>
        ))}
      </div>
      <p className={styles.note}>{W.sameColors}</p>
      <div className={styles.themes}>
        {SE_THEME_ORDER.map((color) => {
          const swatch = SE_THEME_SWATCHES[color];
          return (
            <button key={color} type="button" aria-pressed={theme.color === color} className={styles.themeButton} onClick={() => onChange({ ...theme, color })}>
              <span className={styles.swatch} style={{ background: swatch.bg }} aria-hidden="true">
                <span className={styles.dot} style={{ background: swatch.a }} />
                <span className={styles.dot} style={{ background: swatch.b }} />
              </span>
              <span className={styles.themeName}>{SE_THEME_LABELS[color]}</span>
              <span className={styles.themeNote}>{seThemeNote(color)}</span>
            </button>
          );
        })}
      </div>
      <section className={styles.group}>
        <h2 className={styles.groupTitle}>{W.get}</h2>
        <a href={SE_ME_LINKS.wallpapers} target="_blank" rel="noreferrer" className={styles.getLink}>
          {W.wallpapersIn} <span className={styles.grow} /> ↗
        </a>
        <a href={SE_ME_LINKS.androidApp} target="_blank" rel="noreferrer" className={styles.getLink}>
          {W.androidApp} <span className={styles.grow} /> ↗
        </a>
      </section>
    </div>
  );
}
