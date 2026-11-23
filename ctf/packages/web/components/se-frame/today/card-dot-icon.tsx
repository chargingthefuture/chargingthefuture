import { SE_CARD_DOT_CHECK, seCardDotIcon, type SeCardAccent } from '@ctf/shared';

// What a Today card's timeline dot shows (shared/today/dot-icons.ts): the icon of its kind, as on
// the approved Today board, or the check mark once the card is done.
export function CardDotIcon({ kind, done = false }: { kind: SeCardAccent; done?: boolean }) {
  if (done) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--se-on-kind, var(--se-bg))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={SE_CARD_DOT_CHECK} />
      </svg>
    );
  }
  const icon = seCardDotIcon(kind);
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--se-on-kind, var(--se-bg))" strokeWidth={icon.strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icon.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
