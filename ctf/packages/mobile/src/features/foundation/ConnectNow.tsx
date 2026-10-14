// "Connect now" and the "Accepts live 1:1 calls" badge, copied from the web foundation-connect-now.tsx:
// the same rules for when each shows, the same sizes (compact on a browse card, full on a profile).
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PhoneCall } from 'lucide-react-native';
import { rateLabel } from './FoundationApi';
import type { ProviderView } from './FoundationDataApi';
import { ConnectNowConfirm } from './ConnectNowConfirm';
import { FDButton, looks } from './FDButton';
import { alpha, font, useFDTheme } from './useFDTheme';

// The provider opted in and set a rate of at least 1 credit, in round credits.
export function acceptsInstantCalls(provider: ProviderView): boolean {
  if (!provider.instantCallEnabled) return false;
  const rate = provider.instantCallRateCredits;
  return rate !== null && Number.isFinite(rate) && rate >= 1;
}

export function isOwnProfile(provider: ProviderView, viewerUserId: string | null): boolean {
  return Boolean(viewerUserId) && provider.providerUserId === viewerUserId;
}

export function canOfferConnectNow(provider: ProviderView, viewerUserId: string | null): boolean {
  return acceptsInstantCalls(provider) && !isOwnProfile(provider, viewerUserId);
}

export function InstantCallAvailabilityBadge({ provider, compact = false }: { provider: ProviderView; compact?: boolean }) {
  const { t, r } = useFDTheme();
  const rate = rateLabel(provider.instantCallRateCredits ?? 0, provider.instantCallIntervalMinutes);
  const size = compact ? 12 : 13.5;
  return (
    <View
      style={[
        styles.badge,
        {
          paddingVertical: compact ? 6 : 9,
          paddingHorizontal: compact ? 12 : 16,
          borderRadius: r(compact ? 8 : 10),
          backgroundColor: alpha(t.ACCENT, '12'),
          borderColor: alpha(t.ACCENT, '30'),
        },
      ]}
    >
      <PhoneCall size={compact ? 14 : 16} color={t.ACCENT} />
      <Text style={[font(size, '600'), { color: t.ACCENT }]}>Accepts live 1:1 calls</Text>
      <Text style={[font(size, '600'), styles.rate, { color: t.ACCENT }]}>· {rate}</Text>
    </View>
  );
}

export function ConnectNowButton({ provider, compact = false }: { provider: ProviderView; compact?: boolean }) {
  const { t } = useFDTheme();
  const [open, setOpen] = useState(false);
  const rate = rateLabel(provider.instantCallRateCredits ?? 0, provider.instantCallIntervalMinutes);
  return (
    <>
      <FDButton
        label="Connect now"
        trailing={`· ${rate}`}
        accessibilityLabel={`Connect now — ${rate}`}
        icon={PhoneCall}
        iconSize={compact ? 14 : 16}
        look={looks(t).primary}
        pad={compact ? [7, 14] : [10, 18]}
        radius={compact ? 8 : 10}
        size={compact ? 12 : 14}
        onPress={() => setOpen(true)}
      />
      {open ? <ConnectNowConfirm provider={provider} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderWidth: 1, alignSelf: 'flex-start', maxWidth: '100%' },
  rate: { opacity: 0.85 },
});
