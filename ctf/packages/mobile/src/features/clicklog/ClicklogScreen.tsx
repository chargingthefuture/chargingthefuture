// design-sync: MobileClickLog.tsx + Empty/Loading/Public variants
// All counts derived from real /api/clicklog data; no fabricated values.
// "Today" and "This week" badge counts are computed client-side from incidents[].created_at.
// The bottom-nav "Export" tab has no backing API — button is rendered but no-ops (see comment).
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { fetchIncidents, logIncident, deleteIncident } from './api';

// ── Design tokens (from MobileClickLog.tsx) ──────────────────────────────────
const BRAND = '#EC4899';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const STATUS_BG = '#090B0F';

// ── Types ─────────────────────────────────────────────────────────────────────
export type IncidentMetadata = {
  latitude?: number;
  longitude?: number;
  notes?: string;
};

export type ClicklogIncident = {
  id: string;
  user_id: string | null;
  metadata: IncidentMetadata;
  created_at: string;
};

type TabKey = 'log' | 'history';
type ScreenState = 'loading' | 'public' | 'empty' | 'main';

// ── Helpers ───────────────────────────────────────────────────────────────────
function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart;
}

function formatIncidentTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Yesterday, ${timeStr}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

// ── Loading state ─────────────────────────────────────────────────────────────
function ClicklogLoading() {
  return (
    <View style={[styles.root, styles.centered]}>
      <Text style={styles.loadingTagline}>EXIT THEIR ECONOMY</Text>
      <Text style={styles.loadingTagline}>EXIT THE PSYOP</Text>
      <ActivityIndicator color={BRAND} style={styles.loadingSpinner} />
    </View>
  );
}

