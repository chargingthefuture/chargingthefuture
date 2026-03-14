"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import type { PluginRegistryItem } from "@/src/lib/plugins/repository";
import styles from "./community-shell.module.css";

type CommunityShellProps = {
  initialPlugins: PluginRegistryItem[];
};

type PluginsApiPayload = {
  plugins?: PluginRegistryItem[];
};

// Plugin color mapping for visual diversity - trauma-informed, calming palette
const PLUGIN_COLORS: Record<
  string,
  { icon: string; card: string; accent: string }
> = {
  lighthouse: {
    icon: styles.pluginIconTeal,
    card: styles.featureCardTeal,
    accent: "teal",
  },
  trusttransport: {
    icon: styles.pluginIconBlue,
    card: styles.featureCardBlue,
    accent: "blue",
  },
  workforce: {
    icon: styles.pluginIconPurple,
    card: styles.featureCardPurple,
    accent: "purple",
  },
  "support-match": {
    icon: styles.pluginIconPink,
    card: styles.featureCardPink,
    accent: "pink",
  },
  directory: {
    icon: styles.pluginIconOrange,
    card: styles.featureCardOrange,
    accent: "orange",
  },
  socketrelay: {
    icon: styles.pluginIconGreen,
    card: styles.featureCardGreen,
    accent: "green",
  },
  gentlepulse: {
    icon: styles.pluginIconYellow,
    card: styles.featureCardYellow,
    accent: "yellow",
  },
  chyme: {
    icon: styles.pluginIconLime,
    card: styles.featureCardLime,
    accent: "lime",
  },
  "skills-hunt": {
    icon: styles.pluginIconTeal,
    card: styles.featureCardTeal,
    accent: "teal",
  },
  foundation: {
    icon: styles.pluginIconPurple,
    card: styles.featureCardPurple,
    accent: "purple",
  },
  "peer-programming": {
    icon: styles.pluginIconBlue,
    card: styles.featureCardBlue,
    accent: "blue",
  },
  gdp: {
    icon: styles.pluginIconGreen,
    card: styles.featureCardGreen,
    accent: "green",
  },
  "service-credits": {
    icon: styles.pluginIconYellow,
    card: styles.featureCardYellow,
    accent: "yellow",
  },
  mood: {
    icon: styles.pluginIconPink,
    card: styles.featureCardPink,
    accent: "pink",
  },
};

// Plugin icon letters for visual identity
const PLUGIN_ICONS: Record<string, string> = {
  lighthouse: "LH",
  trusttransport: "TT",
  workforce: "WF",
  "support-match": "SM",
  directory: "DR",
  socketrelay: "SR",
  gentlepulse: "GP",
  chyme: "CH",
  "skills-hunt": "SH",
  foundation: "FD",
  "peer-programming": "PP",
  gdp: "GDP",
  "service-credits": "SC",
  mood: "MD",
};

function getPluginColors(slug: string) {
  return (
    PLUGIN_COLORS[slug] || {
      icon: styles.pluginIconLime,
      card: styles.featureCardLime,
      accent: "lime",
    }
  );
}

function getPluginIcon(slug: string) {
  return PLUGIN_ICONS[slug] || slug.substring(0, 2).toUpperCase();
}

function getAvailabilityLabel(
  state: PluginRegistryItem["availabilityState"]
): string {
  return state === "implemented_shell" ? "Live" : "Coming Soon";
}

function getPluginHref(pluginSlug: string): string {
  return `/apps/${encodeURIComponent(pluginSlug)}`;
}

// Inspirational quotes for survivors - trauma-informed messaging
const INSPIRATIONAL_QUOTES = [
  {
    text: "You have survived 100% of your worst days. You are stronger than you know.",
    author: "Anonymous",
  },
  {
    text: "Healing is not linear, but every step forward matters.",
    author: "Community Wisdom",
  },
  {
    text: "Your story is not over. This is just a new chapter.",
    author: "Survivor Network",
  },
  {
    text: "You are not what happened to you. You are what you choose to become.",
    author: "Carl Jung",
  },
];

function ServerRail({ plugins }: { plugins: PluginRegistryItem[] }) {
  const corePlugins = plugins.filter(
    (p) => p.availabilityState === "implemented_shell"
  );

  return (
    <aside className={styles.serverRail} aria-label="Plugin servers">
      <Link
        className={`${styles.serverButton} ${styles.serverButtonActive}`}
        href="/"
        aria-label="Home"
        title="Home"
      >
        CTF
      </Link>

      <div className={styles.serverSpacer} />

      {corePlugins.slice(0, 6).map((plugin) => {
        const colors = getPluginColors(plugin.slug);
        return (
          <Link
            key={plugin.slug}
            className={styles.serverButton}
            href={getPluginHref(plugin.slug)}
            aria-label={plugin.name}
            title={plugin.name}
          >
            {getPluginIcon(plugin.slug).charAt(0)}
          </Link>
        );
      })}

      <div className={styles.serverSpacer} />

      <Link
        className={styles.serverButton}
        href="/admin"
        aria-label="Admin Panel"
        title="Admin Panel"
      >
        +
      </Link>
    </aside>
  );
}

