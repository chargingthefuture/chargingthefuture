import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { useAuth } from '../../auth/auth-context';
import { fetchProperties } from './api';
import type { LighthouseProperty } from './types';
import { fetchCurrencies } from '../currency/api';
import { buildCurrencyMap, type CurrencyMap } from './currency';
import { LighthouseLoadingState } from './LighthouseLoadingState';
import { LighthouseEmptyState } from './LighthouseEmptyState';
import { LighthousePropertyCard } from './LighthousePropertyCard';
import { LighthousePropertyDetail } from './LighthousePropertyDetail';
import { LighthouseListHeader } from './LighthouseListHeader';

export const LighthouseScreen: React.FC<{ onNavigateToProfile?: () => void }> = ({ onNavigateToProfile }) => {
  const { tokens } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<LighthouseProperty[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyMap>({});
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    // Best-effort currency catalog so rent renders in its own currency; the list still shows
    // without it (formatRentParts falls back to a plain "$" prefix).
    fetchCurrencies()
      .then((rows) => {
        if (mounted) setCurrencies(buildCurrencyMap(rows));
      })
      .catch(() => undefined);
    fetchProperties(1, 20)
      .then((res) => {
        if (!mounted) return;
        setProperties(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        if (!mounted) return;
        setProperties([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
  }, []);

  if (loading) {
    return <LighthouseLoadingState />;
  }

  if (selectedId) {
    const property = properties.find((p) => p.id === selectedId);
    if (property) {
      return (
        <LighthousePropertyDetail
          property={property}
          currencies={currencies}
          onBack={handleBack}
          currentUserId={user?.id ?? null}
          onNeedsProfile={onNavigateToProfile}
        />
      );
    }
  }

  if (properties.length === 0) {
    return <LighthouseEmptyState />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<LighthouseListHeader total={total} />}
        renderItem={({ item }) => (
          <LighthousePropertyCard property={item} currencies={currencies} onPress={handleSelect} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    list: {
      paddingBottom: 24,
    },
  });
}
