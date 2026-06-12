import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trust } from '../trust';
import type { DirectoryListItem } from './api';

// Presentational profile card. It renders a real directory member — the same `DirectoryListItem` shape
// the server returns from GET /api/directory/list — so the caller passes an item it already loaded
// (there is no fetch-one-by-id route on the server, by design). The server splits the name into
// firstName/lastName and uses headline/bio, so map those to the displayed name, title, and description.
export const DirectoryProfile = ({ profile }: { profile: DirectoryListItem }) => {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  const title = profile.headline ?? profile.jobTitleName ?? '';
  const description = profile.bio ?? '';

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{name}</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.desc}>{description}</Text> : null}

      {/* Trust Panel (Android parity) */}
      <Trust />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12 },
  name: { fontSize: 20, fontWeight: '700' },
  title: { color: '#666', marginBottom: 8 },
  desc: { marginBottom: 12 },
});
