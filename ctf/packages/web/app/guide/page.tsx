import { PublicPageNav } from '@/components/shared/public-page-nav';
import type { Metadata } from 'next';
import guideData from './guide-content.json';
import type { UserGuide } from './guide-types';
import styles from './guide.module.css';

// Public user guide at /guide — a static server component with no auth gate, reachable by
// signed-out visitors (the middleware only sets identity headers and never protects routes), so the
// URL can be shared anywhere. One page: a jump-link table of contents, a section per app with its
// own "Last updated" date, and a "Back to top" return after each section. Content lives in the
// generated guide-content.json (see ctf/scripts/generate-user-guide.mjs); this file only renders it.
export const metadata: Metadata = {
  title: 'How to use it — Charging the Future',
  description:
    'A plain-language guide to every part of the Charging the Future community platform: what each app does and how to use it.',
};

const guide = guideData as UserGuide;

function formatDate(iso: string): string {
  // Render YYYY-MM-DD as a readable date without pulling in a date library; fall back to the raw
  // string if it is not the expected shape.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const [, year, month, day] = match;
  const monthName = months[Number(month) - 1] ?? month;
  return `${monthName} ${Number(day)}, ${year}`;
}

export default function GuidePage() {
  return (
    <main className={styles.page}>
      <div className={styles.container} id="top">
        <PublicPageNav />
        <header className={styles.header}>
          <p className={styles.brand}>Charging the Future</p>
          <h1 className={styles.title}>How to use it</h1>
          <p className={styles.updated}>Last updated: {formatDate(guide.updated)}</p>
          {guide.intro.map((para, i) => (
            <p key={i} className={styles.intro}>
              {para}
            </p>
          ))}
          <nav className={styles.toc} aria-label="On this page">
            <p className={styles.tocHeading}>On this page</p>
            <ul className={styles.tocList}>
              {guide.sections.map((section) => (
                <li key={section.id}>
                  <a className={styles.tocLink} href={`#${section.id}`}>
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        {guide.sections.map((section) => (
          <section key={section.id} id={section.id} className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <p className={styles.sectionUpdated}>Last updated: {formatDate(section.updated)}</p>
            </div>
            <p className={styles.summary}>{section.summary}</p>
            {section.body.map((para, i) => (
              <p key={i} className={styles.paragraph}>
                {para}
              </p>
            ))}
            {section.howTo && section.howTo.length > 0 ? (
              <div className={styles.howTo}>
                <p className={styles.howToHeading}>How to use it</p>
                <ol className={styles.howToList}>
                  {section.howTo.map((step, i) => (
                    <li key={i} className={styles.howToItem}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <a className={styles.backToTop} href="#top">
              Back to top ↑
            </a>
          </section>
        ))}

        <footer className={styles.footer}>
          Charging the Future ·{' '}
          <a className={styles.link} href="/terms">
            Terms &amp; Privacy
          </a>{' '}
          ·{' '}
          <a className={styles.link} href="/accessibility">
            Accessibility
          </a>
        </footer>
      </div>
    </main>
  );
}