function LeftNavigation({ plugins }: { plugins: PluginRegistryItem[] }) {
  return (
    <aside className={styles.leftNav} aria-label="Navigation">
      <div className={styles.appHeader}>
        <h1 className={styles.appTitle}>Survivor Hub</h1>
        <p className={styles.appSubtitle}>Safe Space - Invite Only</p>
      </div>

      <div className={styles.navSection}>
        <p className={styles.sectionTitle}>Mini-Apps</p>
        <ul className={styles.pluginList}>
          {plugins.slice(0, 12).map((plugin) => {
            const colors = getPluginColors(plugin.slug);
            return (
              <li key={plugin.slug}>
                <Link
                  className={styles.pluginButton}
                  href={getPluginHref(plugin.slug)}
                >
                  <span className={`${styles.pluginIcon} ${colors.icon}`}>
                    {getPluginIcon(plugin.slug)}
                  </span>
                  <span>{plugin.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.statusCard}>
        <p>Built for survivors, by survivors.</p>
        <p>
          {plugins.length} plugins available - {" "}
          {
            plugins.filter((p) => p.availabilityState === "implemented_shell")
              .length
          }{" "}
          active
        </p>
      </div>
    </aside>
  );
}

function PluginCard({ plugin }: { plugin: PluginRegistryItem }) {
  const colors = getPluginColors(plugin.slug);
  const isLive = plugin.availabilityState === "implemented_shell";

  return (
    <article className={`${styles.featureCard} ${colors.card}`}>
      <div className={styles.featureCardHeader}>
        <span className={`${styles.featureCardIcon} ${colors.icon}`}>
          {getPluginIcon(plugin.slug)}
        </span>
        <div>
          <h3>{plugin.name}</h3>
          <p className={styles.featureCardMeta}>
            {plugin.startGate} - {getAvailabilityLabel(plugin.availabilityState)}
          </p>
        </div>
      </div>
      <p>{plugin.summary}</p>
      <Link className={styles.cardAction} href={getPluginHref(plugin.slug)}>
        {isLive ? "Open App" : "Learn More"} 
        <span aria-hidden="true">&#8594;</span>
      </Link>
    </article>
  );
}

function RightRail({
  implementedPlugins,
  activePlugins,
  quote,
}: {
  implementedPlugins: number;
  activePlugins: PluginRegistryItem[];
  quote: (typeof INSPIRATIONAL_QUOTES)[0];
}) {
  return (
    <aside className={styles.rightRail} aria-label="Profile and activity">
      <div className={styles.rightRailHeader}>
        <span className={styles.sectionTitle}>Your Space</span>
      </div>

      <div className={styles.rightRailScroll}>
        {/* Profile Card */}
        <section className={styles.profileCard}>
          <div className={styles.profileAvatar}>
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: {
                      width: "100%",
                      height: "100%",
                    },
                  },
                }}
              />
            </SignedIn>
            <SignedOut>S</SignedOut>
          </div>
          <SignedIn>
            <p className={styles.profileName}>Welcome Back</p>
          </SignedIn>
          <SignedOut>
            <p className={styles.profileName}>Welcome, Survivor</p>
          </SignedOut>
          <p className={styles.profileMeta}>
            {implementedPlugins} apps available
          </p>
          <div className={styles.profileBadges}>
            <span className={styles.profileBadge}>Safe Space</span>
          </div>
        </section>

        {/* Inspirational Quote */}
        <section className={styles.quoteBlock}>
          <p className={styles.quoteText}>"{quote.text}"</p>
          <p className={styles.quoteAuthor}>- {quote.author}</p>
        </section>

        {/* Active Apps */}
        <section className={styles.memberSection}>
          <p className={styles.memberSectionTitle}>Active Mini-Apps</p>
          <ul className={styles.memberList}>
            {activePlugins.map((plugin) => {
              const colors = getPluginColors(plugin.slug);
              return (
                <li key={plugin.slug}>
                  <Link
                    href={getPluginHref(plugin.slug)}
                    className={styles.memberItem}
                  >
                    <span className={`${styles.memberAvatar} ${colors.icon}`}>
                      {getPluginIcon(plugin.slug).charAt(0)}
                    </span>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{plugin.name}</span>
                      <span className={styles.memberStatus}>
                        {plugin.startGate}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
            {activePlugins.length === 0 && (
              <li className={styles.memberItem}>
                <span className={styles.memberInfo}>
                  <span className={styles.memberStatus}>
                    No active apps yet
                  </span>
                </span>
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className={styles.authActions}>
        <SignedOut>
          <SignInButton mode="modal">
            <button className={styles.authButton} type="button">
              Sign In
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link className={styles.subtleButton} href="/apps/chyme">
            Open Community
          </Link>
        </SignedIn>
      </div>
    </aside>
  );
}

export function CommunityShell({ initialPlugins }: CommunityShellProps) {
  const [query, setQuery] = useState("");
  const [plugins, setPlugins] = useState(initialPlugins);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { isLoaded, user } = useUser();

  // Random inspirational quote
  const quote = useMemo(() => {
    return INSPIRATIONAL_QUOTES[
      Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)
    ];
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadPlugins() {
      try {
        const response = await fetch("/api/plugins", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Unable to load plugin registry.");
        }

        const payload = (await response.json()) as PluginsApiPayload;
        if (!Array.isArray(payload.plugins)) {
          throw new Error("Plugin registry payload is invalid.");
        }

        if (!isCancelled) {
          setPlugins(payload.plugins);
          setLoadError(null);
        }
      } catch {
        if (!isCancelled) {
          setLoadError(
            "Live plugin data is temporarily unavailable. Showing cached registry."
          );
        }
      }
    }

    void loadPlugins();
    return () => {
      isCancelled = true;
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlugins = useMemo(() => {
    if (!normalizedQuery) {
      return plugins;
    }

    return plugins.filter((plugin) => {
      const haystack =
        `${plugin.name} ${plugin.summary} ${plugin.phase} ${plugin.startGate}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, plugins]);

  const implementedPlugins = plugins.filter(
    (plugin) => plugin.availabilityState === "implemented_shell"
  );
  const activePlugins = implementedPlugins.slice(0, 5);
  const requiresUsername = Boolean(
    isLoaded && user && (!user.username || user.username.trim().length === 0)
  );

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <ServerRail plugins={plugins} />
        <LeftNavigation plugins={filteredPlugins} />

        <main className={styles.content}>
          <div className={styles.toolbar}>
            <label className={styles.visuallyHidden} htmlFor="community-search">
              Search apps and resources
            </label>
            <input
              className={styles.search}
              id="community-search"
              name="communitySearch"
              placeholder="Search apps, resources, and support..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Link className={styles.toolbarButton} href="/apps/chyme">
              Community
            </Link>
            <Link className={styles.toolbarButton} href="/admin/feed-announcements">
              Updates
            </Link>
          </div>

          <div className={styles.mainScroll}>
            <SignedIn>
              {requiresUsername && (
                <section className={styles.usernameAlert} role="alert">
                  Please set a username in your profile to access all features.
                </section>
              )}
            </SignedIn>
            {loadError && (
              <section className={styles.usernameAlert} role="alert">
                {loadError}
              </section>
            )}

            {/* Hero Section */}
            <section className={styles.hero}>
              <span className={styles.heroBadge}>
                <span aria-hidden="true">&#10003;</span> Safe Space
              </span>
              <h2 className={styles.heroTitle}>
                From <span className={styles.heroTitleAccent}>Survivor</span> to{" "}
                <span className={styles.heroTitleAccent}>Thriver</span>
              </h2>
              <p className={styles.heroSubtitle}>
                Your private, invite-only community platform. Access support,
                resources, and opportunities designed for your journey forward.
              </p>
            </section>

            {/* All Mini-Apps */}
            <div className={styles.sectionHeader}>
              <h2>All Mini-Apps</h2>
              <Link href="/apps/directory">View Directory</Link>
            </div>
            <section className={styles.cardGrid}>
              {filteredPlugins.map((plugin) => (
                <PluginCard key={plugin.slug} plugin={plugin} />
              ))}
              {filteredPlugins.length === 0 && (
                <article className={styles.featureCard}>
                  <h3>No apps found</h3>
                  <p>Try adjusting your search to find what you need.</p>
                </article>
              )}
            </section>

            {/* Live Now */}
            {implementedPlugins.length > 0 && (
              <>
                <div className={styles.sectionHeader}>
                  <h2>Available Now</h2>
                  <span>{implementedPlugins.length} active</span>
                </div>
                <section className={styles.cardGrid}>
                  {implementedPlugins.slice(0, 6).map((plugin) => (
                    <PluginCard key={plugin.slug} plugin={plugin} />
                  ))}
                </section>
              </>
            )}
          </div>
        </main>

        <RightRail
          implementedPlugins={implementedPlugins.length}
          activePlugins={activePlugins}
          quote={quote}
        />
      </div>
    </div>
  );
}
