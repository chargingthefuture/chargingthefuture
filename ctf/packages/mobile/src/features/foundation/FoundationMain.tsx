// The Browse / Offer / Quotes screen, copied from the web FoundationMainScreen (foundation-shell.tsx):
// the header block with the tab bar and, on Browse, the search box, then the active tab's panel. The
// web header's title row, with its Admin pill and refresh button, is the app's screen header above this.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import type { ProviderView, QuoteView } from './FoundationDataApi';
import type { QuoteTransitionResult } from './useFoundationData';
import { BrowsePanel } from './FoundationBrowse';
import { OfferSkillsPanel } from './FoundationOffer';
import { QuotesPanel } from './FoundationQuotes';
import { alpha, font, useFDTheme } from './useFDTheme';

export type FoundationTab = 'browse' | 'quotes' | 'offer';

const TABS: { key: FoundationTab; label: string }[] = [
  { key: 'browse', label: 'Browse' },
  { key: 'offer', label: 'Offer' },
  { key: 'quotes', label: 'Quotes' },
];

export type FoundationMainProps = {
  tab: FoundationTab;
  onTabChange: (_tab: FoundationTab) => void;
  query: string;
  onQueryChange: (_query: string) => void;
  providers: ProviderView[];
  viewerUserId: string | null;
  onSelectProvider: (_provider: ProviderView) => void;
  skillId: string | null;
  skillName: string | null;
  onSkillFilter: (_skillId: string | null, _skillName?: string | null) => void;
  searchActive: boolean;
  quotes: QuoteView[];
  onOpenDirectLine: (_quote: QuoteView) => void;
  onRespond: (_quote: QuoteView, _amount: number, _currency: string) => Promise<QuoteTransitionResult>;
  onClose: (_quote: QuoteView) => Promise<QuoteTransitionResult>;
};

function Header({ tab, onTabChange, query, onQueryChange }: Pick<FoundationMainProps, 'tab' | 'onTabChange' | 'query' | 'onQueryChange'>) {
  const { t, r } = useFDTheme();
  return (
    <View style={[styles.header, { backgroundColor: t.HEADER, borderBottomColor: t.BORDER }]}>
      <View style={styles.tabs}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => onTabChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.tab,
                {
                  borderRadius: r(8),
                  backgroundColor: active ? alpha(t.ACCENT, '1A') : 'transparent',
                  borderColor: active ? alpha(t.ACCENT, '40') : t.BORDER_STRONG,
                },
              ]}
            >
              <Text style={[font(13, '600'), { color: active ? t.ACCENT : t.SUBTLE }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'browse' ? (
        <View style={styles.searchRow}>
          <View style={styles.searchIcon} pointerEvents="none">
            <Search size={14} color={t.FAINT} />
          </View>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search trade providers…"
            placeholderTextColor={t.FAINT}
            accessibilityLabel="Search trade providers"
            style={[font(13), styles.search, { borderRadius: r(8), backgroundColor: t.INPUT_BG, borderColor: t.BORDER, color: t.SUBTLE }]}
          />
        </View>
      ) : null}
    </View>
  );
}

export function FoundationMain(props: FoundationMainProps) {
  const { tab } = props;
  return (
    <View style={styles.fill}>
      <Header tab={tab} onTabChange={props.onTabChange} query={props.query} onQueryChange={props.onQueryChange} />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'browse' ? (
          <BrowsePanel
            providers={props.providers}
            viewerUserId={props.viewerUserId}
            onSelect={props.onSelectProvider}
            activeSkillId={props.skillId}
            activeSkillName={props.skillName}
            searchActive={props.searchActive}
            onSkillFilter={props.onSkillFilter}
          />
        ) : null}
        {tab === 'offer' ? <OfferSkillsPanel /> : null}
        {tab === 'quotes' ? (
          <QuotesPanel
            quotes={props.quotes}
            viewerUserId={props.viewerUserId}
            onBrowse={() => props.onTabChange('browse')}
            onOpenDirectLine={props.onOpenDirectLine}
            onRespond={props.onRespond}
            onClose={props.onClose}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { borderBottomWidth: 1, paddingTop: 10 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderWidth: 1 },
  searchRow: { paddingHorizontal: 12, paddingBottom: 10, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 22, top: 0, bottom: 10, justifyContent: 'center', zIndex: 1 },
  search: { paddingVertical: 8, paddingLeft: 30, paddingRight: 10, borderWidth: 1 },
  body: { padding: 24 },
});
