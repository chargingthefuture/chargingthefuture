'use client';

import type { FeedCommunityCategory, FeedQuestionCategory } from '../../lib/feed/types';

type QuestionFormProps = {
  questionBody: string;
  questionCategory: FeedQuestionCategory;
  questionZipCode: string;
  questionRadius: string;
  llmConsentGranted: boolean;
  busyQuestionId: string | null;
  enabledChannels: string[];
  onBodyChange: (val: string) => void;
  onCategoryChange: (val: FeedQuestionCategory) => void;
  onZipCodeChange: (val: string) => void;
  onRadiusChange: (val: string) => void;
  onConsentChange: (val: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onSwitchToCommunity: () => void;
};

export function FeedQuestionForm({
  questionBody, questionCategory, questionZipCode, questionRadius,
  llmConsentGranted, busyQuestionId, enabledChannels,
  onBodyChange, onCategoryChange, onZipCodeChange, onRadiusChange,
  onConsentChange, onSubmit, onCancel, onSwitchToCommunity,
}: QuestionFormProps) {
  if (!enabledChannels.includes('questions')) return null;

  return (
    <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid #38BDF840' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB' }}>Ask for Guided Help</div>
        <span style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.25)', fontSize: 11, padding: '2px 10px', borderRadius: 12 }}>LLM-assisted</span>
      </div>
      <textarea
        value={questionBody}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Ask a survivor-safe question, e.g. housing near 90210 or support services nearby."
        rows={3}
        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#E8EAF0', fontSize: 14, resize: 'vertical', outline: 'none', marginBottom: 10, boxSizing: 'border-box' as const }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
        <select value={questionCategory} onChange={(e) => onCategoryChange(e.target.value as FeedQuestionCategory)} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13 }}>
          <option value="general">General</option>
          <option value="housing">Housing</option>
          <option value="services">Services</option>
          <option value="safety">Safety</option>
          <option value="benefits">Benefits</option>
        </select>
        <input value={questionZipCode} onChange={(e) => onZipCodeChange(e.target.value)} placeholder="ZIP code" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13 }} />
        <input value={questionRadius} onChange={(e) => onRadiusChange(e.target.value)} placeholder="Radius miles" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13 }} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>
        <input type="checkbox" checked={llmConsentGranted} onChange={(e) => onConsentChange(e.target.checked)} style={{ width: 16, height: 16 }} />
        I consent to LLM processing for this question.
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSubmit}
          disabled={busyQuestionId === 'new-question' || !questionBody.trim()}
          style={{ padding: '9px 20px', borderRadius: 8, background: '#38BDF8', border: 'none', color: '#0F172A', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busyQuestionId === 'new-question' || !questionBody.trim() ? 0.6 : 1 }}
        >
          {busyQuestionId === 'new-question' ? 'Submitting…' : 'Submit Question'}
        </button>
        {enabledChannels.includes('community') && (
          <button onClick={onSwitchToCommunity} style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22C55E', fontSize: 13, cursor: 'pointer' }}>Switch to Post</button>
        )}
        <button onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

type CommunityFormProps = {
  communityBody: string;
  communityCategory: FeedCommunityCategory;
  busyPostId: string | null;
  enabledChannels: string[];
  onBodyChange: (val: string) => void;
  onCategoryChange: (val: FeedCommunityCategory) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onSwitchToQuestion: () => void;
};

export function FeedCommunityForm({
  communityBody, communityCategory, busyPostId, enabledChannels,
  onBodyChange, onCategoryChange, onSubmit, onCancel, onSwitchToQuestion,
}: CommunityFormProps) {
  if (!enabledChannels.includes('community')) return null;

  return (
    <div style={{ marginBottom: 16, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid #22C55E40' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB' }}>Share a Support Update</div>
        <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)', fontSize: 11, padding: '2px 10px', borderRadius: 12 }}>Peer support</span>
      </div>
      <textarea
        value={communityBody}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Share a request, resource, event, or peer-support note for the community."
        rows={3}
        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#E8EAF0', fontSize: 14, resize: 'vertical', outline: 'none', marginBottom: 10, boxSizing: 'border-box' as const }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select value={communityCategory} onChange={(e) => onCategoryChange(e.target.value as FeedCommunityCategory)} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 13 }}>
          <option value="general">General</option>
          <option value="peer_support">Peer support</option>
          <option value="resource_share">Resource share</option>
          <option value="event">Event</option>
        </select>
        {enabledChannels.includes('questions') && (
          <button onClick={onSwitchToQuestion} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38BDF8', fontSize: 13, cursor: 'pointer' }}>
            Switch to Question
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSubmit}
          disabled={busyPostId === 'new-post' || !communityBody.trim()}
          style={{ padding: '9px 20px', borderRadius: 8, background: '#22C55E', border: 'none', color: '#0F172A', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busyPostId === 'new-post' || !communityBody.trim() ? 0.6 : 1 }}
        >
          {busyPostId === 'new-post' ? 'Publishing…' : 'Publish Post'}
        </button>
        <button onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
