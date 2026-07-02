'use client';

import { useTheme } from '@/hooks/useTheme';
import type { ThemeName } from '@/lib/theme/theme-tokens';

const OPTIONS: { value: ThemeName; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'comic', label: 'Comic' },
];

// Minimal two-state segmented control for the app theme. Styled entirely from the
// shared CSS variables so it reads correctly in both themes. Used in the Account &
// Data settings surface.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="App theme"
      style={{
        display: 'inline-flex',
        border: '1.5px solid var(--ctf-border)',
        borderRadius: 'var(--ctf-control-radius)',
        overflow: 'hidden',
        background: 'var(--ctf-surface)',
      }}
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(option.value)}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--ctf-brand)' : 'transparent',
              color: active ? 'var(--ctf-brand-text)' : 'var(--ctf-text-subtle)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
