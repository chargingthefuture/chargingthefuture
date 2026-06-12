// Directory admin screen — aligned to MobileDirectoryAdmin.tsx mockup.
// Real data only: binds to the admin routes under
// ctf/packages/web/app/api/directory/admin/profiles. Every route is gated by
// requireDirectoryAdminAccess on the server, so a non-admin token gets a 4xx and
// the screen surfaces "Admin access required".
//
// Owner decision 2026-06-06: Directory has BOTH an inline "Attach to account"
// control on the profile detail AND this dedicated admin screen; both coexist.
//
// Mockup controls intentionally omitted (no backing field/endpoint):
//   - "Mark as verified" toggle — directory_profiles has no `verified` column.
//   - "Assign Handle" input — `unclaimedHandle` is system-assigned and is not
//     part of the admin update contract; shown read-only instead.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePluginAuth } from './usePluginAuth';
import type { DirectoryListItem } from './api';
import {
  assignAdminDirectoryProfile,
  deleteAdminDirectoryProfile,
  fetchAdminDirectoryProfiles,
  updateAdminDirectoryProfile,
} from './api';

const COLOR = '#3B82F6';
const COMMUNITY = '#A855F7';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

type TabKey = 'unclaimed' | 'all';

type EditForm = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  profileUrl: string;
};

function fullName(p: { firstName: string; lastName: string | null }): string {
  return [p.firstName, p.lastName].filter((s) => s && s.trim().length > 0).join(' ').trim();
}

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

function sourceLabel(p: DirectoryListItem): { label: string; color: string } {
  if (p.source === 'community-generated') return { label: 'Community', color: COMMUNITY };
  if (p.source === 'admin') return { label: 'Admin-claimed', color: COLOR };
  return { label: 'Self', color: '#22C55E' };
}

function toForm(p: DirectoryListItem): EditForm {
  return {
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    headline: p.headline ?? '',
    bio: p.bio ?? '',
    profileUrl: p.profileUrl ?? '',
  };
}

const EDIT_FIELDS: { label: string; key: keyof EditForm; placeholder: string }[] = [
  { label: 'First name', key: 'firstName', placeholder: 'First name' },
  { label: 'Last name', key: 'lastName', placeholder: 'Last name' },
  { label: 'Headline', key: 'headline', placeholder: 'Role or specialty' },
  { label: 'Bio', key: 'bio', placeholder: 'Short description' },
  { label: 'Profile URL', key: 'profileUrl', placeholder: 'https://…' },
];

