"use client";

import { useEffect, useState } from "react";

export function SocketRelayShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [openRequests, setOpenRequests] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [fulfillments, setFulfillments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  // ...existing UI code, now using profile, openRequests, myRequests, fulfillments, handlers...
  return (
    <div>
      {/* Open Requests Section */}
      <section>
        <h2 className="text-xl font-bold mb-2">Open Requests</h2>
        {openRequests.length ? (
          <ul>
            {openRequests.map((req: any) => (
              <li key={req.id}>{req.title}</li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-center text-muted-foreground">No open requests</div>
        )}
      </section>
      {/* My Requests Section */}
      <section>
        <h2 className="text-xl font-bold mb-2">My Requests</h2>
        {myRequests.length ? (
          <ul>
            {myRequests.map((req: any) => (
              <li key={req.id}>{req.title}</li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-center text-muted-foreground">You haven't made any requests yet</div>
        )}
      </section>
      {/* Fulfillments Section (if needed) */}
      {/* Add more sections as needed, e.g., fulfillments */}
    </div>
  );
}
