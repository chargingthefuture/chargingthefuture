import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { Currency } from './types';
import { SERVICE_CREDITS_LABEL } from './types';
import { sortPreferred } from './format';
import { fetchCurrencies } from './api';
import { useTheme, type ThemeTokens } from '../../theme';

// Shared payment-currency selector for the mobile app (issue #420) — the React Native counterpart of
// the web CurrencySelect. One control reused by every value-bearing feature so the options and ordering
// stay identical: ServiceCredits first, then fiat, crypto, and barter, read live from the currencies
// catalog. ServiceCredits always renders by its label, never the bare "SC" code, and a ServiceCredits
// amount is never shown at a fiat equivalent. Rendered as a horizontal row of selectable chips (no extra
// dependency). Barter (requiresAmount=false) appears too; callers use the returned Currency to decide
// whether to show an amount input.

function optionLabel(currency: Currency): string {
  if (currency.isServiceCredits) return SERVICE_CREDITS_LABEL;
  return currency.symbol ? `${currency.label} (${currency.symbol})` : currency.label;
}

export function CurrencySelect({
  value,
  onChange,
  currencies: provided,
}: {
  value: string;
  onChange: (_code: string, _currency: Currency | null) => void;
  currencies?: Currency[];
}) {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [currencies, setCurrencies] = useState<Currency[]>(provided ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (provided) {
      setCurrencies(provided);
      return;
    }
    let active = true;
    fetchCurrencies()
      .then((list) => {
        if (active) setCurrencies(list);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load currencies');
      });
    return () => {
      active = false;
    };
  }, [provided]);

  const sorted = sortPreferred(currencies);

  if (sorted.length === 0) {
    return <Text style={styles.placeholder}>{error ? 'Currencies unavailable' : 'Loading…'}</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {sorted.map((currency) => {
        const selected = currency.code === value;
        return (
          <TouchableOpacity
            key={currency.code}
            onPress={() => onChange(currency.code, currency)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{optionLabel(currency)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    row: {
      gap: 8,
      paddingVertical: 4,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    chipSelected: {
      borderColor: '#22C55E',
      backgroundColor: 'rgba(34,197,94,0.15)',
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: t.textShell,
    },
    chipTextSelected: {
      color: '#FFFFFF',
    },
    placeholder: {
      fontSize: 13,
      color: t.textSecondary,
      paddingVertical: 8,
    },
  });
}
