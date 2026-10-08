// The list of ongoing activities, its empty state and one card per activity, copied from the web's
// recurring-activity-list.tsx and recurring-activity-item.tsx.

import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, type TextStyle, type ViewStyle } from 'react-native';
import { HeartHandshake } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { SelectField } from './SelectField';
import {
  CADENCE_LABEL,
  SECTOR_LABEL,
  STATUS_LABEL,
  VISIBILITY_LABEL,
  currencyLabel,
  getRecurringActivityTokens,
  rr,
  scValueLabel,
  statusColor,
  type ActionKind,
  type Activity,
  type Currency,
  type RecurringActivityTokens,
  type RecurringActivityVisibility,
} from './shared';

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
  onVisibility: (_id: string, _visibility: RecurringActivityVisibility) => void;
};

export function ActivityList({ activities, currencies, busy, ...handlers }: Handlers & {
  activities: Activity[];
  currencies: Currency[];
  busy: { id: string; action: ActionKind } | null;
}) {
  const { tokens } = useTheme();
  const t = getRecurringActivityTokens(tokens);
  if (activities.length === 0) {
    return (
      <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: t.BORDER_SOLID, borderRadius: rr(tokens, 14), paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' }}>
        <HeartHandshake size={26} color={t.ACCENT} style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 14, fontFamily: interFamily('600'), color: t.TITLE, marginBottom: 6, textAlign: 'center' }}>No ongoing activities yet</Text>
        <Text style={{ fontSize: 13, lineHeight: 22.1, fontFamily: interFamily('400'), color: t.MUTED, maxWidth: 340, textAlign: 'center' }}>
          When you share something ongoing with another member — a home, a service, a standing favor — you can acknowledge it here. It stays private unless you choose otherwise.
        </Text>
      </View>
    );
  }
  return (
    <View>
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          currencies={currencies}
          t={t}
          tokens={tokens}
          busyAction={busy && busy.id === activity.id ? busy.action : null}
          {...handlers}
        />
      ))}
    </View>
  );
}

type ItemProps = Handlers & {
  activity: Activity;
  currencies: Currency[];
  t: RecurringActivityTokens;
  tokens: ThemeTokens;
  busyAction: ActionKind | null;
};

function ActivityItem(props: ItemProps) {
  const { t, tokens } = props;
  return (
    <View style={{ backgroundColor: t.SURFACE, borderWidth: 1, borderColor: t.BORDER_SOLID, borderRadius: rr(tokens, 14), paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12 }}>
      <ActivitySummary activity={props.activity} currencies={props.currencies} t={t} tokens={tokens} />
      <ActivityActions {...props} />
    </View>
  );
}

// Who it is with, sector, unit and cadence, the ServiceCredits line, where it was recorded, and the
// status badge.
function ActivitySummary({ activity, currencies, t, tokens }: Pick<ItemProps, 'activity' | 'currencies' | 't' | 'tokens'>) {
  const withName = activity.counterpartyName ? `with ${activity.counterpartyName}` : 'with a member';
  const scLine = scValueLabel(activity, currencies);
  const color = statusColor(activity.status, t);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontFamily: interFamily('700'), color: t.TITLE, marginBottom: 4 }}>{withName}</Text>
        <Text style={{ fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: t.SUBTLE }}>
          {SECTOR_LABEL[activity.sector]} · {currencyLabel(activity.currencyCode, currencies)} · {CADENCE_LABEL[activity.cadence]}
        </Text>
        {scLine ? <Text style={{ fontSize: 13, fontFamily: interFamily('400'), color: t.TEXT, marginTop: 4 }}>{scLine}</Text> : null}
        {activity.originPlugin ? (
          <Text style={{ fontSize: 12, fontFamily: interFamily('400'), color: t.SUBTLE, marginTop: 4 }}>
            Recorded from {ORIGIN_LABEL[activity.originPlugin] ?? activity.originPlugin}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 11, fontFamily: interFamily('600'), paddingVertical: 4, paddingHorizontal: 10, borderRadius: rr(tokens, 999), overflow: 'hidden', color, backgroundColor: `${color}1A` }}>
        {STATUS_LABEL[activity.status]}
      </Text>
    </View>
  );
}

