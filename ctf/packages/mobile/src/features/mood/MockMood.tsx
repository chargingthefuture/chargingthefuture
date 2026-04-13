
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';
import { useMoodEligibility, useSubmitMoodCheck } from '@ctf/shared';

// TODO: Replace with real clientId from auth context

const getClientId = () => 'demo-client-id';

export const Mood = () => {
	const clientId = getClientId();
	const { eligibility, loading: eligibilityLoading, error: eligibilityError, fetchEligibility } = useMoodEligibility(clientId);
	const { result, loading: submitLoading, error: submitError, submit } = useSubmitMoodCheck(clientId);
	const [selected, setSelected] = useState<number | null>(null);

	useEffect(() => { fetchEligibility(); }, [fetchEligibility]);

	if (eligibilityLoading) return <View style={styles.container}><ActivityIndicator color="#fff" /></View>;
	if (eligibilityError) return <View style={styles.container}><Text style={styles.error}>{eligibilityError}</Text></View>;

	if (!eligibility) return <View style={styles.container}><Text style={styles.empty}>Unable to load eligibility.</Text></View>;


	if (!eligibility.eligible) {
		return (
			<View style={styles.container}>
				<Text style={styles.info}>You can submit your next mood check on:</Text>
				<Text style={styles.date}>{new Date(eligibility.nextEligibleAt).toLocaleString()}</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>How are you feeling today?</Text>
			<View style={styles.moodRow}>
				{[1,2,3,4,5].map((v) => (
					<React.Fragment key={v}>
						<Button
							title={v.toString()}
							color={selected === v ? '#FFD600' : '#333'}
							onPress={() => setSelected(v)}
						/>
					</React.Fragment>
				))}
			</View>
			<Button
				title={submitLoading ? 'Submitting...' : 'Submit'}
				onPress={() => selected && submit(selected)}
				disabled={!selected || submitLoading}
				color="#FFD600"
			/>
			{submitError && <Text style={styles.error}>{submitError}</Text>}
			{result && <Text style={styles.success}>Mood check submitted!</Text>}
		</View>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#181818', padding: 24, justifyContent: 'center' },
	title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
	moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
	info: { color: '#fff', fontSize: 16, marginBottom: 8, textAlign: 'center' },
	date: { color: '#FFD600', fontSize: 18, fontWeight: '600', textAlign: 'center' },
	error: { color: '#FF5252', marginTop: 16, textAlign: 'center' },
	success: { color: '#00E676', marginTop: 16, textAlign: 'center' },
	empty: { color: '#888', fontSize: 16, textAlign: 'center' },
});
