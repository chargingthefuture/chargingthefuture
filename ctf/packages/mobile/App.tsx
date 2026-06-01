import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChymeRoom } from './src/features/chyme';
import { ComicReviewConsole } from './src/features/comic';
import { DirectoryList } from './src/features/directory';
import { Feed } from './src/features/feed';
import { Announcements } from './src/features/announcements';
import { WorkforceDashboard } from './src/features/workforce';
import { SkillsHunt } from './src/features/skills-hunt';
import { Foundation } from './src/features/foundation';
import { Lighthouse } from './src/features/lighthouse';
import { SocketRelay } from './src/features/socketrelay';
import { TrustTransport } from './src/features/trusttransport';
import { PeerProgramming } from './src/features/peer-programming';
import { Mood } from './src/features/mood';
import { GentlePulse } from './src/features/gentlepulse';
import { WeeklyPerformance } from './src/features/weekly-performance';
import { Gdp } from './src/features/gdp';
import { ServiceCredits } from './src/features/service-credits';
import { Levelup } from './src/features/levelup';
import { Unlock } from './src/features/unlock';
import { SkillsTaxonomy } from './src/features/skills-taxonomy';
import { AuthProvider } from './src/features/trusttransport/auth-context';

type FeatureKey =
  | 'chyme'
  | 'skills-taxonomy'
  | 'directory'
  | 'feed-announcements'
  | 'workforce'
  | 'skills-hunt'
  | 'foundation'
  | 'lighthouse'
  | 'socketrelay'
  | 'trusttransport'
  | 'peer-programming'
  | 'mood'
  | 'gentlepulse'
  | 'weekly-performance'
  | 'gdp'
  | 'service-credits'
  | 'levelup'
  | 'unlock'
  | 'comic-review';

const featureOrder: Array<{ key: FeatureKey; label: string }> = [
  { key: 'chyme', label: 'Chyme' },
  { key: 'skills-taxonomy', label: 'Skills Taxonomy' },
  { key: 'directory', label: 'Directory' },
  { key: 'feed-announcements', label: 'Feed+Announcements' },
  { key: 'workforce', label: 'Workforce' },
  { key: 'skills-hunt', label: 'Skills Hunt' },
  { key: 'foundation', label: 'Foundation' },
  { key: 'lighthouse', label: 'Lighthouse' },
  { key: 'socketrelay', label: 'SocketRelay' },
  { key: 'trusttransport', label: 'TrustTransport' },
  { key: 'peer-programming', label: 'Peer Programming' },
  { key: 'mood', label: 'Mood' },
  { key: 'gentlepulse', label: 'GentlePulse' },
  { key: 'weekly-performance', label: 'Weekly Performance' },
  { key: 'gdp', label: 'GDP' },
  { key: 'service-credits', label: 'Service Credits' },
  { key: 'levelup', label: 'LevelUp' },
  { key: 'unlock', label: 'Unlock' },
  { key: 'comic-review', label: 'AI Review' },
];

export default function App() {
  const [selected, setSelected] = useState<FeatureKey>('chyme');

  const featureView = useMemo(() => {
    switch (selected) {
      case 'chyme':
        return <ChymeRoom />;
      case 'skills-taxonomy':
        return <SkillsTaxonomy />;
      case 'directory':
        return <DirectoryList />;
      case 'feed-announcements':
        return (
          <ScrollView contentContainerStyle={styles.feedStack}>
            <Feed />
            <Announcements />
          </ScrollView>
        );
      case 'workforce':
        return <WorkforceDashboard />;
      case 'skills-hunt':
        return <SkillsHunt />;
      case 'foundation':
        return <Foundation />;
      case 'lighthouse':
        return <Lighthouse />;
      case 'socketrelay':
        return <SocketRelay />;
      case 'trusttransport':
        return <TrustTransport />;
      case 'peer-programming':
        return <PeerProgramming />;
      case 'mood':
        return <Mood />;
      case 'gentlepulse':
        return <GentlePulse />;
      case 'weekly-performance':
        return <WeeklyPerformance />;
      case 'gdp':
        return <Gdp />;
      case 'service-credits':
        return <ServiceCredits />;
      case 'levelup':
        return <Levelup />;
      case 'unlock':
        return <Unlock />;
      case 'comic-review':
        return <ComicReviewConsole />;
      default:
        return <ChymeRoom />;
    }
  }, [selected]);

  return (
    <AuthProvider>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>ChargingTheFuture Mobile</Text>
        <Text style={styles.subtitle}>Web/Android plugin parity hub</Text>

        <ScrollView horizontal style={styles.pillRow} contentContainerStyle={styles.pillContent}>
          {featureOrder.map((feature) => (
            <TouchableOpacity
              key={feature.key}
              style={[styles.pill, selected === feature.key ? styles.pillActive : null]}
              onPress={() => setSelected(feature.key)}
            >
              <Text
                style={[styles.pillText, selected === feature.key ? styles.pillTextActive : null]}
              >
                {feature.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.content}>{featureView}</View>
        <StatusBar style="auto" />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pillRow: {
    maxHeight: 48,
  },
  pillContent: {
    gap: 8,
    alignItems: 'center',
    paddingVertical: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8f8f8',
  },
  pillActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  pillText: {
    fontSize: 12,
    color: '#222',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    marginTop: 10,
  },
  feedStack: {
    gap: 12,
    paddingBottom: 24,
  },
});
