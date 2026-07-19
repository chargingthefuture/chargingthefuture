import { PublicPageNav } from '@/components/shared/public-page-nav';
import type { Metadata } from 'next';
import { OPERATOR_NAME, CONTACT_EMAIL } from '../terms/policy-content';
import styles from './accessibility.module.css';

// Public Accessibility Statement at /accessibility. Static server component
// with no auth gate, so it is reachable by signed-out visitors (the
// middleware only sets identity headers and never protects routes). This is
// the page any public accessibility claim (landing page, marketing) points to.
// The developer source of truth it summarizes is
// ctf/docs/developer/ACCESSIBILITY_STATEMENT.md — keep the two in step:
// when the status or the "last reviewed" date changes there, change it here.

export const metadata: Metadata = {
  title: 'Accessibility — Charging the Future',
  description:
    'How Charging the Future works toward WCAG 2.2 AA accessibility, where it stands today, and how to report a problem.',
};

const LAST_REVIEWED = 'July 11, 2026';

export default function AccessibilityPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PublicPageNav />
        <header className={styles.header}>
          <p className={styles.brand}>Charging the Future</p>
          <h1 className={styles.title}>Accessibility</h1>
          <p className={styles.updated}>Last reviewed: {LAST_REVIEWED}</p>
          <p className={styles.lead}>
            We want everyone in our community to be able to use this product, including people who use
            a screen reader, a keyboard instead of a mouse, larger text, or other assistive technology.
            This page explains the standard we build to, where we stand today, and how to tell us about
            a problem.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="goal">
          <h2 id="goal" className={styles.sectionHeading}>
            The standard we build to
          </h2>
          <p className={styles.paragraph}>
            We aim to meet WCAG 2.2 Level AA on both the web app and the Android app. WCAG (the Web
            Content Accessibility Guidelines) is the international standard for making digital products
            usable by people with disabilities; Level AA is the bar that laws and regulators commonly
            reference. Where we can go further without making the rest of the experience worse, we do —
            for example higher color contrast on key text and plain, low-reading-level wording.
          </p>
          <p className={styles.paragraph}>
            We do not claim Level AAA across the whole product. The guidelines themselves advise against
            requiring AAA for an entire site, and a few AAA rules cannot be met for our live and
            recorded audio and video features.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="today">
          <h2 id="today" className={styles.sectionHeading}>
            Where we stand today
          </h2>
          <p className={styles.paragraph}>
            We are working toward WCAG 2.2 AA; we have not finished a full audit yet, so we describe
            this as an aim rather than a finished guarantee. So far we have run an automated check of
            the web app&apos;s screens and fixed the large majority of what it found — every form
            control now has a clear label tied to it, and clickable cards, lists, and filters can be
            operated with the keyboard, not only the mouse.
          </p>
          <p className={styles.paragraph}>
            Still to come: a full review of every screen with accessibility testing tools, a review of
            the Android app with its screen reader (TalkBack), and hands-on testing with screen readers
            and keyboard-only use on the core tasks.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="known">
          <h2 id="known" className={styles.sectionHeading}>
            Known limitations
          </h2>
          <p className={styles.paragraph}>These are the gaps we already know about:</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              A few pop-up dialogs can be closed by clicking the dark area behind them. Keyboard users
              can always close the same dialogs with the Escape key or the visible close button.
            </li>
            <li className={styles.listItem}>
              Some recorded video does not have captions yet. Adding captions to recordings is planned.
            </li>
            <li className={styles.listItem}>
              Color contrast, focus order, and screen-reader announcements have not yet been fully
              reviewed on every screen. That review is in progress.
            </li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="report">
          <h2 id="report" className={styles.sectionHeading}>
            Report a problem
          </h2>
          <p className={styles.paragraph}>
            If something is hard or impossible to use, tell us and we will treat it as a real bug, not a
            nice-to-have. Email{' '}
            <a className={styles.link} href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{' '}
            and, if you can, include the screen you were on, what you were trying to do, the assistive
            technology you were using (for example a screen reader, keyboard only, or screen
            magnifier), and what went wrong.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="maintain">
          <h2 id="maintain" className={styles.sectionHeading}>
            How we keep this current
          </h2>
          <p className={styles.paragraph}>
            An automated accessibility check runs on every change to the app so common problems cannot
            slip back in. We re-check the core tasks by hand as the product changes and update this
            page&apos;s date and the list above when the status changes.
          </p>
        </section>

        <footer className={styles.footer}>{OPERATOR_NAME}</footer>
      </div>
    </main>
  );
}
