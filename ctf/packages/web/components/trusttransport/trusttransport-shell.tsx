"use client";

import { useEffect, useState } from "react";

export function TrustTransportShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modes, setModes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  // ...existing UI code, now using modes, requests, payouts, handlers...
  return (
    <div>
      {/* TrustTransport UI goes here, using fetched data and handlers */}
    </div>
  );
}
