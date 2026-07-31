'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { SlidersHorizontal, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { TrustUserExtension } from '../../lib/trust/types';
import type { PluginRegistryItem } from '../../lib/plugins/repository';
import type { HubChannelInfo } from '../../lib/hub/types';
import type { PluginSortMode, ShellCurrentUser, ShellSection, ShellStats } from './shell-types';
import { GATED_CHANNEL_SLUG } from '../../lib/contributor-access/gated-channel-shared';
import { WeaversBadge } from '../contributor-access/weavers-badge';
import { ShellIconRail } from './shell-icon-rail';
import { ShellSidebar } from './shell-sidebar';
import { ShellChatPanel } from './shell-chat-panel';
import { GatedChatPanel } from './gated-chat-panel';
import { ShellAppsPanel } from './shell-apps-panel';
import { ShellRightRail } from './shell-right-rail';
import { ContributionsBanner, ContributionsGiftTrigger } from '../contributions/contributions-banner';
import { UnlockVerifyBanner } from './unlock-verify-banner';
import { HelpControl } from '../bug-reports/help-control';
import { SeMark } from '../shared/se-mark';
import type { UnlockReviewStatus } from '../../lib/unlock/types';
import styles from './community-shell.module.css';

// Verification state for a signed-in member who has not yet completed Quora verification but reaches
// the Commons (notably the early-Commons A/B treatment bucket). Null/undefined when the member is
// verified, an admin, or signed out — in which case no verify banner is shown.
export type ShellVerification = {
  hasSubmission: boolean;
  reviewStatus: UnlockReviewStatus | null;
};

type CommunityShellProps = {
  initialPlugins: PluginRegistryItem[];
  shellStats: ShellStats;
  currentUser: ShellCurrentUser;
  trust: TrustUserExtension;
  initialSection?: ShellSection;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  signInUrl?: string;
  verification?: ShellVerification | null;
};

type PluginsApiPayload = {
  plugins?: PluginRegistryItem[];
};

const RECENT_PLUGIN_STORAGE_KEY = 'ctf.communityShell.recentPluginSlugs';
const PLUGIN_SORT_MODE_STORAGE_KEY = 'ctf.communityShell.pluginSortMode';
const PLUGIN_USAGE_COUNTS_STORAGE_KEY = 'ctf.communityShell.pluginUsageCounts';
const MAX_RECENT_PLUGINS = 12;

function parseStoredRecentPlugins(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function parseStoredSortMode(value: string | null): PluginSortMode {
  if (value === 'recent' || value === 'alpha' || value === 'most-used') return value;
  return 'recent';
}

function parseStoredUsageCounts(value: string | null): Record<string, number> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const result: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0) {
        result[key] = rawValue;
      }
    }

    return result;
  } catch {
    return {};
  }
}

// Optional shell flags resolved to concrete values so the component body carries no
// destructuring defaults (each default counts toward complexity). Behavior matches the
// former `= default` params: an undefined flag falls back exactly as before.
type NormalizedShellFlags = {
  initialSection: ShellSection;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signInUrl: string;
  verification: ShellVerification | null;
};

function normalizeShellProps(props: CommunityShellProps): NormalizedShellFlags {
  return {
    initialSection: props.initialSection ?? 'chat',
    isAuthenticated: props.isAuthenticated ?? false,
    isAdmin: props.isAdmin ?? false,
    signInUrl: props.signInUrl ?? '/sign-in',
    verification: props.verification ?? null,
  };
}

function sectionTabClass(isActive: boolean): string {
  return isActive ? `${styles.mobileBarSectionBtn} ${styles.mobileBarSectionBtnActive}` : styles.mobileBarSectionBtn;
}

function channelSwitchClass(isActive: boolean): string {
  return isActive ? `${styles.channelSwitchBtn} ${styles.channelSwitchBtnActive}` : styles.channelSwitchBtn;
}