// ── Public (unauthenticated) state ────────────────────────────────────────────
function ClicklogPublic() {
  const features = [
    { label: 'One tap' },
    { label: 'Private' },
    { label: 'Location' },
  ] as const;

  return (
    <View style={styles.root}>
      <View style={[styles.headerPublic]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="warning-outline" size={18} color={BRAND} />
            <Text style={styles.headerTitle}>ClickLog</Text>
          </View>
          <View style={styles.authRow}>
            {/* Sign-in/Join: no auth navigation wired; placeholders per public mockup */}
            <TouchableOpacity style={styles.signInBtn}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.joinBtn}>
              <Text style={styles.joinBtnText}>Join Free</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.publicBody}>
        {/* Locked button overlay */}
        <View style={styles.lockedButtonWrap}>
          <View style={[styles.bigButton, styles.bigButtonLocked]}>
            <Ionicons name="warning-outline" size={34} color={BRAND} />
            <Text style={[styles.bigButtonLabel, { color: BRAND }]}>Log Incident</Text>
          </View>
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed-outline" size={18} color={BRAND} />
          </View>
        </View>

        <View style={styles.publicCopy}>
          <Text style={styles.publicHeading}>Track incidents privately</Text>
          <Text style={styles.publicSubtext}>
            Sign in to start logging personal safety incidents — one tap, private.
          </Text>
        </View>

        {/* CTA — no navigation wired; placeholder per public mockup */}
        <TouchableOpacity style={styles.ctaBtn}>
          <Ionicons name="person-add-outline" size={15} color="#fff" />
          <Text style={styles.ctaBtnText}>Create free account</Text>
        </TouchableOpacity>

        <View style={styles.featureCards}>
          {features.map(({ label }) => (
            <React.Fragment key={label}>
              <View style={styles.featureCard}>
                {/* Emojis from mockup are decorative; rendered as text */}
                <Text style={styles.featureCardEmoji}>
                  {label === 'One tap' ? '👆' : label === 'Private' ? '🔒' : '📍'}
                </Text>
                <Text style={styles.featureCardLabel}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Bottom nav — locked / non-interactive per public mockup */}
      <View style={styles.bottomNav}>
        {(['warning-outline', 'time-outline', 'document-text-outline'] as const).map((icon, i) => (
          <React.Fragment key={icon}>
            <View style={[styles.navItem, styles.navItemLocked]}>
              <Ionicons name={icon} size={20} color={SUBTLE} />
              <Text style={styles.navLabelLocked}>{['Log', 'History', 'Export'][i]}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function ClicklogEmpty({ onLog }: { onLog: () => void }) {
  const features = [
    { label: 'One tap' },
    { label: 'Private' },
    { label: 'Location' },
  ] as const;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}>
            <Ionicons name="warning-outline" size={16} color={BRAND} />
          </View>
          <View>
            <Text style={styles.headerTitle}>ClickLog</Text>
            <Text style={styles.headerSubtitle}>No incidents logged</Text>
          </View>
        </View>
      </View>

      <View style={styles.emptyBody}>
        <TouchableOpacity style={styles.bigButton} onPress={onLog}>
          <Ionicons name="warning-outline" size={34} color="#fff" />
          <Text style={styles.bigButtonLabel}>Log Incident</Text>
        </TouchableOpacity>

        <View style={styles.emptyCopy}>
          <Text style={styles.emptyHeading}>No incidents logged</Text>
          <Text style={styles.emptySubtext}>
            Tap the button above to log a personal safety incident. Optionally add a note or location.
          </Text>
        </View>

        <View style={styles.featureCards}>
          {features.map(({ label }) => (
            <React.Fragment key={label}>
              <View style={styles.featureCard}>
                <Text style={styles.featureCardEmoji}>
                  {label === 'One tap' ? '👆' : label === 'Private' ? '🔒' : '📍'}
                </Text>
                <Text style={styles.featureCardLabel}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={styles.bottomNav}>
        {[
          { icon: 'warning-outline' as const, label: 'Log', active: true },
          { icon: 'time-outline' as const, label: 'History', active: false },
          { icon: 'document-text-outline' as const, label: 'Export', active: false },
        ].map(({ icon, label, active }) => (
          <React.Fragment key={label}>
            <View style={styles.navItem}>
              <Ionicons name={icon} size={20} color={active ? BRAND : SUBTLE} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ── Main (populated) state ────────────────────────────────────────────────────
function ClicklogMain({
  incidents,
  totalCount,
  onLog,
  onDelete,
}: {
  incidents: ClicklogIncident[];
  totalCount: number;
  onLog: (_notes: string, _includeLocation: boolean) => Promise<void>;
  onDelete: (_id: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>('log');
  const [logged, setLogged] = useState(false);
  const [notes, setNotes] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const todayCount = incidents.filter((i) => isToday(i.created_at)).length;
  const weekCount = incidents.filter((i) => isThisWeek(i.created_at)).length;

  const handleQuickLog = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onLog('', false);
      setLogged(true);
      setTimeout(() => setLogged(false), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWithNote = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onLog(notes.trim(), includeLocation);
      setNotes('');
      setIncludeLocation(false);
      setLogged(true);
      setTimeout(() => setLogged(false), 2000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBadge}>
              <Ionicons name="warning-outline" size={16} color={BRAND} />
            </View>
            <View>
              <Text style={styles.headerTitle}>ClickLog</Text>
              <Text style={styles.headerSubtitle}>{totalCount} incidents total</Text>
            </View>
          </View>
          <Ionicons name="notifications-outline" size={18} color={SUBTLE} />
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(['log', 'history'] as TabKey[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === 'log' ? 'Log Incident' : 'History'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'log' && (
          <View style={styles.logTab}>
            {/* Count badges — computed from real incidents data */}
            <View style={styles.countBadges}>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeValue}>{todayCount}</Text>
                <Text style={styles.countBadgeLabel}>Today</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeValue}>{weekCount}</Text>
                <Text style={styles.countBadgeLabel}>This week</Text>
              </View>
            </View>

            {/* Big log button */}
            <TouchableOpacity
              style={[styles.bigButton, logged && styles.bigButtonLogged]}
              onPress={handleQuickLog}
              disabled={submitting}
              accessibilityLabel="Log incident"
              accessibilityRole="button"
            >
              {submitting && !logged ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="warning-outline" size={32} color="#fff" />
                  <Text style={styles.bigButtonLabel}>{logged ? 'Logged ✓' : 'Log Incident'}</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.tapHint}>Tap to log instantly</Text>

            {/* Quick note area */}
            <View style={styles.noteCard}>
              <Text style={styles.noteCardLabel}>Add a note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Describe what happened…"
                placeholderTextColor={SUBTLE}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                maxLength={200}
                accessibilityLabel="Add a note"
              />
              <View style={styles.noteActions}>
                <TouchableOpacity
                  style={[styles.locationBtn, includeLocation && styles.locationBtnActive]}
                  onPress={() => setIncludeLocation((v) => !v)}
                  accessibilityLabel="Toggle location"
                >
                  <Ionicons name="location-outline" size={11} color={includeLocation ? BRAND : SUBTLE} />
                  <Text style={[styles.locationBtnText, includeLocation && styles.locationBtnTextActive]}>
                    Location
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitNoteBtn}
                  onPress={handleSubmitWithNote}
                  disabled={submitting}
                  accessibilityLabel="Submit with note"
                >
                  <Text style={styles.submitNoteBtnText}>Submit with note</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {tab === 'history' && (
          <View style={styles.historyTab}>
            {incidents.length === 0 ? (
              <Text style={styles.emptyHistory}>No incidents yet.</Text>
            ) : (
              incidents.map((incident) => (
                <React.Fragment key={incident.id}>
                  <View style={styles.incidentRow}>
                    <View style={styles.incidentIconWrap}>
                      <Ionicons name="warning-outline" size={13} color={BRAND} />
                    </View>
                    <View style={styles.incidentBody}>
                      <Text style={styles.incidentTime}>{formatIncidentTime(incident.created_at)}</Text>
                      {!!incident.metadata?.notes && (
                        <Text style={styles.incidentNotes}>{incident.metadata.notes}</Text>
                      )}
                      {!!(incident.metadata?.latitude && incident.metadata?.longitude) && (
                        <View style={styles.incidentLocation}>
                          <Ionicons name="location-outline" size={9} color={SUBTLE} />
                          <Text style={styles.incidentLocationText}>Location</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => onDelete(incident.id)}
                      style={styles.deleteBtn}
                      accessibilityLabel="Delete incident"
                      accessibilityRole="button"
                    >
                      <Ionicons name="trash-outline" size={13} color={SUBTLE} />
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {([
          { icon: 'warning-outline' as const, label: 'Log', tabKey: 'log' as TabKey },
          { icon: 'time-outline' as const, label: 'History', tabKey: 'history' as TabKey },
          // Export: no backing API — button rendered per mockup but no-ops
          { icon: 'document-text-outline' as const, label: 'Export', tabKey: null },
        ] as const).map(({ icon, label, tabKey }) => (
          <TouchableOpacity
            key={label}
            style={styles.navItem}
            onPress={() => tabKey !== null && setTab(tabKey)}
            disabled={tabKey === null}
            accessibilityLabel={label}
          >
            <Ionicons name={icon} size={20} color={tab === tabKey ? BRAND : SUBTLE} />
            <Text style={[styles.navLabel, tab === tabKey && styles.navLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Root screen ───────────────────────────────────────────────────────────────
export function ClicklogScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [incidents, setIncidents] = useState<ClicklogIncident[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    // On a background refresh (after a mutation) keep the current screen rather than
    // flashing the full loading state; only the initial load shows 'loading'.
    if (!isRefresh) setScreenState('loading');
    try {
      const data = await fetchIncidents();
      const list: ClicklogIncident[] = data.incidents ?? [];
      setIncidents(list);
      setTotalCount(typeof data.count === 'number' ? data.count : list.length);
      setScreenState(list.length === 0 ? 'empty' : 'main');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 401 → treat as unauthenticated
      if (msg.includes('401') || msg.toLowerCase().includes('not authenticated')) {
        setScreenState('public');
      } else {
        // Network / server error — show empty so user can still attempt to log
        setScreenState('empty');
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLog = useCallback(async (notes: string, includeLocation: boolean) => {
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (includeLocation) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      } catch {
        // Location unavailable — proceed without it
      }
    }
    await logIncident({ latitude, longitude, notes: notes || undefined });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await load(true);
  }, [load]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Incident', 'Are you sure you want to delete this incident?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteIncident(id);
            await load(true);
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed');
          }
        },
      },
    ]);
  }, [load]);

  // Quick log from empty state → optimistically transition to main
  const handleEmptyLog = useCallback(async () => {
    try {
      await handleLog('', false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to log incident');
    }
  }, [handleLog]);

  if (screenState === 'loading') return <ClicklogLoading />;
  if (screenState === 'public') return <ClicklogPublic />;
  if (screenState === 'empty') return <ClicklogEmpty onLog={handleEmptyLog} />;
  return (
    <ClicklogMain
      incidents={incidents}
      totalCount={totalCount}
      onLog={handleLog}
      onDelete={handleDelete}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading
  loadingTagline: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  loadingSpinner: {
    marginTop: 24,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  headerPublic: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${BRAND}25`,
    backgroundColor: `${BRAND}10`,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: `${BRAND}20`,
    borderWidth: 1,
    borderColor: `${BRAND}35`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  headerSubtitle: {
    fontSize: 11,
    color: SUBTLE,
  },

  // Public header extras
  authRow: {
    flexDirection: 'row',
    gap: 6,
  },
  signInBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  signInBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT,
  },
  joinBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: BRAND,
  },
  joinBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: `${BRAND}18`,
    borderColor: `${BRAND}40`,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '400',
    color: SUBTLE,
    textTransform: 'capitalize',
  },
  tabBtnTextActive: {
    fontWeight: '700',
    color: BRAND,
  },

  // Scroll
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 90,
  },

  // Log tab
  logTab: {
    alignItems: 'center',
    gap: 20,
  },
  countBadges: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  countBadge: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: `${BRAND}15`,
    alignItems: 'center',
  },
  countBadgeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND,
  },
  countBadgeLabel: {
    fontSize: 11,
    color: SUBTLE,
    marginTop: 2,
  },

  // Big button
  bigButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: BRAND,
    borderWidth: 3,
    borderColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: BRAND,
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 8,
  },
  bigButtonLogged: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
    shadowColor: '#22C55E',
  },
  bigButtonLocked: {
    backgroundColor: 'rgba(233,30,140,0.1)',
    borderColor: 'rgba(233,30,140,0.25)',
    opacity: 0.5,
  },
  bigButtonLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  tapHint: {
    fontSize: 12,
    color: SUBTLE,
    textAlign: 'center',
  },

  // Note card
  noteCard: {
    width: '100%',
    padding: 14,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  noteCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SUBTLE,
    marginBottom: 8,
  },
  noteInput: {
    width: '100%',
    padding: 8,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    fontSize: 13,
    color: TEXT,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  noteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  locationBtnActive: {
    backgroundColor: `${BRAND}15`,
    borderColor: `${BRAND}30`,
  },
  locationBtnText: {
    fontSize: 11,
    color: SUBTLE,
  },
  locationBtnTextActive: {
    color: BRAND,
  },
  submitNoteBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: `${BRAND}15`,
    borderWidth: 1,
    borderColor: `${BRAND}30`,
    alignItems: 'center',
  },
  submitNoteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND,
  },

  // History tab
  historyTab: {
    gap: 8,
  },
  emptyHistory: {
    textAlign: 'center',
    marginTop: 32,
    color: SUBTLE,
    fontSize: 14,
  },
  incidentRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 13,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'flex-start',
  },
  incidentIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: `${BRAND}12`,
    borderWidth: 1,
    borderColor: `${BRAND}20`,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  incidentBody: {
    flex: 1,
  },
  incidentTime: {
    fontSize: 11,
    color: SUBTLE,
    marginBottom: 2,
  },
  incidentNotes: {
    fontSize: 13,
    color: TEXT,
    lineHeight: 18,
  },
  incidentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  incidentLocationText: {
    fontSize: 10,
    color: SUBTLE,
  },
  deleteBtn: {
    flexShrink: 0,
    padding: 4,
  },

  // Empty state
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 22,
  },
  emptyCopy: {
    alignItems: 'center',
  },
  emptyHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: SUBTLE,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 290,
  },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(233,30,140,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(233,30,140,0.15)',
    width: '100%',
  },
  safetyIcon: {
    flexShrink: 0,
  },
  safetyText: {
    fontSize: 11,
    color: SUBTLE,
    flex: 1,
    lineHeight: 15,
  },

  // Public state body
  publicBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 22,
  },
  lockedButtonWrap: {
    position: 'relative',
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockOverlay: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(233,30,140,0.12)',
    borderWidth: 2,
    borderColor: `${BRAND}50`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicCopy: {
    alignItems: 'center',
  },
  publicHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 8,
    textAlign: 'center',
  },
  publicSubtext: {
    fontSize: 13,
    color: SUBTLE,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 290,
  },
  ctaBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // Feature cards (shared empty + public)
  featureCards: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  featureCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  featureCardEmoji: {
    fontSize: 20,
    marginBottom: 5,
  },
  featureCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SUBTLE,
  },

  // Bottom nav
  bottomNav: {
    height: 72,
    backgroundColor: STATUS_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navItemLocked: {
    opacity: 0.3,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '400',
    color: SUBTLE,
  },
  navLabelActive: {
    fontWeight: '600',
    color: BRAND,
  },
  navLabelLocked: {
    fontSize: 10,
    color: SUBTLE,
  },
});
