// A provider's profile, copied from the web ProviderProfile (foundation-profile.tsx): the header bar with
// Back and Share, the identity, Request Quote and Connect now, the blurb, the skills, About and the
// "Good to know" note.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MapPin, Shield } from 'lucide-react-native';
import type { ProviderView } from './FoundationDataApi';
import { ConnectNowButton, InstantCallAvailabilityBadge, acceptsInstantCalls, canOfferConnectNow, isOwnProfile } from './ConnectNow';
import { FDButton, looks } from './FDButton';
import { Caption, InitialsAvatar } from './FDParts';
import { alpha, font, useFDTheme } from './useFDTheme';
import { ShareLink } from '../../components/shared/ShareLink';
import { getApiBaseUrl } from '../../auth/authedFetch';

// The share link is the web deep link; the app needs an absolute address.
function profileUrl(profileId: string): string {
  try {
    return `${getApiBaseUrl()}/apps/foundation/provider/${profileId}`;
  } catch {
    // no-trace: without a configured address the path alone is still the link
    return `/apps/foundation/provider/${profileId}`;
  }
}

function HeaderBar({ provider, onBack }: { provider: ProviderView; onBack: () => void }) {
  const { t } = useFDTheme();
  return (
    <View style={[styles.headerBar, { borderBottomColor: alpha(t.ACCENT, '25'), backgroundColor: t.HEADER }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={[font(14), { color: t.ACCENT }]}>← Back</Text>
      </Pressable>
      <Text style={[font(16, '700'), styles.flex, { color: t.TITLE }]}>Provider Profile</Text>
      <ShareLink url={profileUrl(provider.profileId)} title="Share this provider" color={t.ACCENT} />
    </View>
  );
}

function Identity({ provider }: { provider: ProviderView }) {
  const { t } = useFDTheme();
  const place = [provider.city, provider.state, provider.country].map((v) => v?.trim()).filter(Boolean).join(', ');
  return (
    <View style={styles.identity}>
      <InitialsAvatar name={provider.displayName} size={80} fontSize={28} tint="25" />
      <View style={styles.flex}>
        <Text style={[font(24, '800'), styles.mb4, { color: t.TITLE }]}>{provider.displayName}</Text>
        {provider.headline ? <Text style={[font(15), { color: t.SUBTLE }]}>{provider.headline}</Text> : null}
        {place ? (
          <View style={styles.location}>
            <MapPin size={13} color={t.MUTED} />
            <Text style={[font(13), styles.flex, { color: t.MUTED }]}>{place}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Actions({ provider, viewerUserId, submitting, onRequestQuote }: { provider: ProviderView; viewerUserId: string | null; submitting: boolean; onRequestQuote: () => void }) {
  const { t } = useFDTheme();
  const own = isOwnProfile(provider, viewerUserId);
  return (
    <View style={styles.actions}>
      <FDButton
        label={submitting ? 'Requesting…' : 'Request Quote'}
        disabled={submitting || own}
        dimmed={0.5}
        look={looks(t).primaryWhite}
        pad={[10, 20]}
        radius={10}
        size={14}
        onPress={onRequestQuote}
      />
      {own ? <Text style={[font(12), styles.lh18, { color: t.MUTED }]}>This is your own profile — you can&apos;t request a quote from yourself.</Text> : null}
      {canOfferConnectNow(provider, viewerUserId) ? (
        <ConnectNowButton provider={provider} />
      ) : acceptsInstantCalls(provider) ? (
        <InstantCallAvailabilityBadge provider={provider} />
      ) : null}
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const { t, r } = useFDTheme();
  return (
    <View style={[styles.section, { borderRadius: r(14), borderColor: alpha(t.ACCENT, '18') }]}>
      <Caption text={label} color={t.FAINT} style={styles.mb10} />
      {children}
    </View>
  );
}

export function ProviderProfile({ provider, viewerUserId, submitting, quoteError, quoteSuccess, onBack, onRequestQuote }: {
  provider: ProviderView;
  viewerUserId: string | null;
  submitting: boolean;
  quoteError: string | null;
  quoteSuccess: boolean;
  onBack: () => void;
  onRequestQuote: () => void;
}) {
  const { t, r } = useFDTheme();
  return (
    <View style={[styles.flex, { backgroundColor: t.BG }]}>
      <HeaderBar provider={provider} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <View>
          <View style={styles.top}>
            <Identity provider={provider} />
            <Actions provider={provider} viewerUserId={viewerUserId} submitting={submitting} onRequestQuote={onRequestQuote} />
          </View>
          {quoteError ? <Text style={[font(13), styles.mb12, { color: '#EF4444' }]}>{quoteError}</Text> : null}
          {quoteSuccess ? <Text style={[font(13), styles.mb12, { color: '#22C55E' }]}>Quote requested. Check the Quotes tab.</Text> : null}
          {provider.shortDescription ? <Text style={[font(14), styles.lh22, styles.mb16, { color: t.SUBTLE }]}>{provider.shortDescription}</Text> : null}
          {provider.offeredSkills.length > 0 ? (
            <View style={styles.mb16}>
              <Section label="Willing to be contacted about">
                <View style={styles.chips}>
                  {provider.offeredSkills.map((s) => (
                    <View key={s.id} style={[styles.chip, { borderRadius: r(999), backgroundColor: alpha(t.ACCENT, '12'), borderColor: alpha(t.ACCENT, '30') }]}>
                      <Text style={[font(12.5, '600'), { color: t.ACCENT }]}>{s.name}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            </View>
          ) : null}
          {provider.bio ? (
            <Section label="About">
              <Text style={[font(14), styles.lh24, { color: t.SUBTLE }]}>{provider.bio}</Text>
            </Section>
          ) : null}
        </View>
        <View style={[styles.goodToKnow, { borderRadius: r(12), backgroundColor: alpha(t.ACCENT, '08'), borderColor: alpha(t.ACCENT, '20') }]}>
          <View style={styles.goodHead}>
            <Shield size={14} color={t.ACCENT} />
            <Text style={[font(12, '600'), { color: t.ACCENT }]}>Good to know</Text>
          </View>
          <Text style={[font(12), styles.lh19, { color: t.MUTED }]}>This provider is a fellow community member, not a formally vetted service.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerBar: { height: 56, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 16 },
  body: { paddingVertical: 24, paddingHorizontal: 16, gap: 20 },
  top: { gap: 20, marginBottom: 28 },
  identity: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  actions: { gap: 8 },
  section: { padding: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 4, paddingHorizontal: 12, borderWidth: 1 },
  goodToKnow: { padding: 16, borderWidth: 1 },
  goodHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  mb4: { marginBottom: 4 },
  mb10: { marginBottom: 10 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  lh18: { lineHeight: 18 },
  lh19: { lineHeight: 19 },
  lh22: { lineHeight: 22 },
  lh24: { lineHeight: 24 },
});