export const AdminDirectory = () => {
  // Used only as a signed-in gate before loading; the API client attaches the
  // live Clerk bearer token itself (see ../../auth/authedFetch).
  const { auth, loading: authLoading } = usePluginAuth('clerk');

  const [profiles, setProfiles] = useState<DirectoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('unclaimed');
  const [editing, setEditing] = useState<DirectoryListItem | null>(null);
  const [form, setForm] = useState<EditForm>({ firstName: '', lastName: '', headline: '', bio: '', profileUrl: '' });
  const [assignInput, setAssignInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth?.isAuthenticated || !auth.userId) {
      setError('Admin access required, or profiles could not be loaded.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDirectoryProfiles({ pageSize: 100, includeInactive: true });
      setProfiles(data.items);
    } catch {
      setError('Admin access required, or profiles could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  const unclaimed = profiles.filter((p) => p.claimedByUserId == null);
  const visible = tab === 'unclaimed' ? unclaimed : profiles;

  const startEdit = (p: DirectoryListItem) => {
    setEditing(p);
    setForm(toForm(p));
    setAssignInput('');
    setDrawerError(null);
    setDrawerNotice(null);
  };

  const closeDrawer = () => {
    setEditing(null);
    setDrawerError(null);
    setDrawerNotice(null);
    setAssignInput('');
  };

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setDrawerError(null);
    setDrawerNotice(null);
    try {
      const updated = await updateAdminDirectoryProfile(editing.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || null,
        headline: form.headline.trim() || null,
        bio: form.bio.trim() || null,
        profileUrl: form.profileUrl.trim() || null,
        // Preserve existing taxonomy so editing the text fields does not wipe it.
        sectorId: editing.sectorId,
        jobTitleId: editing.jobTitleId,
        skillIds: editing.skills.map((s) => s.id),
      });
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      closeDrawer();
    } catch {
      setDrawerError('Could not save this profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!editing) return;
    const target = assignInput.trim();
    if (target.length === 0) return;
    setSaving(true);
    setDrawerError(null);
    setDrawerNotice(null);
    try {
      const updated = await assignAdminDirectoryProfile(editing.id, target);
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditing(updated);
      setDrawerNotice('Profile attached to that account.');
      setAssignInput('');
    } catch {
      setDrawerError('Could not attach this profile.');
    } finally {
      setSaving(false);
    }
  }

  async function performDelete(p: DirectoryListItem) {
    setSaving(true);
    try {
      await deleteAdminDirectoryProfile(p.id);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
      if (editing?.id === p.id) closeDrawer();
    } catch {
      if (editing?.id === p.id) setDrawerError('Could not delete this profile.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(p: DirectoryListItem) {
    if (p.claimedByUserId != null) return;
    const name = fullName(p) || 'this profile';
    Alert.alert(
      'Delete profile',
      `Delete ${name}? This permanently removes the unclaimed profile and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void performDelete(p) },
      ],
    );
  }

  // ── Edit screen ─────────────────────────────────────────────────────────
  if (editing) {
    const p = editing;
    const isUnclaimed = p.claimedByUserId == null;
    return (
      <View style={styles.root}>
        <View style={styles.editHeader}>
          <View style={styles.editHeaderIcon}>
            <Text style={styles.editHeaderIconText}>✏️</Text>
          </View>
          <View style={styles.editHeaderTitleWrap}>
            <Text style={styles.editHeaderTitle}>Edit Profile</Text>
            <Text style={styles.editHeaderSub}>
              {isUnclaimed ? 'Unclaimed' : 'Claimed'} · {sourceLabel(p).label}
            </Text>
          </View>
          <TouchableOpacity onPress={closeDrawer} style={styles.editHeaderClose}>
            <Text style={styles.editHeaderCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.editScroll} contentContainerStyle={styles.editContent}>
          {p.source === 'community-generated' ? (
            <View style={styles.communityNotice}>
              <Text style={styles.communityNoticeText}>
                Community-generated · {p.unclaimedHandle ? `@${p.unclaimedHandle}` : 'no handle'}
              </Text>
            </View>
          ) : null}

          {EDIT_FIELDS.map((f) => (
            // key on the Fragment, not the View: @types/react 19.2 (CI) rejects `key`
            // directly on class-based host components like View.
            <React.Fragment key={f.key}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form[f.key]}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, [f.key]: text }))}
                  placeholder={f.placeholder}
                  placeholderTextColor="#4B5563"
                  editable={!saving}
                />
              </View>
            </React.Fragment>
          ))}

          {p.skills.length > 0 ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Skills</Text>
              <View style={styles.skillsRow}>
                {p.skills.map((s) => (
                  <React.Fragment key={s.id}>
                    <View style={styles.skillChip}>
                      <Text style={styles.skillChipText}>{s.name}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          ) : null}

          {isUnclaimed ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Attach to account</Text>
              <Text style={styles.attachHint}>
                This profile is unclaimed. Attach it to a user account by their Clerk user ID.
              </Text>
              <TextInput
                style={styles.fieldInput}
                value={assignInput}
                onChangeText={(text) => { setAssignInput(text); setDrawerError(null); }}
                placeholder="Clerk user ID"
                placeholderTextColor="#4B5563"
                autoCapitalize="none"
                editable={!saving}
              />
              <TouchableOpacity
                style={[styles.attachBtn, (saving || assignInput.trim().length === 0) && styles.btnDisabled]}
                onPress={() => void handleAssign()}
                disabled={saving || assignInput.trim().length === 0}
              >
                <Text style={styles.attachBtnText}>Attach</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {drawerNotice ? <Text style={styles.noticeText}>{drawerNotice}</Text> : null}
          {drawerError ? <Text style={styles.errorText}>{drawerError}</Text> : null}
        </ScrollView>

        <View style={styles.editFooter}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.discardBtn} onPress={closeDrawer}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Profile list screen ───────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>🛡️</Text>
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Directory Admin</Text>
            <Text style={styles.headerSub}>
              {profiles.length} profiles · {unclaimed.length} unclaimed
            </Text>
          </View>
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'unclaimed' && styles.tabActive]}
            onPress={() => setTab('unclaimed')}
          >
            <Text style={[styles.tabText, tab === 'unclaimed' && styles.tabTextActive]}>Unclaimed</Text>
            {unclaimed.length > 0 ? (
              <View style={styles.tabCount}>
                <Text style={styles.tabCountText}>{unclaimed.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'all' && styles.tabActive]}
            onPress={() => setTab('all')}
          >
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>All Profiles</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>Loading profiles…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>No profiles in this view.</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const b = sourceLabel(item);
            const handle = item.unclaimedHandle ? `@${item.unclaimedHandle}` : item.claimedByUserId ? 'Claimed' : '—';
            return (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardAvatar}>
                    <Text style={styles.cardAvatarText}>{initials(fullName(item))}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{fullName(item) || 'Unnamed'}</Text>
                    {item.headline || item.jobTitleName ? (
                      <Text style={styles.cardRole} numberOfLines={1}>{item.headline ?? item.jobTitleName}</Text>
                    ) : null}
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: `${b.color}18`, borderColor: `${b.color}25` }]}>
                        <Text style={[styles.badgeText, { color: b.color }]}>{b.label}</Text>
                      </View>
                      <Text style={[styles.statusText, { color: item.claimedByUserId ? '#22C55E' : SUBTLE }]}>
                        {item.claimedByUserId ? 'Claimed' : 'Unclaimed'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.cardHandle, { color: item.unclaimedHandle ? COMMUNITY : SUBTLE }]}>{handle}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editProfileBtn} onPress={() => startEdit(item)}>
                    <Text style={styles.editProfileBtnText}>Edit profile</Text>
                  </TouchableOpacity>
                  {item.claimedByUserId == null ? (
                    <TouchableOpacity
                      style={[styles.deleteBtn, saving && styles.btnDisabled]}
                      onPress={() => void handleDelete(item)}
                      disabled={saving}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#0D0F14',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}35`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerIconText: { fontSize: 16 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  headerSub: { fontSize: 11, color: SUBTLE },

  tabRow: { flexDirection: 'row', gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  tabActive: { backgroundColor: `${COLOR}18`, borderColor: `${COLOR}40` },
  tabText: { fontSize: 12, color: SUBTLE },
  tabTextActive: { color: COLOR, fontWeight: '700' },
  tabCount: {
    backgroundColor: `${COMMUNITY}20`,
    borderWidth: 1,
    borderColor: `${COMMUNITY}30`,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  tabCountText: { fontSize: 10, fontWeight: '700', color: COMMUNITY },

  list: { flex: 1 },
  listContent: { padding: 16, gap: 8 },

  card: {
    padding: 13,
    borderRadius: 13,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardAvatarText: { fontSize: 13, fontWeight: '700', color: COLOR },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 2 },
  cardRole: { fontSize: 11, color: SUBTLE, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  statusText: { fontSize: 10 },
  cardHandle: { fontSize: 11, fontFamily: 'monospace', marginBottom: 10 },
  cardActions: { flexDirection: 'row', gap: 7 },
  editProfileBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: `${COLOR}12`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileBtnText: { fontSize: 12, fontWeight: '600', color: COLOR },
  deleteBtn: {
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centeredText: { fontSize: 13, color: SUBTLE, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    backgroundColor: COLOR,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Edit screen
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#0D0F14',
  },
  editHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: `${COLOR}20`,
    borderWidth: 1,
    borderColor: `${COLOR}35`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  editHeaderIconText: { fontSize: 15 },
  editHeaderTitleWrap: { flex: 1 },
  editHeaderTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  editHeaderSub: { fontSize: 11, color: SUBTLE },
  editHeaderClose: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHeaderCloseText: { fontSize: 14, color: SUBTLE },

  editScroll: { flex: 1 },
  editContent: { padding: 16 },
  communityNotice: {
    padding: 10,
    borderRadius: 9,
    backgroundColor: `${COMMUNITY}10`,
    borderWidth: 1,
    borderColor: `${COMMUNITY}25`,
    marginBottom: 16,
  },
  communityNoticeText: { fontSize: 12, color: COMMUNITY, lineHeight: 18 },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  fieldInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 9,
    fontSize: 13,
    color: TEXT,
  },
  attachHint: { fontSize: 12, color: SUBTLE, lineHeight: 18, marginBottom: 8 },
  attachBtn: {
    marginTop: 8,
    backgroundColor: COLOR,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
  },
  attachBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillChip: {
    backgroundColor: `${COLOR}12`,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: `${COLOR}25`,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  skillChipText: { fontSize: 12, color: COLOR },

  noticeText: { fontSize: 12, color: COLOR, marginTop: 4 },
  errorText: { fontSize: 12, color: '#EF4444', textAlign: 'center' },

  editFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: COLOR,
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  discardBtn: {
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBtnText: { color: SUBTLE, fontSize: 14 },

  btnDisabled: { opacity: 0.5 },
});
