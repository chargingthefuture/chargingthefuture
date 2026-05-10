'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StreamChatPanel } from '../shared/stream-chat-panel';
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

const COLOR = '#8B5CF6';

function isAlertItem(item: FeedTimelineItem): boolean {
  return item.mandatory || item.priority >= 80;
}

function formatFeedTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function itemTypeColor(item: FeedTimelineItem): string {
  if (item.itemType === 'question') return '#38BDF8';
  if (item.itemType === 'community') return '#22C55E';
  return '#A78BFA';
}

function itemTypeLabel(item: FeedTimelineItem): string {
  if (item.itemType === 'question') return '❓ Question';
  if (item.itemType === 'community') return '🤝 Community';
  return '📣 Announcement';
}

function itemInitials(item: FeedTimelineItem): string {
  if (item.itemType === 'question') return 'Q';
  if (item.itemType === 'community') return 'CM';
  return 'ANN';
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

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', background: '#0F1117', fontFamily: "'Inter', system-ui, sans-serif", color: '#E8EAF0', display: 'flex' }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: '#090B0F', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 20 }}>
          📣
        </div>
        {[
          { icon: '🌐', key: 'feed' },
          { icon: '💬', key: 'chat' },
          { icon: '⚙️', key: 'admin' },
        ].map(({ icon, key }) => (
          <button
            key={key}
            onClick={() => setUiTab(key as 'feed' | 'chat' | 'admin')}
            style={{ width: 44, height: 44, borderRadius: 12, background: uiTab === key ? `${COLOR}20` : 'transparent', border: uiTab === key ? `1px solid ${COLOR}40` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: uiTab === key ? COLOR : '#6B7280' }}
          >
            {icon}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', fontSize: 18, position: 'relative' }}>
          🔔
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', fontSize: 9, color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>S</div>
      </aside>

      {/* Left sidebar */}
      <aside style={{ width: 240, background: '#0D0F14', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 }}>📣 Feed</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4B5563', fontSize: 14 }}>🔍</span>
            <input
              placeholder="Search posts…"
              style={{ width: '100%', padding: '7px 10px 7px 30px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 13, color: '#9CA3AF', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
          {([
            ['all', 'All'],
            ['announcements', 'Announcements'],
            ['questions', 'Questions'],
            ['community', 'Community'],
            ['unread', `Unread (${unreadCount})`],
          ] as Array<[FeedFilter, string]>)
            .filter(([value]) => value === 'all' || value === 'unread' || enabledChannels.includes(value))
            .map(([value, label], i) => (
              <div
                key={value}
                onClick={() => setFilter(value)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: filter === value ? `${COLOR}18` : 'transparent', borderLeft: filter === value ? `2px solid ${COLOR}` : '2px solid transparent', marginLeft: 2, marginBottom: 2 }}
              >
                <span style={{ fontSize: 13, color: filter === value ? '#E8EAF0' : '#9CA3AF', flex: 1 }}>{label}</span>
                {value === 'unread' && unreadCount > 0 && (
                  <span style={{ background: COLOR, borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#fff', padding: '1px 6px' }}>{unreadCount}</span>
                )}
              </div>
            ))}
          <div style={{ margin: '16px 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', padding: '0 10px' }}>Trending</div>
          {['#ServiceCredits', '#LightHouseHousing', '#SurvivorStories', '#Phase2Launch'].map((tag) => (
            <div key={tag} style={{ padding: '7px 10px', fontSize: 13, color: '#6B7280', cursor: 'pointer' }}>
              <span style={{ color: COLOR }}>{tag}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
          <span style={{ fontSize: 18, color: COLOR }}>📣</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>📣 Feed + Announcements</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Community pulse · Real-time via GetStream</div>
          </div>
          <button
            onClick={() => setShowPostForm(showPostForm === 'community' ? null : 'community')}
            style={{ padding: '7px 16px', borderRadius: 8, background: COLOR, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            + New Post
          </button>
          <span style={{ background: 'rgba(14,165,233,0.12)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.2)', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>GetStream ⚡</span>
        </header>

        {/* Feed tab */}
        {uiTab === 'feed' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* Post compose forms */}
            {showPostForm === 'question' && enabledChannels.includes('questions') && (
              <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid #38BDF840` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB' }}>Ask for Guided Help</div>
                  <span style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.25)', fontSize: 11, padding: '2px 10px', borderRadius: 12 }}>LLM-assisted</span>
                </div>
                <textarea
                  value={questionBody}
                  onChange={(e) => setQuestionBody(e.target.value)}
                  placeholder="Ask a survivor-safe question, e.g. housing near 90210 or support services nearby."
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#E8EAF0', fontSize: 14, resize: 'vertical', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                  <select value={questionCategory} onChange={(e) => setQuestionCategory(e.target.value as FeedQuestionCategory)} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13 }}>
                    <option value="general">General</option>
                    <option value="housing">Housing</option>
                    <option value="services">Services</option>
                    <option value="safety">Safety</option>
                    <option value="benefits">Benefits</option>
                  </select>
                  <input value={questionZipCode} onChange={(e) => setQuestionZipCode(e.target.value)} placeholder="ZIP code" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13 }} />
                  <input value={questionRadius} onChange={(e) => setQuestionRadius(e.target.value)} placeholder="Radius miles" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13 }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>
                  <input type="checkbox" checked={llmConsentGranted} onChange={(e) => setLlmConsentGranted(e.target.checked)} style={{ width: 16, height: 16 }} />
                  I consent to LLM processing for this question.
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => void handleQuestionSubmit()} disabled={busyQuestionId === 'new-question' || !questionBody.trim()} style={{ padding: '9px 20px', borderRadius: 8, background: '#38BDF8', border: 'none', color: '#0F172A', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busyQuestionId === 'new-question' || !questionBody.trim() ? 0.6 : 1 }}>
                    {busyQuestionId === 'new-question' ? 'Submitting…' : 'Submit Question'}
                  </button>
                  <button onClick={() => setShowPostForm(null)} style={{ padding: '9px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {showPostForm === 'community' && enabledChannels.includes('community') && (
              <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid #22C55E40` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB' }}>Share a Support Update</div>
                  <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)', fontSize: 11, padding: '2px 10px', borderRadius: 12 }}>Peer support</span>
                </div>
                <textarea
                  value={communityBody}
                  onChange={(e) => setCommunityBody(e.target.value)}
                  placeholder="Share a request, resource, event, or peer-support note for the community."
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#E8EAF0', fontSize: 14, resize: 'vertical', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <select value={communityCategory} onChange={(e) => setCommunityCategory(e.target.value as FeedCommunityCategory)} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13 }}>
                    <option value="general">General</option>
                    <option value="peer_support">Peer support</option>
                    <option value="resource_share">Resource share</option>
                    <option value="event">Event</option>
                  </select>
                  {enabledChannels.includes('questions') && (
                    <button onClick={() => setShowPostForm('question')} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38BDF8', fontSize: 13, cursor: 'pointer' }}>
                      Switch to Question
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => void handleCommunitySubmit()} disabled={busyPostId === 'new-post' || !communityBody.trim()} style={{ padding: '9px 20px', borderRadius: 8, background: '#22C55E', border: 'none', color: '#0F172A', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busyPostId === 'new-post' || !communityBody.trim() ? 0.6 : 1 }}>
                    {busyPostId === 'new-post' ? 'Publishing…' : 'Publish Post'}
                  </button>
                  <button onClick={() => setShowPostForm(null)} style={{ padding: '9px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Refresh control */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{items.length} items</div>
              <button onClick={() => void refreshFeed(true)} style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>
                {isRefreshing ? 'Refreshing…' : '🔄 Refresh'}
              </button>
            </div>

            {/* Feed items */}
            {visibleItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 15 }}>No feed items match this filter.</div>
              </div>
            ) : (
              visibleItems.map((item) => {
                const accentColor = itemTypeColor(item);
                return (
                  <div
                    key={item.id}
                    style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${item.mandatory || item.priority >= 90 ? accentColor + '40' : 'rgba(255,255,255,0.06)'}`, position: 'relative' }}
                  >
                    {/* Pinned / urgent badges */}
                    {item.priority >= 90 && (
                      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: accentColor, fontWeight: 600 }}>📌 Pinned</span>
                      </div>
                    )}
                    {item.mandatory && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', width: 'fit-content' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>⚠️ MANDATORY</span>
                      </div>
                    )}

                    {/* Author row */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${accentColor}25`, color: accentColor, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {itemInitials(item)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB' }}>{itemTypeLabel(item)}</div>
                        <div style={{ fontSize: 12, color: '#4B5563' }}>{formatFeedTime(item.publishedAtIso)} · Priority {item.priority}</div>
                      </div>
                      {!item.isRead && (
                        <span style={{ marginLeft: 'auto', background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.2)', fontSize: 10, padding: '2px 8px', borderRadius: 12, alignSelf: 'flex-start' }}>Unread</span>
                      )}
                    </div>

                    <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 8, lineHeight: 1.4 }}>{item.title}</div>
                    <div style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 16 }}>{item.body}</div>

                    {/* Question detail */}
                    {item.question && (
                      <div style={{ marginTop: 8, padding: 16, borderRadius: 12, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.2)', fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>{item.question.category}</span>
                          {item.question.location?.zipCode && (
                            <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.15)', fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>
                              {item.question.location.zipCode}{item.question.location.radiusMiles ? ` · ${item.question.location.radiusMiles}mi` : ''}
                            </span>
                          )}
                        </div>
                        {item.question.answers.length === 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, color: '#9CA3AF' }}>No assisted answer generated yet.</span>
                            <button onClick={() => void handleAnswerGenerate(item.question!.id)} disabled={busyQuestionId === item.question!.id} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38BDF8', fontSize: 12, cursor: 'pointer', opacity: busyQuestionId === item.question!.id ? 0.6 : 1 }}>
                              {busyQuestionId === item.question!.id ? 'Generating…' : 'Generate Answer'}
                            </button>
                          </div>
                        ) : (
                          item.question.answers.map((answer) => (
                            <div key={answer.id} style={{ marginBottom: 8, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
                                {answer.answerType === 'llm' ? 'Assisted answer' : 'Community answer'}
                                {answer.confidence !== null ? ` · ${Math.round(answer.confidence * 100)}% confidence` : ''}
                                {answer.modelId ? ` · ${answer.modelId}` : ''}
                              </div>
                              <div style={{ fontSize: 13, color: '#E8EAF0', lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-line' }}>{answer.body}</div>
                              {answer.sources.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                                  {answer.sources.map((source) => (
                                    <span key={source.id} style={{ background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>{source.label}</span>
                                  ))}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 8 }}>
                                {(['helpful', 'not_helpful', 'flagged'] as FeedAnswerRatingValue[]).map((rating) => (
                                  <button key={rating} onClick={() => void handleAnswerRating(answer.id, rating)} disabled={busyAnswerId === answer.id} style={{ padding: '4px 12px', borderRadius: 20, background: answer.currentUserRating === rating ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${answer.currentUserRating === rating ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.08)'}`, color: answer.currentUserRating === rating ? '#38BDF8' : '#9CA3AF', fontSize: 11, cursor: 'pointer', opacity: busyAnswerId === answer.id ? 0.6 : 1 }}>
                                    {busyAnswerId === answer.id ? 'Saving…' : `${rating.replace('_', ' ')} · ${answer.ratingSummary[rating]}`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Community detail */}
                    {item.community && (
                      <div style={{ marginTop: 8, padding: 16, borderRadius: 12, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)', fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>{item.community.category.replace('_', ' ')}</span>
                          <span style={{ fontSize: 12, color: '#6B7280' }}>{item.community.replyCount} replies</span>
                        </div>
                        {item.community.replies.map((reply) => (
                          <div key={reply.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
                            <div style={{ fontSize: 13, color: '#E8EAF0' }}>{reply.body}</div>
                            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{formatFeedTime(reply.createdAtIso)}</div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <input
                            value={replyDrafts[item.community.id] ?? ''}
                            onChange={(e) => setReplyDrafts((previous) => ({ ...previous, [item.community!.id]: e.target.value }))}
                            placeholder="Reply to this support post"
                            style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13, outline: 'none' }}
                          />
                          <button onClick={() => void handleCommunityReply(item.community!.id)} disabled={busyPostId === item.community!.id || !(replyDrafts[item.community!.id] ?? '').trim()} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E', fontSize: 12, cursor: 'pointer', opacity: busyPostId === item.community!.id ? 0.6 : 1 }}>
                            {busyPostId === item.community!.id ? 'Posting…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {!item.isRead && (
                        <button onClick={() => void handleItemMutation(item.id, 'read')} disabled={busyItemId === item.id} style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38BDF8', fontSize: 12, cursor: 'pointer', opacity: busyItemId === item.id ? 0.6 : 1 }}>
                          {busyItemId === item.id ? 'Saving…' : '✓ Mark read'}
                        </button>
                      )}
                      {!item.mandatory && (
                        <button onClick={() => void handleItemMutation(item.id, 'dismiss')} disabled={busyItemId === item.id} style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', opacity: busyItemId === item.id ? 0.6 : 1 }}>
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Chat tab */}
        {uiTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24 }}>
            <div style={{ marginBottom: 20, padding: '18px 24px', borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(139,92,246,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>Community Chat</div>
              <div style={{ fontSize: 14, color: '#9CA3AF' }}>Real-time community discussion powered by GetStream</div>
            </div>
            {chatLoading && <div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading chat…</div>}
            {chatError && <div style={{ color: '#EF4444', fontSize: 14 }}>{chatError}</div>}
            {chatCredentials && (
              <div style={{ flex: 1, borderRadius: 14, overflow: 'hidden', border: `1px solid ${COLOR}20` }}>
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

        {/* Admin tab */}
        {uiTab === 'admin' && (
          <div style={{ flex: 1, padding: '32px 40px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB', marginBottom: 20 }}>Admin: Announcements</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { l: 'Total Items', v: String(items.length), c: COLOR },
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
              >
                Open Admin Panel →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <aside style={{ width: 280, borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#0D0F14', padding: '20px 16px', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 12 }}>Live Activity</div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20`, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: COLOR }}>📈</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Feed Stats</span>
          </div>
          {[
            { l: 'Total items', v: String(items.length) },
            { l: 'Questions', v: String(questionCount) },
            { l: 'Community', v: String(communityCount) },
            { l: 'Unread', v: String(unreadCount) },
          ].map(({ l, v }) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', color: '#6B7280' }}>
              <span>{l}</span>
              <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        {alertCount > 0 && (
          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>Active Alerts ({alertCount})</span>
            </div>
            {items.filter(isAlertItem).slice(0, 3).map((item) => (
              <div key={item.id} style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6, lineHeight: 1.4 }}>• {item.title}</div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 10 }}>Trending Tags</div>
        {['#ServiceCredits', '#LightHouseHousing', '#SurvivorStories', '#Phase2Launch'].map((tag) => (
          <div key={tag} style={{ padding: '7px 0', fontSize: 13, cursor: 'pointer' }}>
            <span style={{ color: COLOR }}>{tag}</span>
          </div>
        ))}

        {config && (
          <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 4 }}>Config</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>{config.renderMode === 'card_toast' ? 'Card + toast mode' : 'Card-only mode'}</div>
          </div>
        )}
      </aside>
    </div>
  );
}
