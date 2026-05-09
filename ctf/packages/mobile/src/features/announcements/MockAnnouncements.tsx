import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { mobileFeedItems } from '../../mocks/feedDemoData';

const announcements = mobileFeedItems.filter((item) => item.channel === 'announcement');

export const MockAnnouncements = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Announcements Channel</Text>
    <Text style={styles.subtitle}>Published admin guidance rendered inside the mobile parity surface.</Text>
    {announcements.map((item) => (
      <React.Fragment>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardBody}>{item.body}</Text>
        </View>
      </React.Fragment>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 20, backgroundColor: '#fff7ed' },
  title: { fontSize: 18, fontWeight: '700', color: '#9a3412' },
  subtitle: { fontSize: 13, color: '#7c2d12', marginTop: 6 },
  card: { marginTop: 12, borderRadius: 16, backgroundColor: '#ffffff', padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#7c2d12' },
  cardBody: { fontSize: 13, lineHeight: 20, color: '#7c2d12', marginTop: 6 },
});
