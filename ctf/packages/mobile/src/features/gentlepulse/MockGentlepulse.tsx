
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchSessions, playSession, setFavorite } from './api';

const COLOR = '#14B8A6';
const WIDTH = Dimensions.get('window').width;
const NAV: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; key: string }> = [
	{ icon: 'home-outline', label: 'Home', key: 'home' },
	{ icon: 'heart-outline', label: 'Sessions', key: 'sessions' },
	{ icon: 'play-outline', label: 'Playing', key: 'playing' },
	{ icon: 'star-outline', label: 'Favorites', key: 'favorites' },
];

export const GentlePulse = () => {
	const [activeNav, setActiveNav] = useState('sessions');
	const [playing, setPlaying] = useState<string | number | null>(null);
	const [isPaused, setIsPaused] = useState(false);
	const [progress] = useState(40);
	const [favorites, setFavorites] = useState<Set<string | number>>(new Set());
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [refreshing, setRefreshing] = useState(false);

	const loadSessions = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchSessions();
			setSessions(data);
		} catch {
			setError('Could not load sessions.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSessions();
	}, [loadSessions]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await loadSessions();
		setRefreshing(false);
	}, [loadSessions]);

	const handlePlay = useCallback(async (sessionId: string | number) => {
		setPlaying(sessionId);
		setActiveNav('playing');
		try {
			await playSession(sessionId);
		} catch {
			// Non-critical: play tracking failure doesn't block playback
		}
	}, []);

	const handleToggleFavorite = useCallback(async (sessionId: string | number) => {
		const isFav = favorites.has(sessionId);
		// Optimistic update
		setFavorites((prev) => {
			const next = new Set(prev);
			if (isFav) next.delete(sessionId);
			else next.add(sessionId);
			return next;
		});
		try {
			await setFavorite(sessionId, !isFav);
		} catch {
			// Revert on failure
			setFavorites((prev) => {
				const next = new Set(prev);
				if (isFav) next.add(sessionId);
				else next.delete(sessionId);
				return next;
			});
		}
	}, [favorites]);

	const currentSession = sessions.find((s: any) => s.id === playing);

	return (
		<View style={styles.root}>
			{/* Top bar */}
			<View style={styles.statusBar}>
				<Text style={styles.statusTime}>9:41</Text>
				<Text style={styles.statusBattery}>100%</Text>
			</View>
			{/* Header */}
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<View style={styles.headerIcon}><Ionicons name="heart" size={18} color={COLOR} /></View>
					<View>
						<Text style={styles.headerTitle}>GentlePulse</Text>
						<Text style={styles.headerSubtitle}>Trauma-informed meditation</Text>
					</View>
				</View>
				<View style={styles.headerStreak}><Text style={styles.headerStreakText}>🔥 7 days</Text></View>
			</View>
			{/* Main content */}
			<ScrollView style={styles.scroll} contentContainerStyle={{ flexGrow: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
				<View style={styles.content}>
					{loading && (
						<View style={{ alignItems: 'center', marginTop: 40 }}><ActivityIndicator size="large" color={COLOR} /></View>
					)}
					{error && !loading && (
						<View style={{ alignItems: 'center', marginTop: 40 }}>
							<Text style={{ color: '#EF4444', marginBottom: 12 }}>{error}</Text>
							<TouchableOpacity onPress={loadSessions} style={styles.playerEmptyBtn}><Text style={styles.playerEmptyBtnText}>Retry</Text></TouchableOpacity>
						</View>
					)}
					{!loading && !error && activeNav === 'sessions' && (
						<>
							<View style={styles.statsBox}>
								<Text style={styles.statsTitle}>23 min practiced today</Text>
								<Text style={styles.statsSubtitle}>47 sessions done · 14h 20m total</Text>
							</View>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ alignItems: 'center' }}>
								{['All', 'Breathing', 'Mindfulness', 'Grounding', 'Sleep', 'Morning'].map((c, i) => (
									<TouchableOpacity style={[styles.categoryBtn, i === 0 && styles.categoryBtnActive]}>
										<Text style={[styles.categoryText, i === 0 && styles.categoryTextActive]}>{c}</Text>
									</TouchableOpacity>
								))}
							</ScrollView>
							{sessions.length === 0 ? (
								<View style={{ alignItems: 'center', marginTop: 40 }}>
									<Text style={{ color: '#6B7280', fontSize: 16 }}>No sessions available.</Text>
								</View>
							) : (
								<View style={styles.sessionGrid}>
									{sessions.map((s) => (
										<TouchableOpacity style={styles.sessionCard} onPress={() => handlePlay(s.id)}>
											<Text style={styles.sessionEmoji}>{s.emoji || '🧘'}</Text>
											<Text style={styles.sessionTitle}>{s.title}</Text>
											<View style={styles.sessionMeta}>
												<Text style={styles.sessionDuration}><Ionicons name="time-outline" size={10} color="#4B5563" /> {s.duration || '--'}</Text>
												<View style={styles.sessionPlay}><Ionicons name="play" size={12} color={COLOR} /></View>
											</View>
										</TouchableOpacity>
									))}
								</View>
							)}
						</>
					)}
					{!loading && !error && activeNav === 'playing' && (
						<View style={styles.playerBox}>
							{currentSession ? (
								<>
									<Text style={styles.playerEmoji}>{currentSession.emoji || '🧘'}</Text>
									<Text style={styles.playerTitle}>{currentSession.title}</Text>
									<Text style={styles.playerMeta}>{currentSession.category || ''} · {currentSession.duration || '--'}</Text>
									<View style={styles.playerProgressBg}>
										<View style={[styles.playerProgress, { width: `${progress}%` }]} />
									</View>
									<View style={styles.playerProgressLabels}>
										<Text style={styles.playerProgressLabel}>2:00</Text>
										<Text style={styles.playerProgressLabel}>{currentSession.duration || '--'}</Text>
									</View>
									<View style={styles.playerControls}>
										<TouchableOpacity onPress={() => setActiveNav('sessions')} style={styles.playerControlBtn}><Text style={styles.playerControlBtnText}>←</Text></TouchableOpacity>
										<TouchableOpacity onPress={() => setIsPaused(!isPaused)} style={styles.playerPlayBtn}>
											<Ionicons name={isPaused ? 'play' : 'pause'} size={28} color="#0A0F0E" />
										</TouchableOpacity>
										<TouchableOpacity onPress={() => setPlaying(null)} style={styles.playerControlBtn}><Text style={styles.playerControlBtnText}>✕</Text></TouchableOpacity>
									</View>
									<Text style={styles.playerAffirm}>You are safe. You are healing. 💚</Text>
								</>
							) : (
								<View style={styles.playerEmpty}>
									<Ionicons name="heart" size={48} color={COLOR} style={{ opacity: 0.3, marginBottom: 12 }} />
									<Text style={styles.playerEmptyText}>Select a session to begin</Text>
									<TouchableOpacity onPress={() => setActiveNav('sessions')} style={styles.playerEmptyBtn}><Text style={styles.playerEmptyBtnText}>Browse Sessions</Text></TouchableOpacity>
								</View>
							)}
						</View>
					)}
					{!loading && !error && (activeNav === 'home' || activeNav === 'favorites') && (
						<View style={styles.safeSpaceBox}>
							<Text style={styles.safeSpaceEmoji}>💚</Text>
							<Text style={styles.safeSpaceTitle}>Your Safe Space</Text>
							<Text style={styles.safeSpaceDesc}>48 trauma-informed sessions · Expert-designed · Always free</Text>
							<View style={styles.safeSpaceQuoteBox}>
								<Text style={styles.safeSpaceQuote}>
									"You did not choose what happened to you. You DO choose what happens next."
								</Text>
							</View>
						</View>
					)}
				</View>
			</ScrollView>
			{/* Bottom nav */}
			<View style={styles.bottomNav}>
				{NAV.map(({ icon, label, key }) => (
					<TouchableOpacity onPress={() => setActiveNav(key)} style={styles.bottomNavBtn}>
						<View style={[styles.bottomNavIcon, activeNav === key && styles.bottomNavIconActive]}>
							<Ionicons name={icon} size={20} color={activeNav === key ? COLOR : '#4B5563'} />
						</View>
						<Text style={[styles.bottomNavLabel, activeNav === key && styles.bottomNavLabelActive]}>{label}</Text>
					</TouchableOpacity>
				))}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#0A0F0E' },
	statusBar: { height: 44, backgroundColor: '#060A09', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
	statusTime: { fontSize: 13, fontWeight: '700', color: '#E8EAF0' },
	statusBattery: { fontSize: 12, color: '#9CA3AF' },
	header: { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: '#060A09', borderBottomWidth: 1, borderBottomColor: 'rgba(20,184,166,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	headerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLOR + '30', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
	headerTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB' },
	headerSubtitle: { fontSize: 11, color: COLOR },
	headerStreak: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, backgroundColor: COLOR + '08', borderWidth: 1, borderColor: COLOR + '18' },
	headerStreakText: { fontSize: 11, color: COLOR },
	scroll: { flex: 1 },
	content: { padding: 0 },
	statsBox: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLOR + '08', borderWidth: 1, borderColor: COLOR + '15', marginBottom: 12 },
	statsTitle: { fontSize: 13, fontWeight: '700', color: COLOR, marginBottom: 2 },
	statsSubtitle: { fontSize: 12, color: '#4B5563' },
	categoryScroll: { marginBottom: 12, paddingBottom: 4 },
	categoryBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginRight: 6 },
	categoryBtnActive: { backgroundColor: COLOR + '20', borderColor: COLOR + '40' },
	categoryText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
	categoryTextActive: { color: COLOR },
	sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
	sessionCard: { width: (WIDTH - 16 * 2 - 10) / 2, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(20,184,166,0.03)', borderWidth: 1, borderColor: COLOR + '18', marginBottom: 10 },
	sessionEmoji: { fontSize: 36, marginBottom: 8 },
	sessionTitle: { fontSize: 13, fontWeight: '700', color: '#F9FAFB', marginBottom: 4, lineHeight: 16 },
	sessionMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	sessionDuration: { fontSize: 11, color: '#4B5563' },
	sessionPlay: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLOR + '20', alignItems: 'center', justifyContent: 'center' },
	playerBox: { alignItems: 'center', paddingVertical: 24 },
	playerEmoji: { fontSize: 80, marginBottom: 16 },
	playerTitle: { fontSize: 20, fontWeight: '800', color: '#F9FAFB', marginBottom: 6 },
	playerMeta: { fontSize: 13, color: '#4B5563', marginBottom: 32 },
	playerProgressBg: { height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 6, width: WIDTH - 32 },
	playerProgress: { height: '100%', backgroundColor: COLOR },
	playerProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', width: WIDTH - 32, fontSize: 11, color: '#4B5563', marginBottom: 32 },
	playerProgressLabel: { fontSize: 11, color: '#4B5563' },
	playerControls: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 24 },
	playerControlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
	playerControlBtnText: { fontSize: 18, color: '#6B7280' },
	playerPlayBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLOR, alignItems: 'center', justifyContent: 'center' },
	playerAffirm: { marginTop: 24, fontSize: 13, color: COLOR + '80', fontStyle: 'italic' },
	playerEmpty: { alignItems: 'center', paddingVertical: 40 },
	playerEmptyText: { fontSize: 14, color: '#4B5563' },
	playerEmptyBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: COLOR + '15', borderWidth: 1, borderColor: COLOR + '30' },
	playerEmptyBtnText: { color: COLOR, fontSize: 14, fontWeight: '600' },
	safeSpaceBox: { alignItems: 'center', paddingVertical: 32 },
	safeSpaceEmoji: { fontSize: 64, marginBottom: 16 },
	safeSpaceTitle: { fontSize: 18, fontWeight: '800', color: '#F9FAFB', marginBottom: 6 },
	safeSpaceDesc: { fontSize: 13, color: '#4B5563', lineHeight: 22, marginBottom: 16 },
	safeSpaceQuoteBox: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: COLOR + '08', borderWidth: 1, borderColor: COLOR + '15' },
	safeSpaceQuote: { fontSize: 13, color: '#9CA3AF', lineHeight: 22, fontStyle: 'italic' },
	bottomNav: { height: 72, backgroundColor: '#060A09', borderTopWidth: 1, borderTopColor: 'rgba(20,184,166,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8 },
	bottomNavBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8 },
	bottomNavIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
	bottomNavIconActive: { backgroundColor: COLOR + '20' },
	bottomNavLabel: { fontSize: 10, color: '#374151', fontWeight: '400' },
	bottomNavLabelActive: { color: COLOR, fontWeight: '600' },
});
