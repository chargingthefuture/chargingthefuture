import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MAX_TAGS_PER_POST } from './tags';

const COLOR = '#FB923C';

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
  const [input, setInput] = useState('');
  const full = tags.length >= MAX_TAGS_PER_POST;

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, ' ');
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
        placeholderTextColor="#4B5563"
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

const styles = StyleSheet.create({
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
    backgroundColor: `${COLOR}15`,
    borderWidth: 1,
    borderColor: `${COLOR}30`,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: COLOR },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#E8EAF0',
  },
  suggestLabel: { fontSize: 11, color: '#6B7280' },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestChipText: { fontSize: 12, color: '#9CA3AF' },
});
