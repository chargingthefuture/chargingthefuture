import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { fetchProperties } from './api';
import type { LighthouseProperty } from './types';
import { fetchCurrencies } from '../currency/api';
import { buildCurrencyMap, type CurrencyMap } from './currency';
import { LighthouseLoadingState } from './LighthouseLoadingState';
import { LighthouseEmptyState } from './LighthouseEmptyState';
import { LighthousePropertyCard } from './LighthousePropertyCard';
import { LighthousePropertyDetail } from './LighthousePropertyDetail';
import { LighthouseListHeader } from './LighthouseListHeader';

const BG = '#0F1117';

export const LighthouseScreen: React.FC = () => {
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
      return <LighthousePropertyDetail property={property} currencies={currencies} onBack={handleBack} />;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  list: {
    paddingBottom: 24,
  },
});
