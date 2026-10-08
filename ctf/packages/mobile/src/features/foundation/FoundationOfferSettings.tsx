// The two settings panels at the top of the Offer tab, copied from the web ProviderDescriptionSettings
// (foundation-description-settings.tsx) and InstantCallSettings (foundation-instant-call-settings.tsx).
// Call alerts sit under the rate fields while instant calls are on, as on the web.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MessageSquareText, PhoneCall } from 'lucide-react-native';
import { fetchDescription, fetchInstantCallSetting, saveDescription, saveInstantCallSetting, type InstantCallSetting } from './FoundationDataApi';
import { FoundationCallAlerts } from './FoundationCallAlerts';
import { FDButton, looks } from './FDButton';
import { ErrorBanner, GradientPanel } from './FDParts';
import { alpha, font, useFDTheme } from './useFDTheme';

const DEFAULT_MAX = 200;
const DEFAULT_INTERVAL = 10;

function PanelTitle({ icon: Icon, title, text }: { icon: typeof PhoneCall; title: string; text: string }) {
  const { t } = useFDTheme();
  return (
    <>
      <View style={styles.titleRow}>
        <Icon size={18} color={t.ACCENT} />
        <Text style={[font(20, '800'), { color: t.TITLE }]}>{title}</Text>
      </View>
      <Text style={[font(14), styles.mb16, { color: t.SUBTLE }]}>{text}</Text>
    </>
  );
}

function SaveRow({ saving, saved, disabled, onSave, extra }: { saving: boolean; saved: boolean; disabled: boolean; onSave: () => void; extra?: React.ReactNode }) {
  const { t } = useFDTheme();
  return (
    <View style={styles.saveRow}>
      <FDButton label={saving ? 'Saving…' : 'Save'} disabled={disabled} dimmed={0.6} look={looks(t).primary} pad={[10, 18]} radius={10} size={14} onPress={onSave} />
      {saved ? <Text style={[font(13), { color: t.ACCENT }]}>Saved</Text> : null}
      {extra}
    </View>
  );
}

function useInputStyle() {
  const { t, r } = useFDTheme();
  return [font(14), styles.input, { borderRadius: r(10), backgroundColor: t.INPUT_BG, color: t.TITLE }];
}

