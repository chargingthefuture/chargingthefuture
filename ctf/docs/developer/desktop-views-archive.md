# Desktop views — archive and restore

**Owner decision (2026-07-20 → collapse 2026-07-21): the app is mobile-first.** `useIsMobile()` is
pinned to `true`, so every shell renders its single phone-width layout at every viewport, inside the
centered `.ctf-phone-frame` column (see `globals.css`). There is no second (desktop) layout shown to
anyone.

Because of that pin, the old per-shell **desktop layout branches were already dead code** — the
`if (isMobile) return (<phone layout>)` guard is always taken, so the desktop `return` after it never
ran. The mobile-first collapse deletes those dead branches so there is only one layout to maintain
and the two copies can no longer drift.

## Where the desktop views are preserved

A lot of work went into the desktop layouts, so they are kept — as **restorable code**, which is
better than a screenshot (you can bring the real layout back, not just look at a picture).

- **Archive commit: `44ae66a`** on `main` (the last commit with every desktop branch intact,
  immediately before the collapse began). Git keeps this forever.

### View a single desktop view later

```bash
git show 44ae66a:ctf/packages/web/components/<plugin>/<plugin>-shell.tsx
```

The desktop layout is the JSX after the shell's `if (isMobile) return (...)` block (or the `: <desktop>`
side of an `isMobile ? <mobile> : <desktop>` expression).

### Restore desktop rendering for real

1. Change `useIsMobile()` in `ctf/packages/web/hooks/use-is-mobile.ts` back to a viewport check
   (the pre-pin version is in the same file's history).
2. Restore the desired shell's desktop branch from the archive commit above.

## Status

The collapse removes the dead desktop branches shell-by-shell across the ~90 shells that branched on
`isMobile`. Member-facing screens keep their phone layout unchanged; wide admin tables are rebuilt as
stacked cards (SkillsHunt moderation is the template — see `sha-table.tsx`).
