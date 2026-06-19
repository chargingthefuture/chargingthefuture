"use client";

import React, { useEffect, useState } from 'react';
import { StreamChatPanel } from '../shared/stream-chat-panel';

// Chat credentials type for StreamChatPanel
export interface ChatCredentials {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId?: string;
}

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

export function Foundation() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [chatCredentials, setChatCredentials] = useState<ChatCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
    try {
      setChatLoading(true);
      const res = await fetch('/api/foundation/connections/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: provider.profileId }),
      });
      const data = await res.json();
      if (data.ok) {
        setConnectionStatus('Connection thread created!');
        setChatCredentials({
          streamApiKey: data.streamApiKey,
          streamToken: data.streamToken,
          streamUserId: data.streamUserId,
          streamChannelId: data.thread?.streamChannelId,
        });
      } else {
        setConnectionStatus(data.message || 'Failed to create connection');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error connecting';
      setConnectionStatus(msg);
      setChatError(msg);
    } finally {
      setConnecting(false);
      setChatLoading(false);
    }
  };

  if (selected) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={() => setSelected(null)} style={{ marginBottom: 16 }}>&larr; Back to list</button>
        <h2>{selected.displayName}</h2>
        <p>{selected.headline}</p>
        <p>{selected.bio}</p>
        <button onClick={() => handleConnect(selected)} disabled={connecting}>
          {connecting ? 'Connecting...' : 'Connect'}
        </button>
        {connectionStatus && <div style={{ marginTop: 12 }}>{connectionStatus}</div>}
        {chatLoading && <div>Loading chat…</div>}
        {chatError && <div style={{ color: 'red' }}>{chatError}</div>}
        {chatCredentials?.streamChannelId && (
          <div style={{ marginTop: 24 }}>
            <h3>Live Chat</h3>
            <StreamChatPanel
              streamApiKey={chatCredentials.streamApiKey}
              streamToken={chatCredentials.streamToken}
              streamUserId={chatCredentials.streamUserId}
              streamChannelId={chatCredentials.streamChannelId}
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
