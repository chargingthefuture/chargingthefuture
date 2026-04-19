import React, { useState } from 'react';
import { TrustTransportStreamTab } from './TrustTransportStreamTab';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from './auth-context';

const COLOR = '#F97316';
const DRIVERS = [
  { id: 1, name: 'Jose Martinez', rating: 4.9, trips: 847, eta: '3 min', avatar: 'JM', vehicle: 'Toyota Camry', credits: true },
  { id: 2, name: 'Aisha Thompson', rating: 5.0, trips: 612, eta: '6 min', avatar: 'AT', vehicle: 'Honda Civic', credits: true },
  { id: 3, name: 'David Kim', rating: 4.8, trips: 1203, eta: '9 min', avatar: 'DK', vehicle: 'Ford Explorer', credits: false },
];

export const TrustTransport = () => {
  const [tab, setTab] = useState('ride');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [booked, setBooked] = useState(false);
  const { user, isAuthenticated, signIn, signOut, isLoading } = useAuth();

  if (isLoading) {
    return <View style={styles.root}><Text style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>Loading...</Text></View>;
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>TrustTransport</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, marginBottom: 16 }}>Sign in to use TrustTransport</Text>
          <TouchableOpacity style={styles.bookBtn} onPress={signIn}>
            <Text style={styles.bookBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TrustTransport</Text>
        <Text style={styles.headerLive}>● Live</Text>
      </View>
      <View style={styles.nav}>
        {['ride', 'package', 'track', 'chat'].map((key) => (
          <TouchableOpacity style={[styles.navBtn, tab === key && styles.navBtnActive]} onPress={() => setTab(key)}>
            <Text style={[styles.navBtnText, tab === key && styles.navBtnTextActive]}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={styles.scroll}>
        {tab === 'ride' && (
          <View>
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Book a Safe Ride</Text>
              <Text style={styles.sectionDesc}>Background-checked drivers · Trauma-informed · Credits OK</Text>
            </View>
            <View style={styles.inputBox}>
              <TextInput value={from} onChangeText={setFrom} placeholder="Pickup location (private)" placeholderTextColor="#6B7280" style={styles.input} />
              <TextInput value={to} onChangeText={setTo} placeholder="Where to?" placeholderTextColor="#6B7280" style={styles.input} />
            </View>
            {(from || to) ? (
              <View>
                <Text style={styles.nearbyTitle}>Nearby Drivers</Text>
                {DRIVERS.map((d) => (
                  <View style={styles.driverCard}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{d.avatar}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>{d.name}</Text>
                      <Text style={styles.driverMeta}>{d.vehicle} · ⭐ {d.rating}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.eta}>ETA {d.eta}</Text>
                      <TouchableOpacity style={styles.bookBtn} onPress={() => setBooked(true)}><Text style={styles.bookBtnText}>Book</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}><Text style={styles.emptyIcon}>📦</Text><Text style={styles.emptyText}>Enter pickup and destination to see drivers</Text></View>
            )}
            {booked && (
              <View style={styles.bookedBox}>
                <Text style={styles.bookedText}>Booked! Driver en route.</Text>
                <Text style={styles.bookedMeta}>Jose Martinez · ETA 8 min · All comms via GetStream</Text>
              </View>
            )}
          </View>
        )}
        {/* TRACK TAB */}
        {tab === 'track' && (
          <View style={styles.trackBox}>
            <View style={styles.trackHeader}>
              <Text style={styles.trackDriver}>Jose Martinez · En Route</Text>
              <Text style={styles.trackLive}>🔴 Live</Text>
            </View>
            <Text style={styles.trackMeta}>ETA 8 min · Toyota Camry · 12 credits</Text>
            <View style={styles.trackMap}><Text style={styles.trackMapText}>[Live Map — GetStream location feed]</Text></View>
            <View style={styles.trackActions}>
              <TouchableOpacity style={styles.trackCall}><Text style={styles.trackCallText}>📞 Call</Text></TouchableOpacity>
              <TouchableOpacity style={styles.trackSOS}><Text style={styles.trackSOSText}>🚨 SOS</Text></TouchableOpacity>
            </View>
            <View style={styles.safetyBox}>
              <Text style={styles.safetyTitle}>Safety Features Active</Text>
              <Text style={styles.safetyItem}>🛡️ Background checked</Text>
              <Text style={styles.safetyItem}>📞 Emergency SOS</Text>
              <Text style={styles.safetyItem}>✅ ID verified</Text>
            </View>
          </View>
        )}
        {/* PACKAGE & CHAT TABS */}
        {tab === 'package' && (
          <View style={styles.centeredBox}>
            <Text style={styles.centeredIcon}>📦</Text>
            <Text style={styles.centeredTitle}>Package Delivery</Text>
            <Text style={styles.centeredDesc}>GetStream-powered · Safety-first</Text>
          </View>
        )}
        {tab === 'chat' && (
          user && user.activeTripId ? (
            <TrustTransportStreamTab tripId={user.activeTripId} />
          ) : (
            <View style={styles.centeredBox}>
              <Text style={styles.centeredIcon}>💬</Text>
              <Text style={styles.centeredTitle}>Transport Chat</Text>
              <Text style={styles.centeredDesc}>GetStream-powered · Safety-first</Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1117' },
  header: { height: 56, backgroundColor: '#090B0F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F9FAFB' },
  headerLive: { fontSize: 12, color: '#22C55E', fontWeight: '700' },
  nav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#090B0F', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  navBtn: { flex: 1, paddingVertical: 12 },
  navBtnActive: { borderBottomWidth: 2, borderBottomColor: COLOR },
  navBtnText: { color: '#6B7280', fontSize: 14, textAlign: 'center' },
  navBtnTextActive: { color: COLOR, fontWeight: '700' },
  scroll: { flex: 1 },
  sectionBox: { padding: 16, borderRadius: 14, backgroundColor: '#F9731608', borderWidth: 1, borderColor: '#F9731618', margin: 16, marginBottom: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB', marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: '#6B7280' },
  inputBox: { flexDirection: 'column', gap: 10, margin: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 12, fontSize: 14, color: '#E8EAF0', padding: 14, marginBottom: 10 },
  nearbyTitle: { fontSize: 14, fontWeight: '700', color: '#9CA3AF', margin: 16, marginBottom: 10 },
  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderColor: '#F9731620', borderWidth: 1, borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F9731620', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: COLOR, fontWeight: '800', fontSize: 15 },
  driverName: { fontSize: 14, fontWeight: '700', color: '#F9FAFB' },
  driverMeta: { fontSize: 12, color: '#6B7280' },
  eta: { fontSize: 13, color: '#22C55E', fontWeight: '700', marginBottom: 6 },
  bookBtn: { backgroundColor: COLOR, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  bookBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#6B7280' },
  bookedBox: { padding: 16, borderRadius: 14, backgroundColor: '#22C55E10', borderWidth: 1, borderColor: '#22C55E30', margin: 16, marginTop: 10 },
  bookedText: { fontSize: 14, fontWeight: '700', color: '#22C55E' },
  bookedMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  trackBox: { padding: 16, borderRadius: 14, backgroundColor: '#F9731608', borderWidth: 1, borderColor: '#F9731625', margin: 16, marginBottom: 0 },
  trackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  trackDriver: { fontSize: 15, fontWeight: '700', color: '#F9FAFB' },
  trackLive: { backgroundColor: '#22C55E20', color: '#22C55E', borderWidth: 1, borderColor: '#22C55E40', fontSize: 11, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, fontWeight: '700' },
  trackMeta: { fontSize: 13, color: '#9CA3AF', marginBottom: 12 },
  trackMap: { paddingVertical: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', marginBottom: 12 },
  trackMapText: { color: '#4B5563', fontSize: 13 },
  trackActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  trackCall: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#F9731615', borderWidth: 1, borderColor: '#F9731630', alignItems: 'center' },
  trackCallText: { color: COLOR, fontSize: 12, fontWeight: '600' },
  trackSOS: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center' },
  trackSOSText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  safetyBox: { padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginTop: 8 },
  safetyTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 8 },
  safetyItem: { fontSize: 12, color: '#9CA3AF', paddingVertical: 2 },
  centeredBox: { alignItems: 'center', paddingVertical: 40 },
  centeredIcon: { fontSize: 48, marginBottom: 12 },
  centeredTitle: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 },
  centeredDesc: { fontSize: 13, color: '#6B7280' },
});
