import type { SeTodayCard } from '@ctf/shared';
import styles from './today.module.css';

// The large figures on a card that carries them (the Our numbers card on the approved board "More
// cards in Today"): each figure over its line, two to a row. They take the place of the title and
// text, which stay the card's name for a screen reader.
export function CardFigures({ card }: { card: SeTodayCard }) {
  if (!card.figures?.length) return null;
  return (
    <span className={styles.figures}>
      {card.figures.map((figure) => (
        <span key={figure.line} className={styles.figure}>
          <span className={styles.figureValue}>{figure.value}</span>
          <span className={styles.figureLine}>{figure.line}</span>
        </span>
      ))}
    </span>
  );
}
