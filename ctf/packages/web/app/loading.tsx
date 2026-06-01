import styles from './loading.module.css';

// App-wide loading screen shown while any route segment streams. Matches the
// canonical loading design in the design/ submodule (HubLoading.tsx).
export default function Loading() {
  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <div className={`${styles.line} ${styles.lineLead}`}>Exit Their Economy</div>
        <div className={styles.line}>Exit The Psyop</div>
      </div>
    </div>
  );
}
