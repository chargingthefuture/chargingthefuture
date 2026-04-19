
'use client';


"use client";

import { useEffect, useState } from 'react';
import { StreamChatPanel } from '../shared/stream-chat-panel';

type LighthouseShellProps = {
  userId: string;
  isAdmin: boolean;
  role: string | null;
};

type Profile = {
  id: string;
  profileType: string;
  bio?: string;
  phoneNumber?: string;
  signalUrl?: string;
  isActive?: boolean;
  hasProperty?: boolean;
  housingNeeds?: string;
  desiredMoveInDateIso?: string;
  budgetMin?: number;
  budgetMax?: number;
  desiredCountry?: string;
  updatedAtIso?: string;
};
interface Property {
  id: string;
  img?: string;
  title: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  credits?: boolean;
  availableFromIso?: string;
  description?: string;
}

interface Match {
  id: string;
  status: string;
  propertyId: string;
  seekerUserId: string;
  hostUserId: string;
  proposedMoveInDateIso?: string;
  message?: string;
}

interface Announcement {
  id: string;
  from: string;
  text: string;
  title?: string;
  action?: string;
}

const COLOR = '#EAB308';

export function LighthouseShell({ userId, isAdmin, role }: LighthouseShellProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'browse' | 'matches' | 'chat'>('browse');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [chatCredentials, setChatCredentials] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        // Profile
        const profileRes = await fetch('/api/lighthouse/profile');
        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data.profile ?? null);
        } else if (profileRes.status === 404) {
          setProfile(null);
        } else {
          throw new Error('Failed to load profile');
        }

        // Properties
        const propRes = await fetch('/api/lighthouse/my-properties');
        if (propRes.ok) {
          const data = await propRes.json();
          setProperties(data.items ?? []);
        } else {
          setProperties([]);
        }

        // Matches
        const matchRes = await fetch('/api/lighthouse/matches');
        if (matchRes.ok) {
          const data = await matchRes.json();
          setMatches(data.items ?? []);
        } else {
          setMatches([]);
        }

        // Announcements
        const annRes = await fetch('/api/lighthouse/announcements');
        if (annRes.ok) {
          const data = await annRes.json();
          setAnnouncements(data.items ?? []);
        } else {
          setAnnouncements([]);
        }
      } catch (e) {
        setError('Failed to load LightHouse data.');
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [userId]);


  useEffect(() => {
    if (tab === 'chat' && selectedMatch) {
      setChatLoading(true);
      setChatError(null);
      fetch(`/api/lighthouse/matches/${selectedMatch.id}/chat`, { method: 'POST' })
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch chat credentials');
          const data = await res.json();
          if (!data.ok) throw new Error(data.message || 'No chat credentials');
          setChatCredentials(data);
        })
        .catch((e) => setChatError(e instanceof Error ? e.message : String(e)))
        .finally(() => setChatLoading(false));
    } else {
      setChatCredentials(null);
    }
  }, [tab, selectedMatch]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading LightHouse...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  // Empty state for profile
  if (!profile) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Welcome to LightHouse</h2>
        <p className="mb-4">No profile found. Get started by creating your LightHouse profile.</p>
        {/* TODO: Add Create Profile button/flow */}
      </div>
    );
  }

  // Main layout: sidebar, tab nav, and content
  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#0F1117', fontFamily: 'Inter, system-ui, sans-serif', color: '#E8EAF0', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 72, background: '#090B0F', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 20, color: COLOR }}>🏠</span>
        </div>
        {tab === 'chat' && (
          <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ marginBottom: 20, padding: '18px 24px', borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>LightHouse Chat</div>
              <div style={{ fontSize: 14, color: '#9CA3AF' }}>Connect with your match in real time.</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="match-select" style={{ color: '#9CA3AF', fontSize: 14, marginRight: 8 }}>Select Match:</label>
              <select
                id="match-select"
                value={selectedMatch?.id || ''}
                onChange={e => {
                  const match = matches.find(m => m.id === e.target.value) || null;
                  setSelectedMatch(match);
                }}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${COLOR}25`, background: '#181A20', color: '#E8EAF0', fontSize: 15 }}
              >
                <option value="">-- Select a match --</option>
                {matches.map(m => (
                  <option key={m.id} value={m.id}>Match {m.id} ({m.status})</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: `1px solid ${COLOR}10`, padding: 16, minHeight: 200 }}>
              {!selectedMatch && <div style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 40 }}>Select a match to start chatting.</div>}
              {selectedMatch && chatLoading && <div>Loading chat…</div>}
              {selectedMatch && chatError && <div style={{ color: 'red' }}>{chatError}</div>}
              {selectedMatch && chatCredentials && (
                <StreamChatPanel
                  streamApiKey={chatCredentials.streamApiKey}
                  streamToken={chatCredentials.streamToken}
                  streamUserId={chatCredentials.streamUserId}
                  streamChannelId={chatCredentials.streamChannelId || selectedMatch.id}
                />
              )}
            </div>
          </div>
        )}
        {[
          { icon: '🔍', key: 'browse' },
          { icon: '❤️', key: 'matches' },
          { icon: '💬', key: 'chat' },
        ].map(({ icon, key }) => (
          <button key={key} onClick={() => setTab(key as 'browse' | 'matches' | 'chat')} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : 'transparent', border: tab === key ? `1px solid ${COLOR}40` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: tab === key ? COLOR : '#6B7280' }}>{icon}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', fontSize: 18 }}>🔔</button>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', fontSize: 18 }}>⚙️</button>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>S</div>
      </aside>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
          <span style={{ fontSize: 18, color: COLOR }}>🏠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>🏠 LightHouse — Safe Housing</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Verified listings · Privacy-first · Phase 2</div>
          </div>
          <span style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>✓ Privacy Protected</span>
          <span style={{ background: 'rgba(14,165,233,0.12)', color: '#38BDF8', border: '1px solid rgba(14,165,233,0.2)', fontSize: 11, padding: '3px 10px', borderRadius: 20, marginLeft: 8 }}>GetStream ⚡</span>
        </header>

        {/* Tab content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {tab === 'browse' && (
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 20, padding: '18px 24px', borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>Find Safe, Verified Housing</div>
                <div style={{ fontSize: 14, color: '#9CA3AF' }}>{properties.length} listings · {properties.filter((p: Property) => p.credits).length} accept Service Credits · Privacy by design</div>
              </div>
              {/* Listings grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {properties.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9CA3AF', fontSize: 16, padding: 40 }}>No properties available.</div>
                ) : (
                  properties.map((p: Property) => (
                    <div key={p.id} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${COLOR}20`, overflow: 'hidden', cursor: 'pointer' }}>
                      <div style={{ padding: '32px 0', background: `${COLOR}08`, textAlign: 'center', fontSize: 48 }}>{p.img || '🏠'}</div>
                      <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB', flex: 1, marginRight: 8, lineHeight: 1.3 }}>{p.title || p.id}</div>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }} title="Save"><span style={{ color: '#4B5563', fontSize: 16 }}>♡</span></button>
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{p.city}, {p.state}</div>
                        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
                          <span>{p.bedrooms === 0 ? 'Studio' : `${p.bedrooms}bd`}</span>
                          <span>{p.bathrooms}ba</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: COLOR }}>${p.monthlyRent || '—'}<span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>/mo</span></div>
                            {p.credits && <div style={{ fontSize: 10, color: '#F59E0B' }}>Credits ✓</div>}
                          </div>
                          <button onClick={() => setSelectedProperty(p)} style={{ padding: '8px 16px', borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {tab === 'matches' && (
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 20, padding: '18px 24px', borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>Your Matches</div>
                <div style={{ fontSize: 14, color: '#9CA3AF' }}>{matches.length} match{matches.length === 1 ? '' : 'es'} found</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {matches.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9CA3AF', fontSize: 16, padding: 40 }}>No matches yet.</div>
                ) : (
                  matches.map((m: Match) => {
                    const prop = properties.find((p: Property) => p.id === m.propertyId);
                    return (
                      <div key={m.id} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: `1px solid ${COLOR}20`, overflow: 'hidden', cursor: 'pointer' }}>
                        <div style={{ padding: '24px 0', background: `${COLOR}08`, textAlign: 'center', fontSize: 32 }}>{m.status === 'approved' ? '✅' : m.status === 'pending' ? '⏳' : '❌'}</div>
                        <div style={{ padding: 16 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB', marginBottom: 6 }}>Match: {m.status.charAt(0).toUpperCase() + m.status.slice(1)}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Property: {m.propertyId}</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Seeker: {m.seekerUserId}</div>
                          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Host: {m.hostUserId}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Requested: {m.proposedMoveInDateIso ? new Date(m.proposedMoveInDateIso).toLocaleDateString() : '—'}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Message: {m.message || '—'}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button
                              onClick={() => {
                                if (prop) {
                                  setSelectedProperty(prop);
                                } else {
                                  window.alert('Property details not found for this match.');
                                }
                              }}
                              style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: prop ? 'pointer' : 'not-allowed', opacity: prop ? 1 : 0.6 }}
                              disabled={!prop}
                            >
                              View
                            </button>
                            <button style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Message</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Property Detail Modal/Overlay */}
      {selectedProperty && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#181A20', borderRadius: 18, boxShadow: '0 8px 32px #0008', width: 540, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: 32, position: 'relative' }}>
            <button onClick={() => setSelectedProperty(null)} style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', color: COLOR, fontSize: 22, cursor: 'pointer', fontWeight: 700 }} aria-label="Close">×</button>
            {selectedProperty ? (
              <>
                <div style={{ fontSize: 38, textAlign: 'center', marginBottom: 18 }}>{selectedProperty.img || '🏠'}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB', marginBottom: 8 }}>{selectedProperty.title || selectedProperty.id}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, borderRadius: 8, padding: '2px 10px' }}>{selectedProperty.city}, {selectedProperty.state}</span>
                  {selectedProperty.credits && <span style={{ background: '#F59E0B15', color: '#F59E0B', border: '1px solid #F59E0B30', fontSize: 12, borderRadius: 8, padding: '2px 10px' }}>Credits ✓</span>}
                </div>
                <div style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 16 }}>{selectedProperty.description || 'No description.'}</div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 14, color: '#9CA3AF' }}>
                  <span>{selectedProperty.bedrooms === 0 ? 'Studio' : `${selectedProperty.bedrooms} bed`}</span>
                  <span>{selectedProperty.bathrooms} bath</span>
                  <span>Available {selectedProperty.availableFromIso ? new Date(selectedProperty.availableFromIso).toLocaleDateString() : '—'}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLOR, marginBottom: 8 }}>${selectedProperty.monthlyRent || '—'}<span style={{ fontSize: 13, color: '#6B7280', fontWeight: 400 }}>/mo</span></div>
                <button style={{ width: '100%', padding: '12px', borderRadius: 10, background: COLOR, border: 'none', color: '#0F1117', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>Apply Now</button>
                <button style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${COLOR}35`, color: COLOR, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>Message Host</button>
                <div style={{ marginTop: 12, fontSize: 12, color: '#4B5563', textAlign: 'center', lineHeight: 1.6 }}>Secure booking · No deposit until confirmed</div>
              </>
            ) : (
              <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>No property details available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
