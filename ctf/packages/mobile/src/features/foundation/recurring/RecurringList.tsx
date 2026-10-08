// The list of ongoing activities, copied from the web RecurringActivityList and RecurringActivityItem:
// each tie with its status, Confirm / Decline for the other member, End activity, and who can see it.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HeartHandshake } from 'lucide-react-native';
import { FDButton } from '../FDButton';
import { FDSelect } from '../FDSelect';
import { font } from '../useFDTheme';
import {
  CADENCE_LABEL,
  SECTOR_LABEL,
  STATUS_LABEL,
  VISIBILITY_LABEL,
  currencyLabel,
  scValueLabel,
  statusColor,
  useRATheme,
  type ActionKind,
  type Activity,
  type RACurrency,
  type RecurringActivityVisibility,
} from './raShared';

const VISIBILITY_ORDER: RecurringActivityVisibility[] = ['private', 'restricted', 'public'];

const ORIGIN_LABEL: Record<string, string> = {
  lighthouse: 'LightHouse',
  foundation: 'Foundation',
  'socket-relay': 'SocketRelay',
  'trust-transport': 'TrustTransport',
  'service-credits': 'ServiceCredits',
};

type Handlers = {
  onConfirm: (_id: string) => void;
  onDecline: (_id: string) => void;
  onEnd: (_id: string) => void;
  onVisibility: (_id: string, _v: RecurringActivityVisibility) => void;
};

function deriveFlags(a: Activity) {
  const isCounterpartyPending = a.status === 'pending' && a.role === 'counterparty';
  const canEnd = a.status === 'pending' || a.status === 'active';
  const canSetVisibility = a.role === 'owner' && a.status === 'active';
  return { isCounterpartyPending, canEnd, canSetVisibility, hasActions: isCounterpartyPending || canEnd || canSetVisibility };
}

function ItemActions({ activity, busyAction, handlers }: { activity: Activity; busyAction: ActionKind | null; handlers: Handlers }) {
  const { t, r } = useRATheme();
  const [visDraft, setVisDraft] = useState<RecurringActivityVisibility>(activity.visibility);
  const flags = deriveFlags(activity);
  if (!flags.hasActions) return null;
  const busy = busyAction !== null;
  const ghost = { bg: 'transparent', border: t.BORDER_STRONG, color: t.SUBTLE };
  return (
    <View style={[styles.actions, { borderTopColor: t.BORDER_SOLID }]}>
      {flags.isCounterpartyPending ? (
        <>
          <FDButton label={busyAction === 'confirm' ? 'Confirming…' : 'Confirm'} disabled={busy} dimmed={0.7} look={{ bg: t.ACCENT, color: t.BG }} pad={[8, 16]} radius={8} size={13} onPress={() => handlers.onConfirm(activity.id)} />
          <FDButton label={busyAction === 'decline' ? 'Declining…' : 'Decline'} disabled={busy} dimmed={0.7} look={ghost} weight="600" pad={[8, 16]} radius={8} size={13} onPress={() => handlers.onDecline(activity.id)} />
        </>
      ) : null}
      {flags.canEnd ? (
        <FDButton label={busyAction === 'end' ? 'Ending…' : 'End activity'} disabled={busy} dimmed={0.7} look={ghost} weight="600" pad={[8, 16]} radius={8} size={13} onPress={() => handlers.onEnd(activity.id)} />
      ) : null}
      {flags.canSetVisibility ? (
        <View style={styles.visibility}>
          <Text style={[font(12), { color: t.MUTED }]}>Visible to</Text>
          <FDSelect
            label="Who can see this activity"
            value={visDraft}
            disabled={busy}
            options={VISIBILITY_ORDER.map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
            onChange={(next) => { setVisDraft(next); handlers.onVisibility(activity.id, next); }}
            accent={t.ACCENT}
            boxStyle={[styles.visSelect, { borderRadius: r(8), backgroundColor: t.INPUT_BG, borderColor: t.BORDER_STRONG }]}
            textStyle={[font(12), { color: t.TEXT }]}
          />
        </View>
      ) : null}
    </View>
  );
}

function ActivityItem({ activity: a, currencies, busyAction, handlers }: { activity: Activity; currencies: RACurrency[]; busyAction: ActionKind | null; handlers: Handlers }) {
  const { t, r } = useRATheme();
  const scLine = scValueLabel(a, currencies);
  const color = statusColor(a.status, t);
  return (
    <View style={[styles.item, { borderRadius: r(14), backgroundColor: t.SURFACE, borderColor: t.BORDER_SOLID }]}>
      <View style={styles.itemHead}>
        <View style={styles.flex}>
          <Text style={[font(15, '700'), styles.mb4, { color: t.TITLE }]}>{a.counterpartyName ? `with ${a.counterpartyName}` : 'with a member'}</Text>
          <Text style={[font(13), styles.lh21, { color: t.SUBTLE }]}>
            {SECTOR_LABEL[a.sector]} · {currencyLabel(a.currencyCode, currencies)} · {CADENCE_LABEL[a.cadence]}
          </Text>
          {scLine ? <Text style={[font(13), styles.mt4, { color: t.TEXT }]}>{scLine}</Text> : null}
          {a.originPlugin ? <Text style={[font(12), styles.mt4, { color: t.SUBTLE }]}>Recorded from {ORIGIN_LABEL[a.originPlugin] ?? a.originPlugin}</Text> : null}
        </View>
        <View style={[styles.status, { borderRadius: r(999), backgroundColor: `${color}1A` }]}>
          <Text style={[font(11, '600'), { color }]}>{STATUS_LABEL[a.status]}</Text>
        </View>
      </View>
      <ItemActions activity={a} busyAction={busyAction} handlers={handlers} />
    </View>
  );
}

export function RecurringEmpty() {
  const { t, r } = useRATheme();
  return (
    <View style={[styles.empty, { borderRadius: r(14), borderColor: t.BORDER_SOLID }]}>
      <HeartHandshake size={26} color={t.ACCENT} style={styles.mb12} />
      <Text style={[font(14, '600'), styles.center, styles.mb6, { color: t.TITLE }]}>No ongoing activities yet</Text>
      <Text style={[font(13), styles.center, styles.lh22, { color: t.MUTED }]}>
        When you share something ongoing with another member — a home, a service, a standing favor — you can acknowledge it here. It stays private unless you choose otherwise.
      </Text>
    </View>
  );
}

export function RecurringList({ activities, currencies, busy, ...handlers }: { activities: Activity[]; currencies: RACurrency[]; busy: { id: string; action: ActionKind } | null } & Handlers) {
  if (activities.length === 0) return <RecurringEmpty />;
  return (
    <View>
      {activities.map((a) => (
        <ActivityItem key={a.id} activity={a} currencies={currencies} busyAction={busy && busy.id === a.id ? busy.action : null} handlers={handlers} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  mb4: { marginBottom: 4 },
  mb6: { marginBottom: 6 },
  mb12: { marginBottom: 12 },
  mt4: { marginTop: 4 },
  lh21: { lineHeight: 21 },
  lh22: { lineHeight: 22 },
  item: { borderWidth: 1, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  status: { paddingVertical: 4, paddingHorizontal: 10, flexShrink: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  visSelect: { paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, minWidth: 120 },
  empty: { borderWidth: 1, borderStyle: 'dashed', paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' },
});
