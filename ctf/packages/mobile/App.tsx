import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChymeRoom } from './src/features/chyme';
import { ComicReviewConsole } from './src/features/comic';
import { HubHome } from './src/features/hub';
import { DirectoryList } from './src/features/directory';
import { Feed } from './src/features/feed';
import { Announcements } from './src/features/announcements';
import { WorkforceDashboard } from './src/features/workforce';
import { SkillsHunt } from './src/features/skills-hunt';
import { Foundation } from './src/features/foundation';
import { Lighthouse } from './src/features/lighthouse';
import { SocketRelay, AdminSocketRelay } from './src/features/socketrelay';
import { TrustTransport, AdminTrustTransport } from './src/features/trusttransport';
import { PeerProgramming, AdminPeerProgramming } from './src/features/peer-programming';
import { Mood } from './src/features/mood';
import { GentlePulse } from './src/features/gentlepulse';
import { WeeklyPerformance, AdminWeeklyPerformance } from './src/features/weekly-performance';
import { Gdp } from './src/features/gdp';
import { ServiceCredits } from './src/features/service-credits';
import { Levelup } from './src/features/levelup';
import { Unlock } from './src/features/unlock';
import { SkillsTaxonomy } from './src/features/skills-taxonomy';
import { AccountData } from './src/features/account-data';
import { AuthProvider } from './src/features/trusttransport/auth-context';

type FeatureKey =
  | 'home'
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
  | 'trusttransport-admin'
  | 'peer-programming'
  | 'mood'
  | 'gentlepulse'
  | 'weekly-performance'
  | 'weekly-performance-admin'
  | 'gdp'
  | 'service-credits'
  | 'levelup'
  | 'unlock'
  | 'account-data'
  | 'comic-review'
  | 'peer-programming-admin'
  | 'socketrelay-admin';

const featureOrder: Array<{ key: FeatureKey; label: string }> = [
  { key: 'home', label: 'Home' },
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
  { key: 'trusttransport-admin', label: 'TrustTransport Admin' },
  { key: 'peer-programming', label: 'Peer Programming' },
  { key: 'mood', label: 'Mood' },
  { key: 'gentlepulse', label: 'GentlePulse' },
  { key: 'weekly-performance', label: 'Weekly Performance' },
  { key: 'weekly-performance-admin', label: 'Weekly Performance Admin' },
  { key: 'gdp', label: 'GDP' },
  { key: 'service-credits', label: 'Service Credits' },
  { key: 'levelup', label: 'LevelUp' },
  { key: 'unlock', label: 'Unlock' },
  { key: 'account-data', label: 'Account & Data' },
  { key: 'comic-review', label: 'AI Review' },
  { key: 'peer-programming-admin', label: 'Peer Programming Admin' },
  { key: 'socketrelay-admin', label: 'SocketRelay Admin' },
];

export default function App() {
  const [selected, setSelected] = useState<FeatureKey>('home');

  const featureView = useMemo(() => {
    switch (selected) {
      case 'home':
        return <HubHome />;
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
      case 'trusttransport-admin':
        return <AdminTrustTransport />;
      case 'peer-programming':
        return <PeerProgramming />;
      case 'mood':
        return <Mood />;
      case 'gentlepulse':
        return <GentlePulse />;
      case 'weekly-performance':
        return <WeeklyPerformance />;
      case 'weekly-performance-admin':
        return <AdminWeeklyPerformance />;
      case 'gdp':
        return <Gdp />;
      case 'service-credits':
        return <ServiceCredits />;
      case 'levelup':
        return <Levelup />;
      case 'unlock':
        return <Unlock />;
      case 'account-data':
        return <AccountData />;
      case 'comic-review':
        return <ComicReviewConsole />;
      case 'peer-programming-admin':
        return <AdminPeerProgramming />;
      case 'socketrelay-admin':
        return <AdminSocketRelay />;
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