function sortPluginsForUi(
  items: PluginRegistryItem[],
  sortMode: PluginSortMode,
  recentSlugs: string[],
  usageCounts: Record<string, number>,
): PluginRegistryItem[] {
  if (sortMode === 'alpha') {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  if (sortMode === 'most-used') {
    return [...items].sort((a, b) => {
      const countA = usageCounts[a.slug] ?? 0;
      const countB = usageCounts[b.slug] ?? 0;

      if (countA !== countB) return countB - countA;

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  const rankBySlug = new Map<string, number>();
  for (let index = 0; index < recentSlugs.length; index += 1) {
    rankBySlug.set(recentSlugs[index], index);
  }

  return [...items].sort((a, b) => {
    const aRecentRank = rankBySlug.get(a.slug);
    const bRecentRank = rankBySlug.get(b.slug);

    if (aRecentRank !== undefined && bRecentRank !== undefined) {
      return aRecentRank - bRecentRank;
    }

    if (aRecentRank !== undefined) return -1;
    if (bRecentRank !== undefined) return 1;

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

type MobileTopBarProps = {
  section: ShellSection;
  onSectionChange: (section: ShellSection) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signInUrl: string;
};

function MobileTopBar({ section, onSectionChange, isAuthenticated, isAdmin, signInUrl }: MobileTopBarProps) {
  return (
    <header className={styles.mobileBar}>
      {/* Brand mark on the phone bar: it is the first product identity a member sees on a phone.
          It sits on the left; the section tabs keep their margin-left:auto so the tabs + controls
          cluster on the right. The Skills Economy "Stack" mark matches the site title in layout.tsx. */}
      <div className={styles.mobileBarLogo}>
        <SeMark size={26} />
      </div>
      {/* Signed out, the bar carries far fewer controls (no gift reminder, help, settings or
          avatar), so the full "SE / SKILLS ECONOMY" lockup fits beside the mark and a first-time
          visitor sees the product name, not just a symbol. Signed in, the name is dropped again
          so the mark, gift reminder, tabs and account controls all fit a 390px phone. */}
      {!isAuthenticated ? (
        <span className={styles.mobileBarWordmark} aria-hidden="true">
          <span className={styles.mobileBarWordmarkInitials}>SE</span>
          <span className={styles.mobileBarWordmarkName}>Skills Economy</span>
        </span>
      ) : null}
      {/* Fundraiser gift reminder — sits between the brand mark and the section tabs (owner
          placement). Renders only on phone widths while a drive is active and the full banner is
          dismissed or snoozed; the banner itself (when open) stays in the content area below. */}
      {isAuthenticated ? <ContributionsGiftTrigger /> : null}
      <div className={styles.mobileBarSections} role="tablist" aria-label="Sections">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'chat'}
          className={sectionTabClass(section === 'chat')}
          onClick={() => onSectionChange('chat')}
        >
          Commons
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'apps'}
          className={sectionTabClass(section === 'apps')}
          onClick={() => onSectionChange('apps')}
        >
          Apps
        </button>
      </div>
      {/* Admins reach /admin straight from the top bar on phones — the left rail
          (which used to carry this link) is hidden on phones, so this replaces the
          extra tap through the drawer. Admins only; hidden for everyone else. */}
      {isAdmin ? (
        <Link href="/admin" className={styles.mobileBarAdminBtn} aria-label="Admin" title="Admin — manage plugins and review queues">
          <SlidersHorizontal size={15} aria-hidden="true" />
          {/* Label hidden at phone widths so the full bar (tabs + admin + help + settings +
              avatar) fits without pushing the avatar off the right edge. */}
          <span className={styles.mobileBarAdminLabel}>Admin</span>
        </Link>
      ) : null}
      <div className={styles.mobileBarAuth}>
        {/* Help control on the phone-width top bar: the desktop icon rail (which
            hosts it) is hidden below 900px, so signed-in members reach the
            "Report a problem" modal from here instead. */}
        {isAuthenticated ? <HelpControl /> : null}
        {/* Account hub link on the phone-width bar: the desktop icon rail's
            account button (which leads to /account — identity, trust, profile,
            data, blocked members) is hidden below 900px, so this gear restores
            the one tap to the full account page. The avatar's own menu only
            edits Clerk identity, so it is not a substitute for this link. */}
        {isAuthenticated ? (
          <Link href="/account" className={styles.iconRailBtn} aria-label="Account and settings" title="Account and settings">
            <Settings size={18} aria-hidden="true" />
          </Link>
        ) : null}
        {isAuthenticated ? (
          // Clerk's account widget on the phone-width bar too: avatar opens
          // Clerk's menu; "Manage account" edits name, username, and email.
          <span className={styles.clerkAvatarSlot} title="Your account — edit name, username, and email">
            <UserButton appearance={{ elements: { avatarBox: styles.clerkMobileAvatarBox } }} />
          </span>
        ) : (
          <Link className={styles.mobileBarSignIn} href={signInUrl}>Sign in</Link>
        )}
      </div>
    </header>
  );
}

type ChannelSwitchRowProps = {
  channels: HubChannelInfo[];
  activeChannel: string | null;
  onChannelSelect: (slug: string) => void;
  onLockedChannelClick: () => void;
};

// Channel switch pills — phone widths only (the desktop channel rail is hidden there).
// The general channel is always shown. The contributor channel is shown to everyone:
// eligible members get it as a real, selectable chip (the server includes it in their
// channel list); everyone else gets a locked chip that opens the same "Weavers of the
// Commons" explainer the Directory braided badge shows — so the space is visible and
// its bar is public, never a hidden back-room.
function ChannelSwitchRow({ channels, activeChannel, onChannelSelect, onLockedChannelClick }: ChannelSwitchRowProps) {
  const fallbackSlug = activeChannel ?? channels[0]?.slug;
  const hasGatedChannel = channels.some((ch) => ch.slug === GATED_CHANNEL_SLUG);

  return (
    <div className={styles.channelSwitchRow} role="tablist" aria-label="Channels">
      {channels.map((ch) => (
        <button
          key={ch.slug}
          type="button"
          role="tab"
          aria-selected={fallbackSlug === ch.slug}
          className={channelSwitchClass(fallbackSlug === ch.slug)}
          onClick={() => onChannelSelect(ch.slug)}
        >
          #{ch.slug}
        </button>
      ))}
      {!hasGatedChannel ? (
        <button
          type="button"
          className={`${styles.channelSwitchBtn} ${styles.channelSwitchBtnLocked}`}
          onClick={onLockedChannelClick}
          aria-haspopup="dialog"
          title="Weavers of the Commons"
        >
          <WeaversBadge size={13} />
          <span>#{GATED_CHANNEL_SLUG}</span>
        </button>
      ) : null}
    </div>
  );
}

type ChatSectionProps = {
  activeChannel: string | null;
  currentUser: ShellCurrentUser;
  isAdmin: boolean;
  shellStats: ShellStats;
  filteredPlugins: PluginRegistryItem[];
  isAuthenticated: boolean;
  signInUrl: string;
};

function ChatSection({ activeChannel, currentUser, isAdmin, shellStats, filteredPlugins, isAuthenticated, signInUrl }: ChatSectionProps) {
  if (activeChannel === GATED_CHANNEL_SLUG) {
    return <GatedChatPanel currentUser={currentUser} isAdmin={isAdmin} />;
  }
  return <ShellChatPanel stats={shellStats} plugins={filteredPlugins} currentUser={currentUser} isAuthenticated={isAuthenticated} isAdmin={isAdmin} signInUrl={signInUrl} />;
}

type ShellMainContentProps = {
  section: ShellSection;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signInUrl: string;
  verification: ShellVerification | null;
  loadError: string | null;
  channels: HubChannelInfo[];
  activeChannel: string | null;
  onChannelSelect: (slug: string) => void;
  onLockedChannelClick: () => void;
  shellStats: ShellStats;
  filteredPlugins: PluginRegistryItem[];
  currentUser: ShellCurrentUser;
  activeApp: string | null;
  onAppSelect: (slug: string | null) => void;
  sortMode: PluginSortMode;
  onSortModeChange: (mode: PluginSortMode) => void;
  query: string;
  onQueryChange: (value: string) => void;
};

function ShellMainContent({
  section,
  isAuthenticated,
  isAdmin,
  signInUrl,
  verification,
  loadError,
  channels,
  activeChannel,
  onChannelSelect,
  onLockedChannelClick,
  shellStats,
  filteredPlugins,
  currentUser,
  activeApp,
  onAppSelect,
  sortMode,
  onSortModeChange,
  query,
  onQueryChange,
}: ShellMainContentProps) {
  return (
    <main className={`${styles.panel} ${styles.content}`}>
      {/* App-wide fundraiser banner — non-blocking, top of the content area, signed-in only.
          The banner self-hides unless a drive is active and visible for this member. */}
      {isAuthenticated ? <ContributionsBanner /> : null}
      {/* Not-yet-verified members (notably the early-Commons A/B treatment bucket) get a persistent
          prompt to submit their Quora URL right here, with a nudge to ask in the Commons if stuck. */}
      {isAuthenticated && verification ? (
        <UnlockVerifyBanner hasSubmission={verification.hasSubmission} reviewStatus={verification.reviewStatus} />
      ) : null}
      {loadError ? (
        <section className={styles.usernameAlert} role="alert">{loadError}</section>
      ) : null}
      {section === 'chat' && isAuthenticated ? (
        <ChannelSwitchRow
          channels={channels}
          activeChannel={activeChannel}
          onChannelSelect={onChannelSelect}
          onLockedChannelClick={onLockedChannelClick}
        />
      ) : null}
      {section === 'chat' ? (
        <ChatSection
          activeChannel={activeChannel}
          currentUser={currentUser}
          isAdmin={isAdmin}
          shellStats={shellStats}
          filteredPlugins={filteredPlugins}
          isAuthenticated={isAuthenticated}
          signInUrl={signInUrl}
        />
      ) : (
        <ShellAppsPanel
          plugins={filteredPlugins}
          activeApp={activeApp}
          onAppSelect={onAppSelect}
          sortMode={sortMode}
          onSortModeChange={onSortModeChange}
          query={query}
          onQueryChange={onQueryChange}
        />
      )}
    </main>
  );
}

// Contributor-channel explainer — shown when a non-eligible member taps the locked
// contributor chip. Same honest copy the Directory braided badge shows (proposal
// section 3: no "verified", no "vetted"). "Anyone can earn this."
function ContributorExplainerModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className={styles.explainerOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Weavers of the Commons"
    >
      <button
        type="button"
        aria-label="Close"
        className={styles.explainerBackdrop}
        onClick={onClose}
      />
      <div className={styles.explainerCard}>
        <div className={styles.explainerHead}>
          <WeaversBadge size={30} />
          <div className={styles.explainerTitle}>Weavers of the Commons</div>
        </div>
        <div className={styles.explainerBody}>
          The contributor channel is for consistent, broad contributors to the community — real
          help, delivered over time. Anyone can earn it; when you do, the channel opens here.
        </div>
        <div className={styles.explainerActions}>
          <Link href="/apps/directory/weavers-of-the-commons" className={styles.explainerLink}>
            How it&rsquo;s earned
          </Link>
          <button
            type="button"
            className={styles.explainerClose}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function CommunityShell(props: CommunityShellProps) {
  const { initialPlugins, shellStats, currentUser, trust } = props;
  const { initialSection, isAuthenticated, isAdmin, signInUrl, verification } = normalizeShellProps(props);
  const [section, setSection] = useState<ShellSection>(initialSection);
  const [query, setQuery] = useState('');
  const [plugins, setPlugins] = useState(initialPlugins);
  const [channels, setChannels] = useState<HubChannelInfo[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<PluginSortMode>('recent');
  const [recentPluginSlugs, setRecentPluginSlugs] = useState<string[]>([]);
  const [pluginUsageCounts, setPluginUsageCounts] = useState<Record<string, number>>({});
  const [contributorExplainerOpen, setContributorExplainerOpen] = useState(false);

  // Self-heal an out-of-date signed-out render. A back/forward navigation can restore a
  // cached "guest" version of this route (the server resolved the visitor before
  // the session was known, or the route's cached payload predates sign-in), even
  // though Clerk's client session shows the member is signed in. Without this, the
  // member lands on the signed-out shell and has to refresh by hand. When the
  // server shell says guest (isAuthenticated false) but the client knows otherwise,
  // re-fetch this route's server components so the signed-in shell replaces the
  // cached one. Guarded with a ref so it runs once and cannot loop if the server
  // genuinely returns guest.
  const router = useRouter();
  const { isAuthenticated: clientAuthenticated, isLoading: authLoading } = useAuth();
  const didReconcileAuth = useRef(false);

  useEffect(() => {
    if (authLoading || didReconcileAuth.current) return;
    if (!isAuthenticated && clientAuthenticated) {
      didReconcileAuth.current = true;
      router.refresh();
    }
  }, [authLoading, isAuthenticated, clientAuthenticated, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setRecentPluginSlugs(parseStoredRecentPlugins(window.localStorage.getItem(RECENT_PLUGIN_STORAGE_KEY)));
    setSortMode(parseStoredSortMode(window.localStorage.getItem(PLUGIN_SORT_MODE_STORAGE_KEY)));
    setPluginUsageCounts(parseStoredUsageCounts(window.localStorage.getItem(PLUGIN_USAGE_COUNTS_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    let canceled = false;

    async function loadPlugins() {
      try {
        const res = await fetch('/api/plugins', { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('Unable to load plugin registry.');
        const payload = (await res.json()) as PluginsApiPayload;
        if (!Array.isArray(payload.plugins)) throw new Error('Invalid plugin registry payload.');
        if (!canceled) {
          setPlugins(payload.plugins);
          setLoadError(null);
        }
      } catch {
        if (!canceled) {
          setLoadError('Live plugin data is temporarily unavailable. Showing last known registry snapshot.');
        }
      }
    }

    void loadPlugins();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let canceled = false;

    async function loadHubData() {
      try {
        const channelsRes = await fetch('/api/hub/channels', { method: 'GET', cache: 'no-store' });

        if (channelsRes.ok) {
          const channelsPayload = (await channelsRes.json()) as { channels: HubChannelInfo[] };
          if (!canceled) {
            const loadedChannels = channelsPayload.channels ?? [];
            setChannels(loadedChannels);
            // Default the open channel to the first one (general) so the sidebar
            // shows which channel the chat panel is already displaying.
            setActiveChannel((current) => current ?? loadedChannels[0]?.slug ?? null);
          }
        }
      } catch {
        // Silently fail; channels will remain empty.
      }
    }

    void loadHubData();
    return () => {
      canceled = true;
    };
  }, [isAuthenticated]);

  const orderedPlugins = useMemo(
    () => sortPluginsForUi(plugins, sortMode, recentPluginSlugs, pluginUsageCounts),
    [plugins, sortMode, recentPluginSlugs, pluginUsageCounts],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlugins = useMemo(() => {
    if (!normalizedQuery) return orderedPlugins;
    return orderedPlugins.filter((p) =>
      `${p.name} ${p.summary}`.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, orderedPlugins]);

  const handleAppSelect = (slug: string | null) => {
    setActiveApp(slug);
    if (!slug || typeof window === 'undefined') return;

    setRecentPluginSlugs((previous) => {
      const next = [slug, ...previous.filter((item) => item !== slug)].slice(0, MAX_RECENT_PLUGINS);
      window.localStorage.setItem(RECENT_PLUGIN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    setPluginUsageCounts((previous) => {
      const next = { ...previous, [slug]: (previous[slug] ?? 0) + 1 };
      window.localStorage.setItem(PLUGIN_USAGE_COUNTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Escape closes the contributor-channel explainer; listener attached only while open.
  useEffect(() => {
    if (!contributorExplainerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContributorExplainerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [contributorExplainerOpen]);

  // Channels live inside the chat panel of this single-page shell, so selecting
  // one just keeps the user in the chat section and marks it active — it must not
  // navigate to a separate route (there is no per-channel page; doing so 404s).
  const handleChannelSelect = (slug: string) => {
    setActiveChannel(slug);
    setSection('chat');
    setActiveApp(null);
  };

  const handleSortModeChange = (mode: PluginSortMode) => {
    setSortMode(mode);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PLUGIN_SORT_MODE_STORAGE_KEY, mode);
  };


  return (
    <div className={`${styles.shell} ctf-self-responsive`}>
      <MobileTopBar
        section={section}
        onSectionChange={setSection}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        signInUrl={signInUrl}
      />
      <div className={styles.frame}>
        <ShellIconRail section={section} onSectionChange={setSection} initial={currentUser.initial} isAuthenticated={isAuthenticated} isAdmin={isAdmin} />
        {/* Channel rail — desktop only. It is hidden on phones (single "general"
            channel, no real navigation value yet), so there is no phone drawer to
            slide it in; bring one back when there is more than one option to show. */}
        <ShellSidebar
          channels={channels}
          activeChannel={activeChannel}
          onChannelSelect={handleChannelSelect}
          shellStats={shellStats}
          isAdmin={isAdmin}
        />
        <ShellMainContent
          section={section}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          signInUrl={signInUrl}
          verification={verification}
          loadError={loadError}
          channels={channels}
          activeChannel={activeChannel}
          onChannelSelect={handleChannelSelect}
          onLockedChannelClick={() => setContributorExplainerOpen(true)}
          shellStats={shellStats}
          filteredPlugins={filteredPlugins}
          currentUser={currentUser}
          activeApp={activeApp}
          onAppSelect={handleAppSelect}
          sortMode={sortMode}
          onSortModeChange={handleSortModeChange}
          query={query}
          onQueryChange={setQuery}
        />
        <ShellRightRail
          currentUser={currentUser}
          trust={trust}
          isAuthenticated={isAuthenticated}
          signInUrl={signInUrl}
        />
      </div>
      {contributorExplainerOpen ? (
        <ContributorExplainerModal onClose={() => setContributorExplainerOpen(false)} />
      ) : null}
    </div>
  );
}
