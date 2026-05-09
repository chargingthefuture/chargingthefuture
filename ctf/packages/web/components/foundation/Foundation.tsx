"use client";

import React, { useEffect, useState } from 'react';
import { StreamChatPanel } from '../shared/stream-chat-panel';
import { StreamVideoPanel } from '../shared/stream-video-panel';

type Provider = {
  profileId: string;
  providerUserId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  score: number;
};

type ProviderSearchResult = {
  ok: boolean;
  items: Provider[];
  total: number;
  pagination: { page: number; pageSize: number };
};

type ChatCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId?: string;
};

type CallCredentials = {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamCallId: string;
  modality: 'voice' | 'video';
};

export function Foundation() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [chatCredentials, setChatCredentials] = useState<ChatCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [callCredentials, setCallCredentials] = useState<CallCredentials | null>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/foundation/providers/search?q=${encodeURIComponent(query)}&page=${page}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch providers');
        const data: ProviderSearchResult = await res.json();
        setProviders(data.items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [query, page]);

  const handleConnect = async (provider: Provider) => {
    setConnecting(true);
    setConnectionStatus(null);
    setChatCredentials(null);
    setChatError(null);
    setCallCredentials(null);
    setThreadId(null);
    try {
      setChatLoading(true);
      const res = await fetch('/api/foundation/connections/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ctf-csrf': '1',
        },
        body: JSON.stringify({ providerId: provider.profileId }),
      });
      const data = await res.json();
      const threadId = data.thread?.id;
      const streamChannelId = data.thread?.streamChannelId;
      if (data.ok && threadId && streamChannelId && data.streamApiKey && data.streamToken && data.streamUserId) {
        setConnectionStatus('Connection thread created!');
        setThreadId(threadId);
        setChatCredentials({
          streamApiKey: data.streamApiKey,
          streamToken: data.streamToken,
          streamUserId: data.streamUserId,
          streamChannelId,
        });
      } else {
        setConnectionStatus(data.message || 'Failed to create connection');
        setChatError('Connection response missing required fields.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error connecting';
      setConnectionStatus(msg);
      setChatError(msg);
    } finally {
      setConnecting(false);
      setChatLoading(false);
    }
  };

  const handleStartCall = async (modality: 'voice' | 'video') => {
    if (!threadId || !chatCredentials) return;
    setCallLoading(true);
    setCallError(null);
    setCallCredentials(null);
    try {
      const res = await fetch(
        `/api/foundation/connections/threads/${threadId}/calls`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ctf-csrf': '1',
          },
          body: JSON.stringify({ modality }),
        },
      );
      const data = await res.json();
      if (data.ok && data.streamApiKey && data.joinToken && data.streamUserId && data.streamCallId) {
        setCallCredentials({
          streamApiKey: data.streamApiKey,
          streamToken: data.joinToken,
          streamUserId: data.streamUserId,
          streamCallId: data.streamCallId,
          modality,
        });
      } else {
        setCallError(data.message || 'Failed to start call');
      }
    } catch (e: unknown) {
      setCallError(e instanceof Error ? e.message : 'Error starting call');
    } finally {
      setCallLoading(false);
    }
  };

  const handleEndCall = () => setCallCredentials(null);

  if (selected) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={() => { setSelected(null); setCallCredentials(null); setChatCredentials(null); setThreadId(null); }} style={{ marginBottom: 16 }}>
          &larr; Back to list
        </button>
        <h2>{selected.displayName}</h2>
        <p>{selected.headline}</p>
        <p>{selected.bio}</p>
        <button onClick={() => handleConnect(selected)} disabled={connecting}>
          {connecting ? 'Connecting...' : chatCredentials ? 'Reconnect' : 'Connect'}
        </button>
        {connectionStatus && <div style={{ marginTop: 12 }}>{connectionStatus}</div>}
        {chatLoading && <div>Loading chat…</div>}
        {chatError && <div style={{ color: 'red' }}>{chatError}</div>}

        {chatCredentials && (
          <div style={{ marginTop: 24 }}>
            <h3>Live Chat</h3>
            <StreamChatPanel
              streamApiKey={chatCredentials.streamApiKey}
              streamToken={chatCredentials.streamToken}
              streamUserId={chatCredentials.streamUserId}
              streamChannelId={chatCredentials.streamChannelId || ''}
            />
          </div>
        )}

        {chatCredentials && threadId && !callCredentials && (
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button
              onClick={() => handleStartCall('voice')}
              disabled={callLoading}
              style={{ padding: '8px 16px' }}
            >
              {callLoading ? 'Starting…' : 'Start Voice Call'}
            </button>
            <button
              onClick={() => handleStartCall('video')}
              disabled={callLoading}
              style={{ padding: '8px 16px' }}
            >
              {callLoading ? 'Starting…' : 'Start Video Call'}
            </button>
          </div>
        )}

        {callError && <div style={{ color: 'red', marginTop: 8 }}>{callError}</div>}

        {callCredentials && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>
                {callCredentials.modality === 'voice' ? 'Voice Call' : 'Video Call'}
              </h3>
              <button onClick={handleEndCall} style={{ padding: '4px 12px' }}>
                End Call
              </button>
            </div>
            <StreamVideoPanel
              streamApiKey={callCredentials.streamApiKey}
              streamToken={callCredentials.streamToken}
              streamUserId={callCredentials.streamUserId}
              streamChannelId={callCredentials.streamCallId}
              callType={callCredentials.modality === 'voice' ? 'audio_room' : 'default'}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Find Providers</h1>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search providers..."
        style={{ marginBottom: 16, padding: 8, width: 300 }}
      />
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <ul>
        {providers.map((p) => (
          <li key={p.profileId} style={{ marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
            <strong>{p.displayName}</strong> <br />
            <span>{p.headline}</span>
            <div>
              <button onClick={() => setSelected(p)}>View</button>
            </div>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => setPage(page - 1)} disabled={page === 1}>Prev</button>
        <span style={{ margin: '0 12px' }}>Page {page}</span>
        <button onClick={() => setPage(page + 1)} disabled={providers.length === 0}>Next</button>
      </div>
    </div>
  );
}
