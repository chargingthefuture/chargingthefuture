import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MAX_TAG_LENGTH, MAX_TAGS_PER_POST } from './tags';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

// Tag editor for the post form: type a tag and submit to add it as a chip (up to
// MAX_TAGS_PER_POST), tap a chip to remove it, or tap an in-use suggestion to add it.
export function SocketRelayTagInput({
  tags,
  onChange,
  suggest,
}: {
  tags: string[];
  onChange: (_tags: string[]) => void;
  suggest: (_prefix: string, _exclude: string[]) => string[];
}) {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('socket-relay', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  const [input, setInput] = useState('');
  const full = tags.length >= MAX_TAGS_PER_POST;

  const addTag = (raw: string) => {
    // Truncate to the server's max so a long tag can't be added and then bounce off the API as an
    // invalid payload — the form stays the source of truth for what is submittable.
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
    if (!tag || full) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag]);
    setInput('');
  };

  const suggestions = full ? [] : suggest(input, tags);

  return (
    <View style={styles.wrap}>
      {tags.length > 0 && (
        <View style={styles.chipRow}>
          {tags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.chip}
              onPress={() => onChange(tags.filter((t) => t !== tag))}
            >
              <Text style={styles.chipText}>{tag} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TextInput
        style={styles.input}
        placeholder={
          full
            ? `Up to ${MAX_TAGS_PER_POST} tags per post`
            : 'Tag — type a word and press enter (Food, Mail, anything)'
        }
        placeholderTextColor={tokens.textMuted}
        value={input}
        onChangeText={(text) => {
          if (text.endsWith(',')) {
            addTag(text.slice(0, -1));
          } else {
            setInput(text);
          }
        }}
        onSubmitEditing={() => addTag(input)}
        editable={!full}
        blurOnSubmit={false}
      />
      {suggestions.length > 0 && (
        <View style={styles.chipRow}>
          <Text style={styles.suggestLabel}>In use:</Text>
          {suggestions.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.suggestChip}
              onPress={() => addTag(tag)}
            >
              <Text style={styles.suggestChipText}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
  wrap: { marginBottom: 10 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: `${accent}15`,
    borderWidth: 1,
    borderColor: `${accent}30`,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: accent },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: t.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: t.textShell,
  },
  suggestLabel: { fontSize: 11, color: t.textSecondary },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: t.radius,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestChipText: { fontSize: 12, color: t.textSecondary },
  });
}
