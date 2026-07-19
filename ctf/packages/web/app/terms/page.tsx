import type { Metadata } from 'next';
import {
  POLICY_DOCUMENTS,
  EFFECTIVE_DATE,
  OPERATOR_NAME,
  CONTACT_EMAIL,
  type PolicyBlock,
  type PolicyDocument,
} from './policy-content';
import styles from './terms.module.css';

// Public Terms and Conditions + Privacy Policy at /terms. This is a static
// server component with no auth gate, so it is reachable by signed-out
// visitors (the middleware only sets identity headers and never protects
// routes). Content lives in ./policy-content.ts so this file stays a small
// renderer.
export const metadata: Metadata = {
  title: 'Terms & Privacy — Charging the Future',
  description:
    'Terms and Conditions and Privacy Policy for the Charging the Future community platform.',
};

function renderBlock(block: PolicyBlock, key: number) {
  if (block.type === 'p') {
    return (
      <p key={key} className={styles.paragraph}>
        {block.text}
      </p>
    );
  }
  if (block.type === 'h3') {
    return (
      <h4 key={key} className={styles.subHeading}>
        {block.text}
      </h4>
    );
  }
  return (
    <ul key={key} className={styles.list}>
      {block.items.map((item, i) => (
        <li key={i} className={styles.listItem}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function PolicyDoc({ doc }: { doc: PolicyDocument }) {
  return (
    <section className={styles.document} id={doc.id}>
      <h2 className={styles.documentTitle}>{doc.title}</h2>
      <p className={styles.intro}>{doc.intro}</p>
      {doc.sections.map((section) => (
        <div key={section.id} id={`${doc.id}-${section.id}`} className={styles.section}>
          <h3 className={styles.sectionHeading}>{section.heading}</h3>
          {section.blocks.map((block, i) => renderBlock(block, i))}
        </div>
      ))}
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.brand}>Charging the Future</p>
          <h1 className={styles.title}>Terms &amp; Privacy Policy</h1>
          <p className={styles.updated}>Last updated: {EFFECTIVE_DATE}</p>
          <nav className={styles.toc} aria-label="On this page">
            <p className={styles.tocHeading}>On this page</p>
            <ul className={styles.tocList}>
              {POLICY_DOCUMENTS.map((doc) => (
                <li key={doc.id}>
                  <a className={styles.tocLink} href={`#${doc.id}`}>
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        {POLICY_DOCUMENTS.map((doc) => (
          <PolicyDoc key={doc.id} doc={doc} />
        ))}

        <footer className={styles.footer}>
          {OPERATOR_NAME} · Contact{' '}
          <a className={styles.link} href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{' '}
          ·{' '}
          <a className={styles.link} href="/accessibility">
            Accessibility
          </a>{' '}
          ·{' '}
          <a className={styles.link} href="/guide">
            How to use it
          </a>{' '}
          ·{' '}
          <a className={styles.link} href="/guidelines">
            Community guidelines
          </a>
        </footer>
      </div>
    </main>
  );
}
