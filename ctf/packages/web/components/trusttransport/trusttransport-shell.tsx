"use client";


import { useEffect, useState } from "react";
import { StreamChatPanel } from '../shared/stream-chat-panel';

// Types for TrustTransport
export interface Mode {
  id: string;
  name: string;
  // Add more fields as needed
}

export interface Request {
  id: string;
  // Add more fields as needed
}

export interface Payout {
  id: string;
  // Add more fields as needed
}

export interface ChatCredentials {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId?: string;
  ok?: boolean;
  message?: string;
}

export function TrustTransportShell(_props: { userId?: string; isAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modes, setModes] = useState<Mode[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [chatCredentials, setChatCredentials] = useState<ChatCredentials | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [modesRes, requestsRes, payoutsRes] = await Promise.all([
          fetch('/api/trusttransport/modes'),
          fetch('/api/trusttransport/requests'),
          fetch('/api/trusttransport/payouts'),
        ]);
        if (!modesRes.ok) throw new Error('Failed to load modes');
        if (!requestsRes.ok) throw new Error('Failed to load requests');
        if (!payoutsRes.ok) throw new Error('Failed to load payouts');
        setModes(await modesRes.json());
        setRequests(await requestsRes.json());
        setPayouts(await payoutsRes.json());
      } catch (e: any) {
        setError(e.message || 'Failed to load TrustTransport data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleCreateRequest(request: any) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/trusttransport/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error('Failed to create request');
      const requestsRes = await fetch('/api/trusttransport/requests');
      if (requestsRes.ok) setRequests(await requestsRes.json());
    } catch (e: any) {
      setError(e.message || 'Failed to create request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcceptOffer(offerId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trusttransport/offers/${offerId}/accept`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to accept offer');
      const [requestsRes, payoutsRes] = await Promise.all([
        fetch('/api/trusttransport/requests'),
        fetch('/api/trusttransport/payouts'),
      ]);
      if (requestsRes.ok) setRequests(await requestsRes.json());
      if (payoutsRes.ok) setPayouts(await payoutsRes.json());
    } catch (e: any) {
      setError(e.message || 'Failed to accept offer.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading TrustTransport…</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!requests.length) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">TrustTransport</h2>
        <p className="mb-4">No active transport requests</p>
        <p className="mb-4">Request a ride or delivery to get started</p>
      </div>
    );
  }

  // Helper to fetch chat credentials for a request
  async function fetchChatForRequest(requestId: string) {
    const req = requests.find((r) => r.id === requestId) || null;
    setSelectedRequest(req);
    setChatCredentials(null);
    setChatError(null);
    if (req) {
      setChatLoading(true);
      try {
        const res = await fetch(`/api/trusttransport/trips/${req.id}/chat`, { method: 'POST' });
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
  }

  // Chat integration UI
  return (
    <div>
      {/* Request Chat Section */}
      <section style={{ marginBottom: 32 }}>
        <h2 className="text-xl font-bold mb-2">Chat with Trip</h2>
        <label htmlFor="request-select" style={{ marginRight: 8 }}>Select Trip Request:</label>
        <select
          id="request-select"
          value={selectedRequest?.id || ''}
          onChange={e => fetchChatForRequest(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 15 }}
        >
          <option value="">-- Select a trip --</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>Trip {r.id}</option>
          ))}
        </select>
        <div style={{ marginTop: 16, minHeight: 200 }}>
          {!selectedRequest && <div style={{ color: '#888' }}>Select a trip to start chatting.</div>}
          {selectedRequest && chatLoading && <div>Loading chat…</div>}
          {selectedRequest && chatError && <div style={{ color: 'red' }}>{chatError}</div>}
          {selectedRequest && chatCredentials && (
            <StreamChatPanel
              streamApiKey={chatCredentials.streamApiKey}
              streamToken={chatCredentials.streamToken}
              streamUserId={chatCredentials.streamUserId}
              streamChannelId={chatCredentials.streamChannelId || selectedRequest.id}
            />
          )}
        </div>
      </section>
      {/* ...existing UI code for requests, payouts, etc. ... */}
    </div>
  );
}
