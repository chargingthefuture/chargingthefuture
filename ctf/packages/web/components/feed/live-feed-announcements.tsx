'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

function isAlertItem(item: FeedTimelineItem): boolean {
  return item.mandatory || item.priority >= 80;
}

function formatFeedTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  return date.toLocaleDateString();
}

async function loadFeedSnapshot(): Promise<{ items: FeedTimelineItem[]; config: FeedConfig | null }> {
  const [itemsResponse, configResponse] = await Promise.all([
    fetch('/api/feed/items?page=1&pageSize=24', { cache: 'no-store' }),
    fetch('/api/feed/config', { cache: 'no-store' }),
  ]);

  if (!itemsResponse.ok) {
    throw new Error('Unable to load live feed items.');
  }

  const timeline = await itemsResponse.json() as FeedSnapshotResponse;
  const config = configResponse.ok
    ? ((await configResponse.json()) as FeedConfigResponse).config
    : null;

  return {
    items: timeline.items,
    config,
  };
}

function getVisibleItems(items: FeedTimelineItem[], filter: FeedFilter): FeedTimelineItem[] {
  switch (filter) {
    case 'unread':
      return items.filter((item) => !item.isRead);
    case 'announcements':
    case 'questions':
    case 'community':
      return items.filter((item) => item.itemType === filter.slice(0, -1) || item.itemType === filter);
    case 'all':
    default:
      return items;
  }
}

function getItemAccent(item: FeedTimelineItem): string {
  if (item.itemType === 'question') {
    return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
  }
  if (item.itemType === 'community') {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  }

  return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
}

