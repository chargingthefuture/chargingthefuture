import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import type { PropertyCreateInput } from './types';

const COLOR = '#60A5FA';
const SURFACE = 'rgba(255,255,255,0.02)';
const BORDER = `${COLOR}20`;
const MUTED = '#9CA3AF';

// Currency code for ServiceCredits — mirrors SERVICE_CREDITS_CODE in
// ctf/packages/web/lib/currency/types.ts.
const SERVICE_CREDITS_CODE = 'SC';

type HostForm = {
  title: string;
  description: string;
  propertyType: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  bedrooms: string;
  bathrooms: string;
  monthlyRent: string;
  rentCurrency: string;
  acceptedCurrencies: string[];
  availableFromIso: string;
  amenities: string;
  houseRules: string;
  airbnbProfileUrl: string;
};

const EMPTY_FORM: HostForm = {
  title: '',
  description: '',
  propertyType: '',
  addressLine: '',
  city: '',
  state: '',
  country: '',
  zipCode: '',
  bedrooms: '',
  bathrooms: '',
  monthlyRent: '',
  rentCurrency: 'USD',
  acceptedCurrencies: [],
  availableFromIso: '',
  amenities: '',
  houseRules: '',
  airbnbProfileUrl: '',
};

function toNumberOrNull(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function toListOrNull(value: string): string[] | null {
  const list = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

function toInputPayload(form: HostForm): PropertyCreateInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    propertyType: form.propertyType.trim() || null,
    addressLine: form.addressLine.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    country: form.country.trim() || null,
    zipCode: form.zipCode.trim() || null,
    bedrooms: toNumberOrNull(form.bedrooms),
    bathrooms: toNumberOrNull(form.bathrooms),
    monthlyRent: toNumberOrNull(form.monthlyRent),
    rentCurrency: form.rentCurrency.trim() || 'USD',
    acceptedCurrencies: form.acceptedCurrencies.length > 0 ? form.acceptedCurrencies : null,
    availableFromIso: form.availableFromIso.trim() || null,
    amenities: toListOrNull(form.amenities),
    houseRules: toListOrNull(form.houseRules),
    airbnbProfileUrl: form.airbnbProfileUrl.trim() || null,
  };
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (_value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, placeholder, keyboardType, multiline }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.textarea]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#4B5563"
      keyboardType={keyboardType ?? 'default'}
      multiline={multiline}
      autoCapitalize="sentences"
    />
  </View>
);

interface Props {
  submitting: boolean;
  error: string | null;
  onSubmit: (_input: PropertyCreateInput) => void;
}

export const LighthouseHostForm: React.FC<Props> = ({ submitting, error, onSubmit }) => {
  const [form, setForm] = useState<HostForm>(EMPTY_FORM);

  const setField = (key: Exclude<keyof HostForm, 'acceptedCurrencies'>, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleServiceCredits = () => {
    setForm((prev) => ({
      ...prev,
      acceptedCurrencies: prev.acceptedCurrencies.includes(SERVICE_CREDITS_CODE)
        ? prev.acceptedCurrencies.filter((code) => code !== SERVICE_CREDITS_CODE)
        : [...prev.acceptedCurrencies, SERVICE_CREDITS_CODE],
    }));
  };

  const acceptsServiceCredits = form.acceptedCurrencies.includes(SERVICE_CREDITS_CODE);

  const handleSubmit = () => {
    onSubmit(toInputPayload(form));
  };

  return (
    <View style={styles.card}>
      <Field label="Title *" value={form.title} onChange={(v) => setField('title', v)} placeholder="Quiet 1-bed near transit" />
      <Field label="Type" value={form.propertyType} onChange={(v) => setField('propertyType', v)} placeholder="Apartment, room, house…" />
      <Field
        label="Description *"
        value={form.description}
        onChange={(v) => setField('description', v)}
        placeholder="Describe the place, the neighborhood, who it suits…"
        multiline
      />
      <Field label="Address" value={form.addressLine} onChange={(v) => setField('addressLine', v)} />
      <Field label="City" value={form.city} onChange={(v) => setField('city', v)} />
      <Field label="State / region" value={form.state} onChange={(v) => setField('state', v)} />
      <Field label="Country" value={form.country} onChange={(v) => setField('country', v)} />
      <Field label="Postal code" value={form.zipCode} onChange={(v) => setField('zipCode', v)} />
      <Field label="Bedrooms" value={form.bedrooms} onChange={(v) => setField('bedrooms', v)} keyboardType="numeric" />
      <Field label="Bathrooms" value={form.bathrooms} onChange={(v) => setField('bathrooms', v)} keyboardType="numeric" />
      <Field
        label="Monthly rent"
        value={form.monthlyRent}
        onChange={(v) => setField('monthlyRent', v)}
        placeholder="0 for ServiceCredits / free"
        keyboardType="numeric"
      />
      <Field
        label="Rent currency"
        value={form.rentCurrency}
        onChange={(v) => setField('rentCurrency', v)}
        placeholder="USD"
      />
      <View style={styles.field}>
        <Text style={styles.label}>Accepted currencies</Text>
        <TouchableOpacity
          style={[styles.toggle, acceptsServiceCredits && styles.toggleOn]}
          onPress={toggleServiceCredits}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleText, acceptsServiceCredits && styles.toggleTextOn]}>
            {acceptsServiceCredits ? '✓ ' : ''}Accept ServiceCredits
          </Text>
        </TouchableOpacity>
      </View>
      <Field
        label="Available from"
        value={form.availableFromIso}
        onChange={(v) => setField('availableFromIso', v)}
        placeholder="YYYY-MM-DD"
      />
      <Field label="Amenities (comma separated)" value={form.amenities} onChange={(v) => setField('amenities', v)} />
      <Field label="House rules (comma separated)" value={form.houseRules} onChange={(v) => setField('houseRules', v)} />
      <Field label="Listing URL (optional)" value={form.airbnbProfileUrl} onChange={(v) => setField('airbnbProfileUrl', v)} placeholder="https://…" />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        <Text style={styles.submitBtnText}>{submitting ? 'Publishing…' : 'Publish listing'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 16,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#F9FAFB',
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  toggle: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  toggleOn: {
    backgroundColor: `${COLOR}14`,
    borderColor: `${COLOR}40`,
  },
  toggleText: {
    fontSize: 13,
    color: '#F9FAFB',
    fontWeight: '600',
  },
  toggleTextOn: {
    color: COLOR,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 4,
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: COLOR,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B0B0F',
  },
});
