"use client";
import React, { useEffect, useState } from 'react';

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
    try {
      const res = await fetch('/api/foundation/connections/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: provider.profileId }),
      });
      const data = await res.json();
      if (data.ok) {
        setConnectionStatus('Connection thread created!');
      } else {
        setConnectionStatus(data.message || 'Failed to create connection');
      }
    } catch (e: any) {
      setConnectionStatus(e.message || 'Error connecting');
    } finally {
      setConnecting(false);
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
