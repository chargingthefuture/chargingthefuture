"use client";

import React, { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { MAX_NOTES_LENGTH } from "../../lib/clicklog/constants";
import type { ClicklogIncident } from "../../lib/clicklog/types";

interface ClicklogShellProps {
  userId: string;
}

export function ClicklogShell({ userId }: ClicklogShellProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<ClicklogIncident[]>([]);
  const [count, setCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [geo, setGeo] = useState<{ latitude?: number; longitude?: number }>({});

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clicklog");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      const data = await res.json();
      setIncidents(data.incidents);
      setCount(data.count);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleLogIncident = async () => {
    setShowModal(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {
          setGeo({});
        }
      );
    }
  };

  const submitIncident = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clicklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: { ...geo, notes } }),
      });
      if (!res.ok) throw new Error("Failed to log incident");
      setShowModal(false);
      setNotes("");
      setGeo({});
      await fetchIncidents();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this incident?')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clicklog/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete incident");
      await fetchIncidents();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      <aside className="w-[72px] bg-muted flex flex-col items-center py-4">
        <span className="text-3xl">📍</span>
      </aside>
      <main className="flex-1 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl font-bold">{count}</div>
          <div className="text-lg">Incidents logged</div>
          <Button onClick={handleLogIncident} disabled={loading} className="ml-auto">
            Log Incident
          </Button>
        </div>
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <ScrollArea className="h-96 border rounded-lg p-2 bg-white">
          {incidents.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">No incidents logged yet.</div>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between border-b py-2">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {new Date(incident.created_at).toLocaleString()}
                  </div>
                  {incident.metadata.latitude && incident.metadata.longitude && (
                    <div className="text-xs">
                      Location: {incident.metadata.latitude.toFixed(4)}, {incident.metadata.longitude.toFixed(4)}
                    </div>
                  )}
                  {incident.metadata.notes && (
                    <div className="text-xs italic">{incident.metadata.notes}</div>
                  )}
                </div>
                <Button variant="ghost" onClick={() => handleDelete(incident.id)} disabled={loading}>
                  Delete
                </Button>
              </div>
            ))
          )}
        </ScrollArea>
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-80 shadow-lg">
              <h2 className="text-lg font-semibold mb-2">Log Incident</h2>
              <textarea
                className="w-full border rounded p-2 mb-2"
                rows={3}
                placeholder="Optional notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={MAX_NOTES_LENGTH}
              />
              <div className="flex gap-2 mt-2">
                <Button onClick={submitIncident} disabled={loading}>
                  Submit
                </Button>
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
