// The weekly cohort assignment runner, copied from the web's PeerProgrammingAdminAssignments
// (web components/peer-programming/pp-admin-assignments.tsx).
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AssignmentRunResult } from './PeerProgrammingAdminApi';
import type { AssignmentInput } from './usePeerProgrammingAdmin';
import { AdminInput, Banner, FieldLabel, SectionLead, SolidButton, TickBox } from './AdminParts';

function RunResult({ result }: { result: AssignmentRunResult }) {
  if (result.membersSelected === 0) {
    return (
      <Banner tone="warning">
        No active members were found for this week, so no cohort was formed. Members are counted as active once they
        have signed in within the last 7 days. Use the manual user-id list above to form a cohort right now.
      </Banner>
    );
  }
  return (
    <Banner tone="notice">
      Done. Active members selected: {result.membersSelected}. Cohorts created or updated: {result.cohortsCreated}.
      Notifications recorded: {result.notificationsCreated}.
    </Banner>
  );
}

export function AdminAssignments({ busy, lastResult, onRun }: {
  busy: boolean;
  lastResult: AssignmentRunResult | null;
  onRun: (_input: AssignmentInput) => Promise<void>;
}) {
  const [useOverride, setUseOverride] = useState(false);
  const [idsText, setIdsText] = useState('');

  const run = () => {
    const activeUserIds = useOverride
      ? idsText.split(/[\s,]+/).map((value) => value.trim()).filter((value) => value.length > 0)
      : [];
    void onRun({ allowManualOverride: useOverride, activeUserIds });
  };

  return (
    <View style={styles.stack}>
      <SectionLead marginBottom={0}>
        Forms cohorts of up to 12 people from this week’s active members and records an in-app notification for each
        assignment. Running again for the same week is safe — assignments and notifications are idempotent.
      </SectionLead>
      <TickBox checked={useOverride} onChange={setUseOverride} label="Use a manual user-id list instead of the last-7-days active set" />
      {useOverride ? (
        <View>
          <FieldLabel text="User IDs" />
          <AdminInput
            value={idsText}
            onChangeText={setIdsText}
            placeholder="One user ID per line, or comma-separated"
            multiline
            minHeight={96}
            mono
            autoCapitalize="none"
          />
        </View>
      ) : null}
      <SolidButton label={busy ? 'Running…' : 'Run weekly assignment'} disabled={busy} dim={busy} onPress={run} />
      {lastResult ? <RunResult result={lastResult} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
});
