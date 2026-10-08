// The Personal data and Always retained lists, copied from the web's MobileDataView
// (components/account-data/account-data-mobile.tsx), without the download buttons (see
// AccountDataView.tsx for why).

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lock, Trash2 } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { getAccountTokens, radius, Spinner, type AccountTokens } from '../account';
import { glyphForService } from './glyphs';
import type { AccountService } from './api';

function countLabel(n: number): string {
  return `${n} ${n === 1 ? 'service' : 'services'}`;
}

export function ServiceLists({
  remaining,
  retained,
  pendingSlug,
  rowError,
  onDeleteService,
}: {
  remaining: AccountService[];
  retained: AccountService[];
  pendingSlug: string | null;
  rowError: { slug: string; message: string } | null;
  onDeleteService: (_service: AccountService) => void;
}) {
  const { tokens } = useTheme();
  const tok = getAccountTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);
  const errorFor = (slug: string) => (rowError?.slug === slug ? rowError.message : null);

  return (
    <>
      <Text style={s.label}>Personal data — {countLabel(remaining.length)}</Text>
      <View style={[s.list, s.listGap]}>
        {remaining.map((service) => {
          const isPending = pendingSlug === service.slug;
          const error = errorFor(service.slug);
          return (
            <View key={service.slug} style={[s.row, error ? s.rowError : null, isPending ? s.rowPending : null]}>
              <View style={s.glyph}>
                <Text style={s.glyphText}>{glyphForService(service.slug)}</Text>
              </View>
              <View style={s.body}>
                <Text style={s.name}>{service.name}</Text>
                <Text style={[s.summary, error ? s.summaryError : null]}>{error ?? service.summary}</Text>
              </View>
              <TouchableOpacity
                onPress={() => onDeleteService(service)}
                disabled={isPending}
                accessibilityRole="button"
                accessibilityLabel={`Delete your ${service.name} data`}
                style={s.deleteBtn}
              >
                {isPending ? <Spinner size={12} color="#EF4444" /> : <Trash2 size={12} color="#EF4444" />}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {retained.length > 0 ? (
        <>
          <Text style={s.label}>Always retained — {countLabel(retained.length)}</Text>
          <View style={s.list}>
            {retained.map((service) => {
              const error = errorFor(service.slug);
              return (
                <View key={service.slug} style={[s.retainedRow, error ? s.rowError : null]}>
                  <View style={s.retainedGlyph}>
                    <Text style={s.glyphText}>{glyphForService(service.slug)}</Text>
                  </View>
                  <View style={s.body}>
                    <View style={s.retainedNameRow}>
                      <Text style={s.retainedName}>{service.name}</Text>
                      <Lock size={10} color="#374151" />
                    </View>
                    <Text style={[s.retainedSummary, error ? s.summaryError : null]}>{error ?? service.summary}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </>
  );
}

function makeStyles(t: ThemeTokens, tok: AccountTokens) {
  return StyleSheet.create({
    label: { fontSize: 12, fontFamily: interFamily('700'), color: tok.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.84, marginBottom: 10 },
    list: { gap: 7 },
    listGap: { marginBottom: 24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius(t, 12), backgroundColor: tok.SURFACE, borderWidth: 1, borderColor: tok.BORDER },
    rowError: { borderColor: 'rgba(239,68,68,0.35)' },
    rowPending: { opacity: 0.7 },
    glyph: { width: 30, height: 30, borderRadius: radius(t, 8), backgroundColor: `${tok.BRAND}10`, borderWidth: 1, borderColor: `${tok.BRAND}20`, alignItems: 'center', justifyContent: 'center' },
    glyphText: { fontSize: 13 },
    body: { flex: 1, minWidth: 0 },
    name: { fontSize: 13, fontFamily: interFamily('600'), color: tok.TEXT },
    summary: { fontSize: 11, lineHeight: 14.3, fontFamily: interFamily('400'), color: '#4B5563', marginTop: 1 },
    summaryError: { color: '#F87171' },
    deleteBtn: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: radius(t, 7), backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    retainedRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius(t, 12), backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 1, borderColor: tok.BORDER },
    retainedGlyph: { width: 30, height: 30, borderRadius: radius(t, 8), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: tok.BORDER, alignItems: 'center', justifyContent: 'center' },
    retainedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    retainedName: { fontSize: 13, fontFamily: interFamily('600'), color: tok.SUBTLE },
    retainedSummary: { fontSize: 11, lineHeight: 15.4, fontFamily: interFamily('400'), color: '#4B5563' },
  });
}
