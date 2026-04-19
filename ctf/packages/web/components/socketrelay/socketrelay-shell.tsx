"use client";

import { useEffect, useState } from "react";
import { StreamChatPanel } from '../shared/stream-chat-panel';

export function SocketRelayShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [openRequests, setOpenRequests] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [fulfillments, setFulfillments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFulfillment, setSelectedFulfillment] = useState<any>(null);
  const [chatCredentials, setChatCredentials] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Hoist fetchData for reuse, allow silent refresh to avoid UI flicker
  async function fetchData(options?: { showLoading?: boolean }) {
    const showLoading = options?.showLoading !== false;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [profileRes, openReqRes, myReqRes, fulfillmentsRes] = await Promise.all([
        fetch('/api/socketrelay/profile'),
        fetch('/api/socketrelay/requests'),
        fetch('/api/socketrelay/my-requests'),
        fetch('/api/socketrelay/my-fulfillments'),
      ]);
      if (!profileRes.ok) throw new Error('Failed to load profile');
      if (!openReqRes.ok) throw new Error('Failed to load open requests');
      if (!myReqRes.ok) throw new Error('Failed to load my requests');
      if (!fulfillmentsRes.ok) throw new Error('Failed to load fulfillments');
      setProfile(await profileRes.json());
      setOpenRequests(await openReqRes.json());
      setMyRequests(await myReqRes.json());
      setFulfillments(await fulfillmentsRes.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load SocketRelay data.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCreateRequest(request: any) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/socketrelay/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error('Failed to create request');
      await fetchData({ showLoading: false });
    } catch (e: any) {
      setError(e.message || 'Failed to create request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaimFulfillment(id: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/socketrelay/requests/${id}/fulfill`, {
        method: 'POST' });
      if (!res.ok) throw new Error('Failed to claim fulfillment');
      await fetchData({ showLoading: false });
    } catch (e: any) {
      setError(e.message || 'Failed to claim fulfillment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading SocketRelay…</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!profile) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">SocketRelay</h2>
        <p className="mb-4">Create your SocketRelay profile to start.</p>
      </div>
    );
  }
  // ...existing code...

  // Chat integration UI
  return (
    <div>
      {/* Fulfillment Chat Section */}
      <section style={{ marginBottom: 32 }}>
        <h2 className="text-xl font-bold mb-2">Chat with Fulfillment</h2>
        <label htmlFor="fulfillment-select" style={{ marginRight: 8 }}>Select Fulfillment:</label>
        <select
          id="fulfillment-select"
          value={selectedFulfillment?.id || ''}
          onChange={async e => {
            const fulfillment = fulfillments.find((f: any) => f.id === e.target.value) || null;
            setSelectedFulfillment(fulfillment);
            setChatCredentials(null);
            setChatError(null);
            if (fulfillment) {
              setChatLoading(true);
              try {
                const res = await fetch(`/api/socketrelay/fulfillments/${fulfillment.id}/chat`, { method: 'POST' });
                if (!res.ok) throw new Error('Failed to fetch chat credentials');
                const data = await res.json();
                if (!data.ok) throw new Error(data.message || 'No chat credentials');
                setChatCredentials(data);
              } catch (e: any) {
                setChatError(e.message || 'Failed to load chat');
              } finally {
                setChatLoading(false);
              }
            }
          }}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 15 }}
        >
          <option value="">-- Select a fulfillment --</option>
          {fulfillments.map((f: any) => (
            <option key={f.id} value={f.id}>Fulfillment {f.id}</option>
          ))}
        </select>
        <div style={{ marginTop: 16, minHeight: 200 }}>
          {!selectedFulfillment && <div style={{ color: '#888' }}>Select a fulfillment to start chatting.</div>}
          {selectedFulfillment && chatLoading && <div>Loading chat…</div>}
          {selectedFulfillment && chatError && <div style={{ color: 'red' }}>{chatError}</div>}
          {selectedFulfillment && chatCredentials && (
            <StreamChatPanel
              streamApiKey={chatCredentials.streamApiKey}
              streamToken={chatCredentials.streamToken}
              streamUserId={chatCredentials.streamUserId}
              streamChannelId={chatCredentials.streamChannelId || selectedFulfillment.id}
            />
          )}
        </div>
      </section>
      {/* ...existing UI code for openRequests, myRequests, etc. ... */}
    </div>
  );
}