// Which actions an activity offers, as the web item decides them.
function actionsFor(activity: Activity) {
  const { status, role } = activity;
  return {
    isCounterpartyPending: status === 'pending' && role === 'counterparty',
    canEnd: status === 'pending' || status === 'active',
    canSetVisibility: role === 'owner' && status === 'active',
  };
}

// A button's label, with the web's "…ing" form while that action runs.
function actionLabel(busyAction: ActionKind | null, action: ActionKind, idle: string, running: string): string {
  return busyAction === action ? running : idle;
}

// Confirm and Decline for a pending counterparty, End activity, and the owner's "Visible to" choice.
function ActivityActions({ activity, t, tokens, busyAction, onConfirm, onDecline, onEnd, onVisibility }: ItemProps) {
  const { isCounterpartyPending, canEnd, canSetVisibility } = actionsFor(activity);
  const busy = busyAction !== null;
  if (!isCounterpartyPending && !canEnd && !canSetVisibility) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: t.BORDER_SOLID }}>
      {isCounterpartyPending ? (
        <>
          <ActionButton t={t} tokens={tokens} kind="primary" busy={busy} label={actionLabel(busyAction, 'confirm', 'Confirm', 'Confirming…')} onPress={() => onConfirm(activity.id)} />
          <ActionButton t={t} tokens={tokens} kind="ghost" busy={busy} label={actionLabel(busyAction, 'decline', 'Decline', 'Declining…')} onPress={() => onDecline(activity.id)} />
        </>
      ) : null}
      {canEnd ? (
        <ActionButton t={t} tokens={tokens} kind="ghost" busy={busy} label={actionLabel(busyAction, 'end', 'End activity', 'Ending…')} onPress={() => onEnd(activity.id)} />
      ) : null}
      {canSetVisibility ? <VisibilityPicker activity={activity} t={t} busy={busy} onVisibility={onVisibility} /> : null}
    </View>
  );
}

// The owner's "Visible to" choice on an active activity.
function VisibilityPicker({ activity, t, busy, onVisibility }: Pick<ItemProps, 'activity' | 't' | 'onVisibility'> & { busy: boolean }) {
  const [visDraft, setVisDraft] = useState<RecurringActivityVisibility>(activity.visibility);
  useEffect(() => setVisDraft(activity.visibility), [activity.visibility]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
      <Text style={{ fontSize: 12, fontFamily: interFamily('400'), color: t.MUTED }}>Visible to</Text>
      <SelectField
        label="Who can see this activity"
        value={visDraft}
        disabled={busy}
        fontSize={12}
        style={{ paddingVertical: 6, paddingHorizontal: 8, gap: 6 }}
        options={VISIBILITY_ORDER.map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
        onChange={(next) => {
          setVisDraft(next);
          onVisibility(activity.id, next);
        }}
      />
    </View>
  );
}

function ActionButton({ t, tokens, kind, busy, label, onPress }: {
  t: RecurringActivityTokens;
  tokens: ThemeTokens;
  kind: 'primary' | 'ghost';
  busy: boolean;
  label: string;
  onPress: () => void;
}) {
  const box: ViewStyle =
    kind === 'primary'
      ? { backgroundColor: t.ACCENT }
      : { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.BORDER_STRONG };
  const text: TextStyle =
    kind === 'primary' ? { color: t.BG, fontFamily: interFamily('700') } : { color: t.SUBTLE, fontFamily: interFamily('600') };
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={[{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: rr(tokens, 8), opacity: busy ? 0.7 : 1 }, box]}
    >
      <Text style={[{ fontSize: 13 }, text]}>{label}</Text>
    </TouchableOpacity>
  );
}
