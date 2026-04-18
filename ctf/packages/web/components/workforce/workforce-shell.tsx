
"use client";
// Placeholder for real Workforce implementation

type WorkforceShellProps = {
  isAdmin: boolean;
};



// ...existing code...






import { AuthProvider, useAuth } from '../../lib/auth/client-context';
import React, { useEffect, useState } from 'react';


type Profile = {
  name: string;
  role: string;
  skills: string[];
  region: string;
  status: string;
};


function WorkforceShellInner(props: WorkforceShellProps) {
  const auth = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Fetch real data from API endpoints
  // - /api/workforce/dashboard: for charts and workforce stats
  // - /api/workforce/profile: for user profile
  // - /api/workforce/reports/summary: for skill gaps and summary
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, dashboardRes, summaryRes] = await Promise.all([
          fetch('/api/workforce/profile'),
          fetch('/api/workforce/dashboard'),
          fetch('/api/workforce/reports/summary'),
        ]);
        if (!profileRes.ok) throw new Error('Failed to load profile');
        if (!dashboardRes.ok) throw new Error('Failed to load dashboard');
        if (!summaryRes.ok) throw new Error('Failed to load summary');
        const profileData = await profileRes.json();
        setProfile(profileData.profile || null);
        // Parse and store dashboard and summary data
        try {
          const dashboardData = await dashboardRes.json();
          setDashboard(dashboardData || null);
        } catch {
          setDashboard(null);
        }
        try {
          const summaryData = await summaryRes.json();
          setSummary(summaryData || null);
        } catch {
          setSummary(null);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load workforce data.');
      } finally {
        setLoading(false);
      }
    }
    if (auth.isAuthenticated) {
      fetchAll();
    } else {
      setLoading(false);
      setProfile(null);
      setError(null);
    }
  }, [auth.isAuthenticated]);

  if (!auth.isAuthenticated) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#0F1117', color: '#E8EAF0', fontFamily: 'Inter, system-ui, sans-serif', padding: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32 }}>Sign in required</h1>
        <div style={{ fontSize: 18, color: '#9CA3AF', marginTop: 24 }}>Please sign in to view your Workforce profile.</div>
        <button style={{ marginTop: 24, padding: '10px 24px', fontSize: 16, background: '#6366F1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }} onClick={auth.signIn}>Sign In</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#0F1117', color: '#E8EAF0', fontFamily: 'Inter, system-ui, sans-serif', padding: 32 }}>
        <div style={{ fontSize: 22, color: '#6366F1', marginTop: 40 }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#0F1117', color: '#E8EAF0', fontFamily: 'Inter, system-ui, sans-serif', padding: 32 }}>
        <div style={{ fontSize: 22, color: '#EF4444', marginTop: 40 }}>{error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#0F1117', color: '#E8EAF0', fontFamily: 'Inter, system-ui, sans-serif', padding: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32 }}>My Workforce Profile</h1>
        <div style={{ fontSize: 18, color: '#9CA3AF', marginTop: 24 }}>No profile data found. Complete your profile to get started.</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#0F1117', color: '#E8EAF0', fontFamily: 'Inter, system-ui, sans-serif', padding: 32 }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32 }}>My Workforce Profile</h1>
      <section style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 18, color: '#6366F1', fontWeight: 700, marginBottom: 10 }}>Name:</div>
        <div style={{ fontSize: 18, marginBottom: 16 }}>{profile.name}</div>
        <div style={{ fontSize: 18, color: '#6366F1', fontWeight: 700, marginBottom: 10 }}>Role:</div>
        <div style={{ fontSize: 18, marginBottom: 16 }}>{profile.role}</div>
        <div style={{ fontSize: 18, color: '#6366F1', fontWeight: 700, marginBottom: 10 }}>Skills:</div>
        <div style={{ fontSize: 18, marginBottom: 16 }}>{profile.skills.join(', ')}</div>
        <div style={{ fontSize: 18, color: '#6366F1', fontWeight: 700, marginBottom: 10 }}>Region:</div>
        <div style={{ fontSize: 18, marginBottom: 16 }}>{profile.region}</div>
        <div style={{ fontSize: 18, color: '#6366F1', fontWeight: 700, marginBottom: 10 }}>Status:</div>
        <div style={{ fontSize: 18, marginBottom: 16 }}>{profile.status}</div>
      </section>
    </div>
  );
}

export function WorkforceShell(props: WorkforceShellProps) {
  return (
    <AuthProvider>
      <WorkforceShellInner {...props} />
    </AuthProvider>
  );
}
