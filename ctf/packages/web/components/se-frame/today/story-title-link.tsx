import styles from './today.module.css';

// A blog story's title on a Today card, signed in and signed out alike: a link to the post on the
// blog, named by the post's title.
export function StoryTitleLink({ href, title }: { href: string; title: string }) {
  return (
    <a href={href} className={`${styles.cardTitle} ${styles.titleLink}`}>
      {title}
    </a>
  );
}
