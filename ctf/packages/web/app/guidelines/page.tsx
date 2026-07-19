import { PublicPageFooter } from '@/components/shared/public-page-footer';
import { PublicPageNav } from '@/components/shared/public-page-nav';
import type { Metadata } from 'next';
import styles from '../terms/terms.module.css';
import { GUIDELINE_SECTIONS, GUIDELINES_EFFECTIVE_DATE, type GuidelineSection } from './guidelines-content';

// Public community discussion guidelines at /guidelines. Static, no auth — the operator
// links this page in-app (Commons footnote, gated channel, /terms footer) so a violation
// can always be answered with a citation instead of an argument. Reuses the /terms styling
// so the two policy pages read as one set.

export const metadata: Metadata = {
  title: 'Community Guidelines — Charging the Future',
  description: 'What discussions belong on the Charging the Future community platform, what does not, and how the rules are enforced.',
};

function GuidelineSectionView({ section }: { section: GuidelineSection }) {
  return (
    <section id={section.id} className={styles.document}>
      <h2 className={styles.documentTitle}>{section.heading}</h2>
      {section.blocks.map((block, index) =>
        block.type === 'p' ? (
          <p key={index} className={styles.paragraph}>{block.text}</p>
        ) : (
          <ul key={index} className={styles.list}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </section>
  );
}

export default function GuidelinesPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PublicPageNav />
        <header className={styles.header}>
          <p className={styles.brand}>Charging the Future</p>
          <h1 className={styles.title}>Community Guidelines</h1>
          <p className={styles.updated}>Last updated: {GUIDELINES_EFFECTIVE_DATE}</p>
        </header>

        {GUIDELINE_SECTIONS.map((section) => (
          <GuidelineSectionView key={section.id} section={section} />
        ))}

        <PublicPageFooter />
      </div>
    </main>
  );
}