export function ProviderDescriptionSettings() {
  const { t } = useFDTheme();
  const input = useInputStyle();
  const [value, setValue] = useState('');
  const [maxLength, setMaxLength] = useState(DEFAULT_MAX);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchDescription()
      .then((data) => {
        setValue(data.shortDescription ?? '');
        if (typeof data.maxLength === 'number') setMaxLength(data.maxLength);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load your listing description.'))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setValue((await saveDescription(value)) ?? '');
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [value]);

  const remaining = maxLength - value.length;
  const overLimit = remaining < 0;
  return (
    <GradientPanel>
      <PanelTitle icon={MessageSquareText} title="Your listing blurb" text="One or two sentences shown on your Foundation listing before someone requests a quote. Say in plain words what you offer. Leave it empty to show nothing." />
      {error ? <ErrorBanner text={error} style={styles.mb12} /> : null}
      {loading ? (
        <Text style={[font(14), styles.loading, { color: t.MUTED }]}>Loading…</Text>
      ) : (
        <View style={styles.gap10}>
          <Text style={[font(13, '600'), styles.label]}>Short description</Text>
          <TextInput
            value={value}
            onChangeText={(next) => { setValue(next); setSaved(false); }}
            multiline
            numberOfLines={3}
            accessibilityLabel="Short description"
            placeholder="e.g. I help with resume reviews and mock interviews for tech roles."
            placeholderTextColor={t.MUTED}
            style={[input, styles.textarea, { borderColor: overLimit ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)' }]}
          />
          <SaveRow
            saving={saving}
            saved={saved}
            disabled={saving || overLimit}
            onSave={() => void save()}
            extra={<Text style={[font(12), styles.remaining, { color: overLimit ? '#fca5a5' : t.MUTED }]}>{remaining} left</Text>}
          />
        </View>
      )}
    </GradientPanel>
  );
}

function InstantCallToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const { t, r } = useFDTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      style={[styles.toggle, { borderRadius: r(12), backgroundColor: enabled ? alpha(t.ACCENT, '12') : 'rgba(255,255,255,0.02)', borderColor: enabled ? alpha(t.ACCENT, '40') : t.BORDER_STRONG }]}
    >
      <View style={[styles.track, { borderRadius: r(999), justifyContent: enabled ? 'flex-end' : 'flex-start', backgroundColor: enabled ? t.ACCENT : 'rgba(255,255,255,0.12)' }]}>
        <View style={[styles.thumb, { borderRadius: r(999), backgroundColor: enabled ? '#1a1205' : t.SUBTLE }]} />
      </View>
      <Text style={[font(14, '600'), { color: t.TITLE }]}>Allow instant 1:1 calls</Text>
      <Text style={[font(12), styles.remaining, { color: enabled ? t.ACCENT : t.MUTED }]}>{enabled ? 'On' : 'Off'}</Text>
    </Pressable>
  );
}

function useInstantCallSetting() {
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState('');
  const [interval, setIntervalMinutes] = useState(DEFAULT_INTERVAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((data: InstantCallSetting) => {
    setEnabled(data.enabled);
    setRate(data.rateCredits === null ? '' : String(data.rateCredits));
    setIntervalMinutes(data.intervalMinutes || DEFAULT_INTERVAL);
  }, []);

  useEffect(() => {
    fetchInstantCallSetting()
      .then((data) => { if (data) apply(data); })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load your instant-call settings.'))
      .finally(() => setLoading(false));
  }, [apply]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await saveInstantCallSetting({ enabled, rateCredits: rate.trim() === '' ? null : Number(rate), intervalMinutes: interval });
      if (data) apply(data);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [apply, enabled, interval, rate]);

  const edit = { setEnabled, setRate, setIntervalMinutes, setSaved };
  return { enabled, rate, interval, loading, saving, error, saved, save, edit };
}

export function InstantCallSettings() {
  const { t } = useFDTheme();
  const input = useInputStyle();
  const s = useInstantCallSetting();
  const field = [input, styles.inputBorder];
  return (
    <GradientPanel>
      {/* "send" where the web says "pay": credits are not money (CLAUDE.md). */}
      <PanelTitle icon={PhoneCall} title="Instant connection" text="Turn this on to let other members ring you for a live 1:1 call right now. They send the rate you set for each block of time. You can turn it off anytime." />
      {s.error ? <ErrorBanner text={s.error} style={styles.mb12} /> : null}
      {s.loading ? (
        <Text style={[font(14), styles.loading, { color: t.MUTED }]}>Loading…</Text>
      ) : (
        <View style={styles.gap14}>
          <InstantCallToggle enabled={s.enabled} onToggle={() => { s.edit.setEnabled((v) => !v); s.edit.setSaved(false); }} />
          {s.enabled ? (
            <View style={styles.gap14}>
              <View style={styles.gap6}>
                <Text style={[font(13, '600'), styles.label]}>Credits per {s.interval} minutes</Text>
                <TextInput value={s.rate} onChangeText={(v) => { s.edit.setRate(v); s.edit.setSaved(false); }} keyboardType="number-pad" placeholder="e.g. 5" placeholderTextColor={t.MUTED} style={field} />
              </View>
              <View style={styles.gap6}>
                <Text style={[font(13, '600'), styles.label]}>Block length (minutes)</Text>
                <TextInput
                  value={String(s.interval)}
                  onChangeText={(v) => { s.edit.setIntervalMinutes(Number(v)); s.edit.setSaved(false); }}
                  keyboardType="number-pad"
                  style={field}
                />
              </View>
              <FoundationCallAlerts />
            </View>
          ) : null}
          <SaveRow saving={s.saving} saved={s.saved} disabled={s.saving} onSave={() => void s.save()} />
        </View>
      )}
    </GradientPanel>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  loading: { paddingVertical: 16 },
  gap6: { gap: 6 },
  gap10: { gap: 10 },
  gap14: { gap: 14 },
  label: { color: '#D1D5DB' },
  input: { paddingVertical: 10, paddingHorizontal: 12 },
  inputBorder: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  textarea: { borderWidth: 1, minHeight: 84, textAlignVertical: 'top' },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  remaining: { marginLeft: 'auto' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1 },
  track: { width: 40, height: 22, padding: 2, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 18, height: 18 },
});