export function LiveFeedAnnouncements({
  initialItems,
  initialConfig,
  initialError,
  isAdmin,
}: LiveFeedAnnouncementsProps) {
  const [chatCredentials, setChatCredentials] = useState<FeedStreamCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    setChatLoading(true);
    setChatError(null);
    fetch('/api/feed/stream', { method: 'POST' })
      .then(async (res) => {
        const data = await res.json();
        if (data.ok) {
          setChatCredentials({
            streamApiKey: data.streamApiKey,
            streamToken: data.streamToken,
            streamUserId: data.streamUserId,
            streamChannelId: data.streamChannelId,
          });
        } else {
          setChatError(data.message || 'Unable to load chat.');
        }
      })
      .catch((e) => setChatError(e instanceof Error ? e.message : String(e)))
      .finally(() => setChatLoading(false));
  }, []);
  const [items, setItems] = useState(initialItems);
  const [config, setConfig] = useState(initialConfig);
  const [filter, setFilter] = useState<FeedFilter>('all');
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

  const refreshFeed = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setIsRefreshing(true);
    }

    try {
      const snapshot = await loadFeedSnapshot();
      setItems(snapshot.items);
      setConfig(snapshot.config);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the feed right now.');
    } finally {
      if (showSpinner) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshFeed(initialItems.length === 0);
    const timer = window.setInterval(() => {
      void refreshFeed(false);
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
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
      const response = await fetch(`/api/feed/items/${itemId}/${action}`, {
        method: 'POST',
        headers: {
          'x-ctf-csrf': '1',
        },
      });

      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to update the feed item.');
      }

      setItems((previous) => previous.flatMap((item) => {
        if (item.id !== itemId) {
          return [item];
        }

        if (action === 'dismiss' && !item.mandatory) {
          return [];
        }

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
        headers: {
          'Content-Type': 'application/json',
          'x-ctf-csrf': '1',
        },
        body: JSON.stringify({
          body: questionBody,
          category: questionCategory,
          location: questionZipCode.trim().length > 0
            ? { zipCode: questionZipCode.trim(), radiusMiles: Number.parseInt(questionRadius, 10) || 10 }
            : null,
          consentGranted: llmConsentGranted,
        }),
      });

      const questionPayload = await questionResponse.json().catch(() => null) as { message?: string; questionId?: string } | null;
      if (!questionResponse.ok || !questionPayload?.questionId) {
        throw new Error(questionPayload?.message ?? 'Unable to submit the question.');
      }

      const answerResponse = await fetch(`/api/feed/questions/${questionPayload.questionId}/answer`, {
        method: 'POST',
        headers: {
          'x-ctf-csrf': '1',
        },
      });

      if (!answerResponse.ok) {
        const answerPayload = await answerResponse.json().catch(() => null) as { message?: string } | null;
        throw new Error(answerPayload?.message ?? 'Question saved, but assisted answer generation failed.');
      }

      setQuestionBody('');
      setQuestionZipCode('');
      setQuestionRadius('10');
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
      const response = await fetch(`/api/feed/questions/${questionId}/answer`, {
        method: 'POST',
        headers: {
          'x-ctf-csrf': '1',
        },
      });

      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to generate an assisted answer.');
      }

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
        headers: {
          'Content-Type': 'application/json',
          'x-ctf-csrf': '1',
        },
        body: JSON.stringify({ rating }),
      });

      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to rate this answer.');
      }

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
        headers: {
          'Content-Type': 'application/json',
          'x-ctf-csrf': '1',
        },
        body: JSON.stringify({ body: communityBody, category: communityCategory }),
      });

      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to publish the community post.');
      }

      setCommunityBody('');
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
        headers: {
          'Content-Type': 'application/json',
          'x-ctf-csrf': '1',
        },
        body: JSON.stringify({ body: draft }),
      });

      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to publish the community reply.');
      }

      setReplyDrafts((previous) => ({ ...previous, [postId]: '' }));
      await refreshFeed(false);
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'Unable to publish the community reply.');
    } finally {
      setBusyPostId(null);
    }
  }, [refreshFeed, replyDrafts]);

  return (
    <main className="min-h-screen bg-[#090b10] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-sky-200">Live Feed Announcements & Support</h2>
        {chatLoading && <div>Loading chat…</div>}
        {chatError && <div style={{ color: 'red' }}>{chatError}</div>}
        {chatCredentials && (
          <StreamChatPanel
            streamApiKey={chatCredentials.streamApiKey}
            streamToken={chatCredentials.streamToken}
            streamUserId={chatCredentials.streamUserId}
            streamChannelId={chatCredentials.streamChannelId}
          />
        )}
      </section>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(135deg,_#0f172a,_#111827_55%,_#0c1424)] p-5 shadow-lg shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">Unified survivor feed</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Announcements, questions, and community support in one surface</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Feed now runs as a three-channel timeline with LLM-assisted answers, peer support posts, and admin announcements sharing the same read and dismiss model.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{items.length} live items</span>
              <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1">{questionCount} questions</span>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1">{communityCount} community</span>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1">{alertCount} alerts</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{unreadCount} unread</span>
              {config ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {config.renderMode === 'card_toast' ? 'Card + toast mode' : 'Card-only mode'}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              ['all', 'All'],
              ['announcements', 'Announcements'],
              ['questions', 'Questions'],
              ['community', 'Community'],
              ['unread', 'Unread'],
            ] as Array<[FeedFilter, string]>).filter(([value]) => value === 'all' || value === 'unread' || enabledChannels.includes(value)).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  filter === value
                    ? 'bg-sky-500 text-white'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void refreshFeed(true)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            {isAdmin ? (
              <Link
                href="/admin/feed-announcements"
                className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 hover:bg-sky-500/20"
              >
                Open admin
              </Link>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {enabledChannels.includes('questions') ? (
            <article className="rounded-2xl border border-white/10 bg-[#0f172a]/80 p-5 shadow-md shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Questions</p>
                  <h2 className="mt-2 text-xl font-semibold">Ask for guided help</h2>
                </div>
                <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-100">LLM-assisted</span>
              </div>
              <textarea
                value={questionBody}
                onChange={(event) => setQuestionBody(event.target.value)}
                placeholder="Ask a survivor-safe question, for example housing near 90210 or support services nearby."
                className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <select
                  value={questionCategory}
                  onChange={(event) => setQuestionCategory(event.target.value as FeedQuestionCategory)}
                  className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-slate-100"
                >
                  <option value="general">General</option>
                  <option value="housing">Housing</option>
                  <option value="services">Services</option>
                  <option value="safety">Safety</option>
                  <option value="benefits">Benefits</option>
                </select>
                <input
                  value={questionZipCode}
                  onChange={(event) => setQuestionZipCode(event.target.value)}
                  placeholder="ZIP code"
                  className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
                <input
                  value={questionRadius}
                  onChange={(event) => setQuestionRadius(event.target.value)}
                  placeholder="Radius miles"
                  className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={llmConsentGranted}
                  onChange={(event) => setLlmConsentGranted(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                />
                I consent to LLM processing for this question.
              </label>
              <button
                type="button"
                onClick={() => void handleQuestionSubmit()}
                disabled={busyQuestionId === 'new-question' || questionBody.trim().length === 0}
                className="mt-4 rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyQuestionId === 'new-question' ? 'Submitting…' : 'Submit question'}
              </button>
            </article>
          ) : null}

          {enabledChannels.includes('community') ? (
            <article className="rounded-2xl border border-white/10 bg-[#0f172a]/80 p-5 shadow-md shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Community support</p>
                  <h2 className="mt-2 text-xl font-semibold">Share a support update</h2>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">Peer support</span>
              </div>
              <textarea
                value={communityBody}
                onChange={(event) => setCommunityBody(event.target.value)}
                placeholder="Share a request, resource, event, or peer-support note for the community."
                className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <select
                value={communityCategory}
                onChange={(event) => setCommunityCategory(event.target.value as FeedCommunityCategory)}
                className="mt-3 rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-slate-100"
              >
                <option value="general">General</option>
                <option value="peer_support">Peer support</option>
                <option value="resource_share">Resource share</option>
                <option value="event">Event</option>
              </select>
              <button
                type="button"
                onClick={() => void handleCommunitySubmit()}
                disabled={busyPostId === 'new-post' || communityBody.trim().length === 0}
                className="mt-4 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyPostId === 'new-post' ? 'Publishing…' : 'Publish support post'}
              </button>
            </article>
          ) : null}
        </section>

        <section className="grid gap-4">
          {visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-slate-300">
              No live feed items match this filter yet.
            </div>
          ) : (
            visibleItems.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0f172a]/80 p-5 shadow-md shadow-black/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getItemAccent(item)}`}>
                        {item.itemType}
                      </span>
                      {!item.isRead ? (
                        <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
                          Unread
                        </span>
                      ) : null}
                      {isAlertItem(item) ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                          Alert
                        </span>
                      ) : null}
                      {item.mandatory ? (
                        <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-200">
                          Mandatory
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>

                    {item.question ? (
                      <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-sky-100">
                          <span className="rounded-full border border-sky-400/30 px-2.5 py-1">{item.question.category}</span>
                          {item.question.location?.zipCode ? (
                            <span className="rounded-full border border-sky-400/20 px-2.5 py-1">
                              {item.question.location.zipCode}{item.question.location.radiusMiles ? ` · ${item.question.location.radiusMiles} mi` : ''}
                            </span>
                          ) : null}
                        </div>

                        {item.question.answers.length === 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <p className="text-sm text-slate-300">No assisted answer has been generated yet.</p>
                            <button
                              type="button"
                              onClick={() => void handleAnswerGenerate(item.question!.id)}
                              disabled={busyQuestionId === item.question.id}
                              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 hover:bg-sky-500/20 disabled:opacity-60"
                            >
                              {busyQuestionId === item.question.id ? 'Generating…' : 'Generate assisted answer'}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 grid gap-3">
                            {item.question.answers.map((answer) => (
                              <div key={answer.id} className="rounded-2xl border border-white/10 bg-[#08111c] p-4">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                  <span>{answer.answerType === 'llm' ? 'Assisted answer' : 'Community answer'}</span>
                                  {answer.confidence !== null ? <span>Confidence {Math.round(answer.confidence * 100)}%</span> : null}
                                  {answer.modelId ? <span>{answer.modelId}</span> : null}
                                </div>
                                <p className="mt-2 text-sm leading-6 text-slate-200 whitespace-pre-line">{answer.body}</p>
                                {answer.sources.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                                    {answer.sources.map((source) => (
                                      <span key={source.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                        {source.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {(['helpful', 'not_helpful', 'flagged'] as FeedAnswerRatingValue[]).map((rating) => (
                                    <button
                                      key={rating}
                                      type="button"
                                      onClick={() => void handleAnswerRating(answer.id, rating)}
                                      disabled={busyAnswerId === answer.id}
                                      className={`rounded-full border px-3 py-1.5 text-xs ${
                                        answer.currentUserRating === rating
                                          ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
                                          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                                      } disabled:opacity-60`}
                                    >
                                      {busyAnswerId === answer.id ? 'Saving…' : `${rating.replace('_', ' ')} · ${answer.ratingSummary[rating]}`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {item.community ? (
                      <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
                          <span className="rounded-full border border-emerald-400/30 px-2.5 py-1">{item.community.category.replace('_', ' ')}</span>
                          <span>{item.community.replyCount} replies</span>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {item.community.replies.map((reply) => (
                            <div key={reply.id} className="rounded-xl border border-white/10 bg-[#08111c] px-3 py-2">
                              <p className="text-sm text-slate-200">{reply.body}</p>
                              <p className="mt-1 text-xs text-slate-400">{formatFeedTime(reply.createdAtIso)}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <input
                            value={replyDrafts[item.community.id] ?? ''}
                            onChange={(event) => setReplyDrafts((previous) => ({ ...previous, [item.community!.id]: event.target.value }))}
                            placeholder="Reply to this support post"
                            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#08111c] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => void handleCommunityReply(item.community!.id)}
                            disabled={busyPostId === item.community.id || (replyDrafts[item.community.id] ?? '').trim().length === 0}
                            className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                          >
                            {busyPostId === item.community.id ? 'Posting…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="text-xs text-slate-400 sm:text-right">
                    <p>{formatFeedTime(item.publishedAtIso)}</p>
                    <p className="mt-1">Priority {item.priority}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!item.isRead ? (
                    <button
                      type="button"
                      onClick={() => void handleItemMutation(item.id, 'read')}
                      disabled={busyItemId === item.id}
                      className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 hover:bg-sky-500/20 disabled:opacity-60"
                    >
                      {busyItemId === item.id ? 'Saving…' : 'Mark read'}
                    </button>
                  ) : null}
                  {!item.mandatory ? (
                    <button
                      type="button"
                      onClick={() => void handleItemMutation(item.id, 'dismiss')}
                      disabled={busyItemId === item.id}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-60"
                    >
                      Dismiss
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}