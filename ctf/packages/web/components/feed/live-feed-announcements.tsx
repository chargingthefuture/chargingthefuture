'use client';

import Link from 'next/link';
import { ChevronLeft, Megaphone, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { StreamChatPanel } from '../shared/stream-chat-panel';
import { FeedAnnouncementsIconRail } from './feed-announcements-icon-rail';
import { FeedAnnouncementsSidebar } from './feed-announcements-sidebar';
import { FeedAnnouncementsHeader } from './feed-announcements-header';
import { FeedAnnouncementsRightPanel } from './feed-announcements-right-panel';
import { FeedItemCard } from './feed-item-card';
import { FeedQuestionForm, FeedCommunityForm } from './feed-compose-forms';
import { FEED_COLOR, FEED_BG } from './feed-announcements-constants';

type FeedStreamCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
};

import type {
  FeedAnswerRatingValue,
  FeedChannel,
  FeedCommunityCategory,
  FeedConfig,
  FeedPagination,
  FeedQuestionCategory,
  FeedTimelineItem,
} from '../../lib/feed/types';

type FeedFilter = FeedChannel | 'unread';

type FeedSnapshotResponse = {
  items: FeedTimelineItem[];
  pagination: FeedPagination;
};

type FeedConfigResponse = {
  config: FeedConfig;
};

type LiveFeedAnnouncementsProps = {
  initialItems: FeedTimelineItem[];
  initialConfig: FeedConfig | null;
  initialError: string | null;
  isAdmin: boolean;
};

function isAlertItem(item: FeedTimelineItem): boolean {
  return item.mandatory || item.priority >= 80;
}

async function loadFeedSnapshot(): Promise<{ items: FeedTimelineItem[]; config: FeedConfig | null }> {
  const [itemsResponse, configResponse] = await Promise.all([
    fetch('/api/feed/items?page=1&pageSize=24', { cache: 'no-store' }),
    fetch('/api/feed/config', { cache: 'no-store' }),
  ]);
  if (!itemsResponse.ok) throw new Error('Unable to load live feed items.');
  const timeline = (await itemsResponse.json()) as FeedSnapshotResponse;
  const config = configResponse.ok ? ((await configResponse.json()) as FeedConfigResponse).config : null;
  return { items: timeline.items, config };
}

function getVisibleItems(items: FeedTimelineItem[], filter: FeedFilter): FeedTimelineItem[] {
  switch (filter) {
    case 'unread': return items.filter((item) => !item.isRead);
    case 'announcements':
    case 'questions':
    case 'community':
      return items.filter((item) => item.itemType === filter.slice(0, -1) || item.itemType === filter);
    default: return items;
  }
}

