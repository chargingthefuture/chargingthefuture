import Link from "next/link";
import styles from "./plugin-shell.module.css";

type PluginShellProps = {
  title: string;
  subtitle: string;
  accentColor?: "teal" | "purple" | "blue" | "pink" | "orange" | "green" | "yellow" | "lime";
  children: React.ReactNode;
};

type PluginCardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

type PluginStatProps = {
  label: string;
  value: string | number;
  accentColor?: "teal" | "purple" | "blue" | "pink" | "orange" | "green" | "yellow" | "lime";
};

type PluginSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function PluginShell({
  title,
  subtitle,
  accentColor = "lime",
  children,
}: PluginShellProps) {
  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={`${styles.headerIcon} ${styles[`accent${capitalize(accentColor)}`]}`}>
              {title.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.subtitle}>{subtitle}</p>
            </div>
          </div>
          <nav className={styles.breadcrumb}>
            <Link href="/" className={styles.breadcrumbLink}>
              Home
            </Link>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbCurrent}>{title}</span>
          </nav>
        </header>

        {/* Content */}
        <div className={styles.content}>{children}</div>
      </div>
    </main>
  );
}

export function PluginCard({ title, children, className = "" }: PluginCardProps) {
  return (
    <article className={`${styles.card} ${className}`}>
      <h2 className={styles.cardTitle}>{title}</h2>
      <div className={styles.cardContent}>{children}</div>
    </article>
  );
}

export function PluginStat({ label, value, accentColor = "lime" }: PluginStatProps) {
  return (
    <article className={`${styles.stat} ${styles[`accent${capitalize(accentColor)}`]}`}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
    </article>
  );
}

export function PluginSection({ title, children }: PluginSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function PluginGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export function PluginList({ children }: { children: React.ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}

export function PluginListItem({
  title,
  subtitle,
  accentColor = "lime",
}: {
  title: string;
  subtitle?: string;
  accentColor?: "teal" | "purple" | "blue" | "pink" | "orange" | "green" | "yellow" | "lime";
}) {
  return (
    <li className={styles.listItem}>
      <div className={`${styles.listItemIcon} ${styles[`accent${capitalize(accentColor)}`]}`}>
        {title.charAt(0)}
      </div>
      <div className={styles.listItemContent}>
        <span className={styles.listItemTitle}>{title}</span>
        {subtitle && <span className={styles.listItemSubtitle}>{subtitle}</span>}
      </div>
    </li>
  );
}

export function PluginEmptyState({ message }: { message: string }) {
  return (
    <div className={styles.emptyState}>
      <p>{message}</p>
    </div>
  );
}

export function PluginAlert({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "success";
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.alert} ${styles[`alert${capitalize(type)}`]}`} role="alert">
      {children}
    </div>
  );
}

export function PluginButton({
  variant = "primary",
  children,
  ...props
}: {
  variant?: "primary" | "secondary" | "subtle";
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${styles.button} ${styles[`button${capitalize(variant)}`]}`} {...props}>
      {children}
    </button>
  );
}

export function PluginInput({
  label,
  id,
  ...props
}: {
  label: string;
  id: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={styles.inputGroup}>
      <label htmlFor={id} className={styles.inputLabel}>
        {label}
      </label>
      <input id={id} className={styles.input} {...props} />
    </div>
  );
}

export function PluginSelect({
  label,
  id,
  children,
  ...props
}: {
  label: string;
  id: string;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={styles.inputGroup}>
      <label htmlFor={id} className={styles.inputLabel}>
        {label}
      </label>
      <select id={id} className={styles.select} {...props}>
        {children}
      </select>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
