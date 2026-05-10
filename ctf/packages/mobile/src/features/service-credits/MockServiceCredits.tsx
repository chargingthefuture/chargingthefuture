import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';

// Placeholder for auth integration
// import { useAuth } from 'path-to-generic-auth';

const COLOR = '#F59E0B';

// TODO: Replace with real data fetching logic
const MOCK_TRANSACTIONS = [];
const MOCK_EARN_WAYS = [
	{ title: 'Complete Skills Hunt Round', credits: '+200', color: '#A855F7' },
	{ title: 'Facilitate Peer Programming', credits: '+500', color: '#8B5CF6' },
	{ title: 'Verify Your Profile', credits: '+50', color: '#3B82F6' },
	{ title: 'Refer a Survivor', credits: '+100', color: '#22C55E' },
];

const NAV = [
	{ label: 'Wallet', key: 'wallet' },
	{ label: 'Earn', key: 'earn' },
	{ label: 'Send', key: 'send' },
];

export const ServiceCredits = () => {
	// const { user } = useAuth(); // Uncomment when auth is ready
	const [activeNav, setActiveNav] = useState('wallet');
	const [sendAmount, setSendAmount] = useState('');
	const [transactions] = useState(MOCK_TRANSACTIONS);

	// Empty state check
	const isEmpty = transactions.length === 0;

	return (
		<View style={styles.root}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Service Credits</Text>
				<Text style={styles.headerSubtitle}>Utility token ecosystem</Text>
			</View>
			<View style={styles.navBar}>
				{NAV.map((nav) => (
					<TouchableOpacity onPress={() => setActiveNav(nav.key)} style={[styles.navBtn, activeNav === nav.key && styles.navBtnActive]}>
						<Text style={[styles.navBtnText, activeNav === nav.key && styles.navBtnTextActive]}>{nav.label}</Text>
					</TouchableOpacity>
				))}
			</View>
			<ScrollView style={styles.content}>
				{activeNav === 'wallet' && (
					<View>
						<View style={styles.balanceCard}>
							<Text style={styles.balanceLabel}>YOUR BALANCE</Text>
							<Text style={styles.balanceValue}>2,420</Text>
							<Text style={styles.balanceCredits}>credits ≈ $242 USD</Text>
						</View>
						{/* Stats and transactions */}
						{isEmpty ? (
							<View style={styles.emptyState}><Text style={styles.emptyText}>No transactions yet.</Text></View>
						) : (
							<View>{/* Render transactions here */}</View>
						)}
					</View>
				)}
				{activeNav === 'earn' && (
					<View>
						<Text style={styles.sectionTitle}>Earn Credits</Text>
						<Text style={styles.sectionSubtitle}>Contribute to the community and get rewarded</Text>
						{MOCK_EARN_WAYS.map((w) => (
							<View style={[styles.earnCard, { borderColor: w.color }]}> 
								<Text style={styles.earnTitle}>{w.title}</Text>
								<Text style={[styles.earnCredits, { color: COLOR }]}>{w.credits}</Text>
								<Button title="Start" onPress={() => {}} color={w.color} />
							</View>
						))}
					</View>
				)}
				{activeNav === 'send' && (
					<View>
						<Text style={styles.sectionTitle}>Send Credits</Text>
						<TextInput placeholder="Survivor username or ID…" style={styles.input} placeholderTextColor="#9CA3AF" />
						<TextInput value={sendAmount} onChangeText={setSendAmount} placeholder="Amount (e.g. 50)" style={styles.input} placeholderTextColor="#9CA3AF" keyboardType="numeric" />
						<TextInput placeholder="Note (optional)" style={styles.input} placeholderTextColor="#9CA3AF" multiline />
						<Button title={`Send ${sendAmount || '0'} Credits`} onPress={() => {}} color={COLOR} />
					</View>
				)}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#0F1117' },
	header: { padding: 20, backgroundColor: '#090B0F', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
	headerTitle: { fontSize: 20, fontWeight: '800', color: '#F9FAFB' },
	headerSubtitle: { fontSize: 12, color: COLOR, marginTop: 2 },
	navBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#090B0F', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
	navBtn: { flex: 1, padding: 12, alignItems: 'center' },
	navBtnActive: { borderBottomWidth: 2, borderBottomColor: COLOR },
	navBtnText: { color: '#6B7280', fontWeight: '600' },
	navBtnTextActive: { color: COLOR },
	content: { flex: 1 },
	balanceCard: { padding: 20, borderRadius: 16, backgroundColor: '#1F2937', alignItems: 'center', margin: 16 },
	balanceLabel: { fontSize: 13, fontWeight: '700', color: COLOR, marginBottom: 6 },
	balanceValue: { fontSize: 48, fontWeight: '900', color: '#F9FAFB', marginBottom: 4 },
	balanceCredits: { fontSize: 13, color: COLOR, marginBottom: 16 },
	sectionTitle: { fontSize: 16, fontWeight: '800', color: '#F9FAFB', margin: 16 },
	sectionSubtitle: { fontSize: 12, color: '#6B7280', marginLeft: 16, marginBottom: 14 },
	earnCard: { padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, marginBottom: 10, marginHorizontal: 16 },
	earnTitle: { fontSize: 14, fontWeight: '600', color: '#F9FAFB', marginBottom: 2 },
	earnCredits: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
	input: { width: '90%', alignSelf: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 14, color: '#E8EAF0', marginBottom: 10 },
	emptyState: { alignItems: 'center', marginTop: 40 },
	emptyText: { color: '#9CA3AF', fontSize: 16 },
});