export function LiveFeedAnnouncements({ initialItems, initialConfig, initialError, isAdmin }: LiveFeedAnnouncementsProps) {
  const [items, setItems] = useState(initialItems);
  const [config, setConfig] = useState(initialConfig);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [uiTab, setUiTab] = useState<'feed' | 'chat' | 'admin'>('feed');
  const [error, setError] = useState<string | null>(initialError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyAnswerId, setBusyAnswerId] = useState<string | null>(null);
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [questionBody, setQuestionBody] = useState('');
  const [questionCategory, setQuestionCategory] = useState<FeedQuestionCategory>('general');
  const [questionZipCode, setQuestionZipCode] = useState('');
  const [questionRadius, setQuestionRadius] = useState('10');
  const [llmConsentGranted, setLlmConsentGranted] = useState(true);
  const [communityBody, setCommunityBody] = useState('');
  const [communityCategory, setCommunityCategory] = useState<FeedCommunityCategory>('general');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [showPostForm, setShowPostForm] = useState<'question' | 'community' | null>(null);
  const [chatCredentials, setChatCredentials] = useState<FeedStreamCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatFetchedRef = useRef(false);

  useEffect(() => {
    if (uiTab === 'chat' && !chatFetchedRef.current) {
      chatFetchedRef.current = true;
      setChatLoading(true);
      setChatError(null);
      fetch('/api/feed/stream', { method: 'POST' })
        .then(async (res) => {
          const data = await res.json();
          if (data.ok) {
            setChatCredentials({ streamApiKey: data.streamApiKey, streamToken: data.streamToken, streamUserId: data.streamUserId, streamChannelId: data.streamChannelId });
          } else {
            setChatError(data.message || 'Unable to load chat.');
          }
        })
        .catch((e) => setChatError(e instanceof Error ? e.message : String(e)))
        .finally(() => setChatLoading(false));
    }
  }, [uiTab]);

  const refreshFeed = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const snapshot = await loadFeedSnapshot();
      setItems(snapshot.items);
      setConfig(snapshot.config);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the feed right now.');
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshFeed(initialItems.length === 0);
    const timer = window.setInterval(() => void refreshFeed(false), 30000);
    return () => window.clearInterval(timer);
  }, [initialItems.length, refreshFeed]);

  const enabledChannels = config?.enabledChannels ?? ['announcements', 'questions', 'community'];
  const visibleItems = useMemo(() => getVisibleItems(items, filter), [filter, items]);
  const unreadCount = items.filter((item) => !item.isRead).length;
  const alertCount = items.filter(isAlertItem).length;
  const questionCount = items.filter((item) => item.itemType === 'question').length;
  const communityCount = items.filter((item) => item.itemType === 'community').length;

  const handleItemMutation = useCallback(async (itemId: string, action: 'read' | 'dismiss') => {
    setBusyItemId(itemId);
    setError(null);
    try {
      const response = await fetch(`/api/feed/items/${itemId}/${action}`, { method: 'POST', headers: { 'x-ctf-csrf': '1' } });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? 'Unable to update the feed item.');
      setItems((previous) => previous.flatMap((item) => {
        if (item.id !== itemId) return [item];
        if (action === 'dismiss' && !item.mandatory) return [];
        return [{ ...item, isRead: true }];
      }));
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Unable to update the feed item.');
    } finally {
      setBusyItemId(null);
    }
  }, []);

  const handleQuestionSubmit = useCallback(async () => {
    setBusyQuestionId('new-question');
    setError(null);
    try {
      const questionResponse = await fetch('/api/feed/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({
          body: questionBody,
          category: questionCategory,
          location: questionZipCode.trim().length > 0 ? { zipCode: questionZipCode.trim(), radiusMiles: Number.parseInt(questionRadius, 10) || 10 } : null,
          consentGranted: llmConsentGranted,
        }),
      });
      const questionPayload = (await questionResponse.json().catch(() => null)) as { message?: string; questionId?: string } | null;
      if (!questionResponse.ok || !questionPayload?.questionId) throw new Error(questionPayload?.message ?? 'Unable to submit the question.');
      const answerResponse = await fetch(`/api/feed/questions/${questionPayload.questionId}/answer`, { method: 'POST', headers: { 'x-ctf-csrf': '1' } });
      if (!answerResponse.ok) {
        const answerPayload = (await answerResponse.json().catch(() => null)) as { message?: string } | null;
        throw new Error(answerPayload?.message ?? 'Question saved, but assisted answer generation failed.');
      }
      setQuestionBody('');
      setQuestionZipCode('');
      setQuestionRadius('10');
      setShowPostForm(null);
      await refreshFeed(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the question.');
    } finally {
      setBusyQuestionId(null);
    }
  }, [llmConsentGranted, questionBody, questionCategory, questionRadius, questionZipCode, refreshFeed]);

  const handleAnswerGenerate = useCallback(async (questionId: string) => {
    setBusyQuestionId(questionId);
    setError(null);
    try {
      const response = await fetch(`/api/feed/questions/${questionId}/answer`, { method: 'POST', headers: { 'x-ctf-csrf': '1' } });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? 'Unable to generate an assisted answer.');
      await refreshFeed(false);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Unable to generate an assisted answer.');
    } finally {
      setBusyQuestionId(null);
    }
  }, [refreshFeed]);

  const handleAnswerRating = useCallback(async (answerId: string, rating: FeedAnswerRatingValue) => {
    setBusyAnswerId(answerId);
    setError(null);
    try {
      const response = await fetch(`/api/feed/answers/${answerId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ rating }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? 'Unable to rate this answer.');
      await refreshFeed(false);
    } catch (ratingError) {
      setError(ratingError instanceof Error ? ratingError.message : 'Unable to rate this answer.');
    } finally {
      setBusyAnswerId(null);
    }
  }, [refreshFeed]);

  const handleCommunitySubmit = useCallback(async () => {
    setBusyPostId('new-post');
    setError(null);
    try {
      const response = await fetch('/api/feed/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ body: communityBody, category: communityCategory }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? 'Unable to publish the community post.');
      setCommunityBody('');
      setShowPostForm(null);
      await refreshFeed(false);
    } catch (communityError) {
      setError(communityError instanceof Error ? communityError.message : 'Unable to publish the community post.');
    } finally {
      setBusyPostId(null);
    }
  }, [communityBody, communityCategory, refreshFeed]);

  const handleCommunityReply = useCallback(async (postId: string) => {
    const draft = replyDrafts[postId] ?? '';
    setBusyPostId(postId);
    setError(null);
    try {
      const response = await fetch(`/api/feed/community/posts/${postId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ body: draft }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? 'Unable to publish the community reply.');
      setReplyDrafts((previous) => ({ ...previous, [postId]: '' }));
      await refreshFeed(false);
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'Unable to publish the community reply.');
    } finally {
      setBusyPostId(null);
    }
  }, [refreshFeed, replyDrafts]);

  const openNewPost = useCallback(() => {
    setShowPostForm(enabledChannels.includes('community') ? 'community' : 'question');
  }, [enabledChannels]);

  const isMobile = useIsMobile();
  const mobileTabs: { key: 'feed' | 'chat' | 'admin'; label: string }[] = [
    { key: 'feed', label: 'Feed' },
    { key: 'chat', label: 'Chat' },
    ...(isAdmin ? [{ key: 'admin' as const, label: 'Admin' }] : []),
  ];
  const mobileFilters: { key: FeedFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    ...enabledChannels.map((channel) => ({ key: channel as FeedFilter, label: channel.charAt(0).toUpperCase() + channel.slice(1) })),
    { key: 'unread', label: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100dvh', background: FEED_BG, fontFamily: "'Inter', system-ui, sans-serif", color: '#E8EAF0', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      {!isMobile && <FeedAnnouncementsIconRail uiTab={uiTab} onTabChange={setUiTab} unreadCount={unreadCount} />}

      {!isMobile && (
        <FeedAnnouncementsSidebar
          filter={filter}
          onFilterChange={setFilter}
          unreadCount={unreadCount}
          enabledChannels={enabledChannels}
        />
      )}

      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: FEED_BG, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${FEED_COLOR}14`, border: `1px solid ${FEED_COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FEED_COLOR, textDecoration: 'none', flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <Megaphone size={18} style={{ color: FEED_COLOR, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB', flex: 1 }}>Feed</span>
            <button onClick={openNewPost} style={{ padding: '8px 14px', borderRadius: 9, background: `${FEED_COLOR}1A`, border: `1px solid ${FEED_COLOR}40`, color: FEED_COLOR, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>New post</button>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px' }}>
            {mobileTabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setUiTab(key)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: uiTab === key ? `${FEED_COLOR}1A` : 'transparent', border: `1px solid ${uiTab === key ? FEED_COLOR + '40' : 'rgba(255,255,255,0.08)'}`, color: uiTab === key ? FEED_COLOR : '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
          {uiTab === 'feed' && (
            <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', overflowX: 'auto' }}>
              {mobileFilters.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{ whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: 14, background: filter === key ? `${FEED_COLOR}14` : 'transparent', border: `1px solid ${filter === key ? FEED_COLOR + '50' : 'rgba(255,255,255,0.1)'}`, color: filter === key ? FEED_COLOR : '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!isMobile && <FeedAnnouncementsHeader onNewPost={openNewPost} />}

        {uiTab === 'feed' && (
          <FeedTab
            error={error}
            showPostForm={showPostForm}
            setShowPostForm={setShowPostForm}
            enabledChannels={enabledChannels}
            questionBody={questionBody}
            questionCategory={questionCategory}
            questionZipCode={questionZipCode}
            questionRadius={questionRadius}
            llmConsentGranted={llmConsentGranted}
            communityBody={communityBody}
            communityCategory={communityCategory}
            busyQuestionId={busyQuestionId}
            busyPostId={busyPostId}
            busyItemId={busyItemId}
            busyAnswerId={busyAnswerId}
            replyDrafts={replyDrafts}
            isRefreshing={isRefreshing}
            items={items}
            visibleItems={visibleItems}
            onRefresh={() => void refreshFeed(true)}
            onQuestionBodyChange={setQuestionBody}
            onQuestionCategoryChange={setQuestionCategory}
            onQuestionZipChange={setQuestionZipCode}
            onQuestionRadiusChange={setQuestionRadius}
            onConsentChange={setLlmConsentGranted}
            onQuestionSubmit={() => void handleQuestionSubmit()}
            onCommunityBodyChange={setCommunityBody}
            onCommunityCategoryChange={setCommunityCategory}
            onCommunitySubmit={() => void handleCommunitySubmit()}
            onReplyChange={(postId, val) => setReplyDrafts((prev) => ({ ...prev, [postId]: val }))}
            onReply={handleCommunityReply}
            onRead={(id) => void handleItemMutation(id, 'read')}
            onDismiss={(id) => void handleItemMutation(id, 'dismiss')}
            onAnswerGenerate={handleAnswerGenerate}
            onAnswerRating={handleAnswerRating}
          />
        )}

        {uiTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24 }}>
            <div style={{ marginBottom: 20, padding: '18px 24px', borderRadius: 16, background: `linear-gradient(135deg,${FEED_COLOR}15 0%,rgba(132,204,22,0.05) 100%)`, border: `1px solid ${FEED_COLOR}25` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>Community Chat</div>
              <div style={{ fontSize: 14, color: '#9CA3AF' }}>Real-time community discussion</div>
            </div>
            {chatLoading && <div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading chat…</div>}
            {chatError && <div style={{ color: '#EF4444', fontSize: 14 }}>{chatError}</div>}
            {chatCredentials && (
              <div style={{ flex: 1, borderRadius: 14, overflow: 'hidden', border: `1px solid ${FEED_COLOR}20`, minHeight: isMobile ? '65vh' : undefined }}>
                <StreamChatPanel
                  streamApiKey={chatCredentials.streamApiKey}
                  streamToken={chatCredentials.streamToken}
                  streamUserId={chatCredentials.streamUserId}
                  streamChannelId={chatCredentials.streamChannelId}
                />
              </div>
            )}
          </div>
        )}

        {uiTab === 'admin' && (
          <AdminTab
            items={items}
            alertCount={alertCount}
            unreadCount={unreadCount}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {!isMobile && (
        <FeedAnnouncementsRightPanel
          items={items}
          alertCount={alertCount}
          questionCount={questionCount}
          communityCount={communityCount}
          unreadCount={unreadCount}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed tab sub-view
// ---------------------------------------------------------------------------

type FeedTabProps = {
  error: string | null;
  showPostForm: 'question' | 'community' | null;
  setShowPostForm: (v: 'question' | 'community' | null) => void;
  enabledChannels: string[];
  questionBody: string;
  questionCategory: FeedQuestionCategory;
  questionZipCode: string;
  questionRadius: string;
  llmConsentGranted: boolean;
  communityBody: string;
  communityCategory: FeedCommunityCategory;
  busyQuestionId: string | null;
  busyPostId: string | null;
  busyItemId: string | null;
  busyAnswerId: string | null;
  replyDrafts: Record<string, string>;
  isRefreshing: boolean;
  items: FeedTimelineItem[];
  visibleItems: FeedTimelineItem[];
  onRefresh: () => void;
  onQuestionBodyChange: (val: string) => void;
  onQuestionCategoryChange: (val: FeedQuestionCategory) => void;
  onQuestionZipChange: (val: string) => void;
  onQuestionRadiusChange: (val: string) => void;
  onConsentChange: (val: boolean) => void;
  onQuestionSubmit: () => void;
  onCommunityBodyChange: (val: string) => void;
  onCommunityCategoryChange: (val: FeedCommunityCategory) => void;
  onCommunitySubmit: () => void;
  onReplyChange: (postId: string, val: string) => void;
  onReply: (postId: string) => Promise<void>;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAnswerGenerate: (questionId: string) => Promise<void>;
  onAnswerRating: (answerId: string, rating: FeedAnswerRatingValue) => Promise<void>;
};

function FeedTab({
  error, showPostForm, setShowPostForm, enabledChannels,
  questionBody, questionCategory, questionZipCode, questionRadius, llmConsentGranted,
  communityBody, communityCategory,
  busyQuestionId, busyPostId, busyItemId, busyAnswerId,
  replyDrafts, isRefreshing, items, visibleItems,
  onRefresh, onQuestionBodyChange, onQuestionCategoryChange, onQuestionZipChange,
  onQuestionRadiusChange, onConsentChange, onQuestionSubmit,
  onCommunityBodyChange, onCommunityCategoryChange, onCommunitySubmit,
  onReplyChange, onReply, onRead, onDismiss, onAnswerGenerate, onAnswerRating,
}: FeedTabProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 13 }}>
          {error}
        </div>
      )}

      {showPostForm === 'question' && (
        <FeedQuestionForm
          questionBody={questionBody}
          questionCategory={questionCategory}
          questionZipCode={questionZipCode}
          questionRadius={questionRadius}
          llmConsentGranted={llmConsentGranted}
          busyQuestionId={busyQuestionId}
          enabledChannels={enabledChannels}
          onBodyChange={onQuestionBodyChange}
          onCategoryChange={onQuestionCategoryChange}
          onZipCodeChange={onQuestionZipChange}
          onRadiusChange={onQuestionRadiusChange}
          onConsentChange={onConsentChange}
          onSubmit={onQuestionSubmit}
          onCancel={() => setShowPostForm(null)}
          onSwitchToCommunity={() => setShowPostForm('community')}
        />
      )}

      {showPostForm === 'community' && (
        <FeedCommunityForm
          communityBody={communityBody}
          communityCategory={communityCategory}
          busyPostId={busyPostId}
          enabledChannels={enabledChannels}
          onBodyChange={onCommunityBodyChange}
          onCategoryChange={onCommunityCategoryChange}
          onSubmit={onCommunitySubmit}
          onCancel={() => setShowPostForm(null)}
          onSwitchToQuestion={() => setShowPostForm('question')}
        />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>{items.length} items</div>
        <button
          onClick={onRefresh}
          style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={12} style={{ opacity: isRefreshing ? 0.5 : 1 }} />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {visibleItems.length === 0 ? (
        <FeedEmptyState />
      ) : (
        visibleItems.map((item) => (
          <FeedItemCard
            key={item.id}
            item={item}
            busyItemId={busyItemId}
            busyAnswerId={busyAnswerId}
            busyQuestionId={busyQuestionId}
            busyPostId={busyPostId}
            replyDrafts={replyDrafts}
            onRead={onRead}
            onDismiss={onDismiss}
            onAnswerGenerate={(qId) => void onAnswerGenerate(qId)}
            onAnswerRating={(aId, r) => void onAnswerRating(aId, r)}
            onReplyChange={onReplyChange}
            onReply={(pId) => void onReply(pId)}
          />
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — mirrors FeedAnnouncementsEmpty mockup
// ---------------------------------------------------------------------------

function FeedEmptyState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Megaphone size={32} style={{ color: FEED_COLOR, opacity: 0.5 }} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB', marginBottom: 8 }}>No posts yet</div>
        <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>
          The community feed is quiet right now. Posts, announcements, and urgent alerts will stream here in real-time as the community grows.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 520 }}>
        {['Announcements from the Hub team', 'Community stories from survivors', 'Urgent housing and safety alerts', 'Milestones and celebrations'].map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(132,204,22,0.3)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#6B7280' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin tab sub-view
// ---------------------------------------------------------------------------

type AdminTabProps = {
  items: FeedTimelineItem[];
  alertCount: number;
  unreadCount: number;
  isAdmin: boolean;
};

function AdminTab({ items, alertCount, unreadCount, isAdmin }: AdminTabProps) {
  return (
    <div style={{ flex: 1, padding: '32px 40px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB', marginBottom: 20 }}>Admin: Announcements</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { l: 'Total Items', v: String(items.length), c: FEED_COLOR },
          { l: 'Urgent Alerts', v: String(alertCount), c: '#EF4444' },
          { l: 'Unread', v: String(unreadCount), c: '#F59E0B' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ padding: 20, borderRadius: 14, background: `${c}08`, border: `1px solid ${c}20` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c, marginBottom: 4 }}>{v}</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>{l}</div>
          </div>
        ))}
      </div>
      {isAdmin && (
        <Link
          href="/admin/feed-announcements"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: `${FEED_COLOR}15`, border: `1px solid ${FEED_COLOR}30`, color: FEED_COLOR, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
        >
          Open Admin Panel →
        </Link>
      )}
    </div>
  );
}
