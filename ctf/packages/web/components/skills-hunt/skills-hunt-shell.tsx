"use client";

import { useEffect, useState } from "react";

export function SkillsHuntShell(_props: { userId?: string; isAdmin?: boolean; isModerator?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [roundsRes, achievementsRes] = await Promise.all([
          fetch('/api/skills-hunt/rounds', { signal: controller.signal }),
          fetch('/api/skills-hunt/achievements', { signal: controller.signal }),
        ]);
        if (!roundsRes.ok) throw new Error('Failed to load rounds');
        if (!achievementsRes.ok) throw new Error('Failed to load achievements');
        if (controller.signal.aborted) return;
        setRounds(await roundsRes.json());
        setAchievements(await achievementsRes.json());
      } catch (e: any) {
        if (e.name === 'AbortError' || controller.signal.aborted) return;
        setError(e.message || 'Failed to load skills hunt data.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedRound) return;
    const controller = new AbortController();
    async function fetchLeaderboard() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/skills-hunt/rounds/${selectedRound}/leaderboard`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load leaderboard');
        if (controller.signal.aborted) return;
        setLeaderboard(await res.json());
      } catch (e: any) {
        if (e.name === 'AbortError' || controller.signal.aborted) return;
        setError(e.message || 'Failed to load leaderboard.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchLeaderboard();
    return () => controller.abort();
  }, [selectedRound]);

  async function handleSubmitChallenge(roundId: string, submission: any) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills-hunt/rounds/${roundId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!res.ok) throw new Error('Failed to submit challenge');
      // Refetch leaderboard for the selected round after successful submission
      if (selectedRound === roundId) {
        try {
          const leaderboardRes = await fetch(`/api/skills-hunt/rounds/${roundId}/leaderboard`);
          if (leaderboardRes.ok) {
            setLeaderboard(await leaderboardRes.json());
          } else {
            const text = await leaderboardRes.text();
            console.error('Failed to refresh leaderboard:', leaderboardRes.status, leaderboardRes.statusText, text);
            setError(`Leaderboard refresh failed: ${leaderboardRes.status} ${leaderboardRes.statusText}`);
          }
        } catch (err: any) {
          console.error('Network error refreshing leaderboard:', err);
          setError(err.message ? `Leaderboard refresh failed: ${err.message}` : 'Leaderboard refresh failed.');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to submit challenge.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading skill challenges…</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!rounds.length) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Skills Hunt</h2>
        <p className="mb-4">No active skill challenges right now. Check back soon!</p>
      </div>
    );
  }
  // ...existing code...

  // ...existing UI code, now using rounds, achievements, leaderboard, handlers...
  return (
    <div>
      {/* Skills Hunt UI goes here, using fetched data and handlers */}
      {/* Render achievements section or placeholder inline */}
      <section>
        <h2 className="text-xl font-bold mb-2">Achievements</h2>
        {achievements.length ? (
          <ul>
            {achievements.map((a: any) => (
              <li key={a.id}>{a.name}</li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-center text-muted-foreground">Complete challenges to earn achievements.</div>
        )}
      </section>
    </div>
  );
}
