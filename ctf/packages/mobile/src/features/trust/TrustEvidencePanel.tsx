import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrustVisibilityBadge } from './TrustVisibilityBadge';

export interface TrustEvidenceItem {
  type: string;
  summary: string;
  details?: string;
  createdAt: string;
}

export interface TrustUserExtension {
  trustStatus: 'verified' | 'unverified' | 'flagged';
  trustVisibility: 'public' | 'private' | 'restricted';
  trustEvidence: TrustEvidenceItem[];
}

export interface TrustEvidencePanelProps {
  trust: TrustUserExtension;
  compact?: boolean;
}

export const TrustEvidencePanel: React.FC<TrustEvidencePanelProps> = ({ trust, compact }: TrustEvidencePanelProps) => {
  const empty = !trust.trustEvidence || trust.trustEvidence.length === 0;
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Trust</Text>
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>Visibility:</Text>
          <TrustVisibilityBadge trustVisibility={trust.trustVisibility} />
        </View>
      </View>
      {empty ? (
        <View style={compact ? styles.emptyCompact : styles.empty}>
          <Text style={styles.emptyTitle}>No trust signals yet</Text>
          <Text style={styles.emptyDesc}>Signals appear as you participate in the community.</Text>
          <Text style={styles.emptyDesc}>Visible to: {trust.trustVisibility.charAt(0).toUpperCase() + trust.trustVisibility.slice(1)}</Text>
        </View>
      ) : (
        trust.trustEvidence.map((item: TrustEvidenceItem) => (
          <View style={styles.evidenceItem}>
            <Text style={styles.evidenceType}>{item.type}</Text>
            <Text style={styles.evidenceSummary}>{item.summary}</Text>
            {item.details ? <Text style={styles.evidenceDetails}>{item.details}</Text> : null}
            <Text style={styles.evidenceDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { backgroundColor: '#18181b', borderRadius: 8, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  headerText: { fontWeight: '700', fontSize: 16, color: '#fff', marginRight: 8 },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  visibilityLabel: { fontSize: 12, color: '#aaa', marginRight: 4 },
  empty: { alignItems: 'center', paddingVertical: 24 },
  emptyCompact: { alignItems: 'center', paddingVertical: 12 },
  emptyTitle: { fontWeight: '700', fontSize: 15, color: '#fff', marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: '#aaa', marginBottom: 2 },
  evidenceItem: { backgroundColor: '#23232b', borderRadius: 6, padding: 10, marginBottom: 8 },
  evidenceType: { fontWeight: '600', fontSize: 13, color: '#fff' },
  evidenceSummary: { fontSize: 12, color: '#eee', marginTop: 2 },
  evidenceDetails: { fontSize: 11, color: '#bbb', marginTop: 2 },
  evidenceDate: { fontSize: 10, color: '#888', marginTop: 2, alignSelf: 'flex-end' },
});
