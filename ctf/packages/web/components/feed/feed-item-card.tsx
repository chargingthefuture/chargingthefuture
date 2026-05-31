'use client';

import { Pin, AlertCircle } from 'lucide-react';
import type {
  FeedAnswerRatingValue,
  FeedTimelineItem,
} from '../../lib/feed/types';

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
  if (item.itemType === 'question') return 'Question';
  if (item.itemType === 'community') return 'Community';
  return 'Announcement';
}

function itemInitials(item: FeedTimelineItem): string {
  if (item.itemType === 'question') return 'Q';
  if (item.itemType === 'community') return 'CM';
  return 'ANN';
}

type FeedItemCardProps = {
  item: FeedTimelineItem;
  busyItemId: string | null;
  busyAnswerId: string | null;
  busyQuestionId: string | null;
  busyPostId: string | null;
  replyDrafts: Record<string, string>;
  onRead: (itemId: string) => void;
  onDismiss: (itemId: string) => void;
  onAnswerGenerate: (questionId: string) => void;
  onAnswerRating: (answerId: string, rating: FeedAnswerRatingValue) => void;
  onReplyChange: (postId: string, value: string) => void;
  onReply: (postId: string) => void;
};

export function FeedItemCard({
  item, busyItemId, busyAnswerId, busyQuestionId, busyPostId,
  replyDrafts, onRead, onDismiss, onAnswerGenerate, onAnswerRating,
  onReplyChange, onReply,
}: FeedItemCardProps) {
  const accentColor = itemTypeColor(item);
  const isPinned = item.priority >= 90;

  return (
    <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${item.mandatory || isPinned ? accentColor + '40' : 'rgba(255,255,255,0.06)'}`, position: 'relative' }}>
      {isPinned && (
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Pin size={12} style={{ color: accentColor }} />
          <span style={{ fontSize: 11, color: accentColor, fontWeight: 600 }}>Pinned</span>
        </div>
      )}
      {item.mandatory && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', width: 'fit-content' }}>
          <AlertCircle size={12} style={{ color: '#EF4444' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>MANDATORY</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${accentColor}25`, color: accentColor, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {itemInitials(item)}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB' }}>{itemTypeLabel(item)}</div>
          <div style={{ fontSize: 12, color: '#4B5563' }}>{formatFeedTime(item.publishedAtIso)}</div>
        </div>
        {!item.isRead && (
          <span style={{ marginLeft: 'auto', background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.2)', fontSize: 10, padding: '2px 8px', borderRadius: 12, alignSelf: 'flex-start' }}>Unread</span>
        )}
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 8, lineHeight: 1.4 }}>{item.title}</div>
      <div style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 16 }}>{item.body}</div>

      {item.question && (
        <FeedQuestionDetail
          question={item.question}
          busyAnswerId={busyAnswerId}
          busyQuestionId={busyQuestionId}
          onAnswerGenerate={onAnswerGenerate}
          onAnswerRating={onAnswerRating}
        />
      )}

      {item.community && (
        <FeedCommunityDetail
          community={item.community}
          busyPostId={busyPostId}
          replyDraft={replyDrafts[item.community.id] ?? ''}
          onReplyChange={(val) => onReplyChange(item.community!.id, val)}
          onReply={() => onReply(item.community!.id)}
        />
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {!item.isRead && (
          <button
            onClick={() => onRead(item.id)}
            disabled={busyItemId === item.id}
            style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38BDF8', fontSize: 12, cursor: 'pointer', opacity: busyItemId === item.id ? 0.6 : 1 }}
          >
            {busyItemId === item.id ? 'Saving…' : 'Mark read'}
          </button>
        )}
        {!item.mandatory && (
          <button
            onClick={() => onDismiss(item.id)}
            disabled={busyItemId === item.id}
            style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', opacity: busyItemId === item.id ? 0.6 : 1 }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

type QuestionDetailProps = {
  question: NonNullable<FeedTimelineItem['question']>;
  busyAnswerId: string | null;
  busyQuestionId: string | null;
  onAnswerGenerate: (questionId: string) => void;
  onAnswerRating: (answerId: string, rating: FeedAnswerRatingValue) => void;
};

function FeedQuestionDetail({ question, busyAnswerId, busyQuestionId, onAnswerGenerate, onAnswerRating }: QuestionDetailProps) {
  return (
    <div style={{ marginTop: 8, padding: 16, borderRadius: 12, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 10 }}>
        <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.2)', fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>{question.category}</span>
        {question.location?.zipCode && (
          <span style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.15)', fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>
            {question.location.zipCode}{question.location.radiusMiles ? ` · ${question.location.radiusMiles}mi` : ''}
          </span>
        )}
      </div>
      {question.answers.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>No assisted answer generated yet.</span>
          <button
            onClick={() => onAnswerGenerate(question.id)}
            disabled={busyQuestionId === question.id}
            style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38BDF8', fontSize: 12, cursor: 'pointer', opacity: busyQuestionId === question.id ? 0.6 : 1 }}
          >
            {busyQuestionId === question.id ? 'Generating…' : 'Generate Answer'}
          </button>
        </div>
      ) : (
        question.answers.map((answer) => (
          <div key={answer.id} style={{ marginBottom: 8, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
              {answer.answerType === 'llm' ? 'Assisted answer' : 'Community answer'}
              {answer.confidence !== null ? ` · ${Math.round(answer.confidence * 100)}% confidence` : ''}
              {answer.modelId ? ` · ${answer.modelId}` : ''}
            </div>
            <div style={{ fontSize: 13, color: '#E8EAF0', lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-line' as const }}>{answer.body}</div>
            {answer.sources.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                {answer.sources.map((source) => (
                  <span key={source.id} style={{ background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>{source.label}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['helpful', 'not_helpful', 'flagged'] as FeedAnswerRatingValue[]).map((rating) => (
                <button
                  key={rating}
                  onClick={() => onAnswerRating(answer.id, rating)}
                  disabled={busyAnswerId === answer.id}
                  style={{ padding: '4px 12px', borderRadius: 20, background: answer.currentUserRating === rating ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${answer.currentUserRating === rating ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.08)'}`, color: answer.currentUserRating === rating ? '#38BDF8' : '#9CA3AF', fontSize: 11, cursor: 'pointer', opacity: busyAnswerId === answer.id ? 0.6 : 1 }}
                >
                  {busyAnswerId === answer.id ? 'Saving…' : `${rating.replace('_', ' ')} · ${answer.ratingSummary[rating]}`}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

type CommunityDetailProps = {
  community: NonNullable<FeedTimelineItem['community']>;
  busyPostId: string | null;
  replyDraft: string;
  onReplyChange: (val: string) => void;
  onReply: () => void;
};

function FeedCommunityDetail({ community, busyPostId, replyDraft, onReplyChange, onReply }: CommunityDetailProps) {
  return (
    <div style={{ marginTop: 8, padding: 16, borderRadius: 12, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)', fontSize: 11, padding: '2px 10px', borderRadius: 20 }}>{community.category.replace('_', ' ')}</span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{community.replyCount} replies</span>
      </div>
      {community.replies.map((reply) => (
        <div key={reply.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: '#E8EAF0' }}>{reply.body}</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{new Date(reply.createdAtIso).toLocaleDateString()}</div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={replyDraft}
          onChange={(e) => onReplyChange(e.target.value)}
          placeholder="Reply to this support post"
          style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13, outline: 'none' }}
        />
        <button
          onClick={onReply}
          disabled={busyPostId === community.id || !replyDraft.trim()}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E', fontSize: 12, cursor: 'pointer', opacity: busyPostId === community.id ? 0.6 : 1 }}
        >
          {busyPostId === community.id ? 'Posting…' : 'Reply'}
        </button>
      </div>
    </div>
  );
}

