// A blog story's title on a Today card, signed in and signed out alike, the Android copy of the web's
// story-title-link.tsx: a link to the post on the blog, named by the post's title.

import React from 'react';
import { Text, TouchableOpacity, type StyleProp, type TextStyle } from 'react-native';

export function StoryTitleLink({ href, title, style, onOpenLink }: { href: string; title: string; style: StyleProp<TextStyle>; onOpenLink: (_href: string) => void }) {
  return (
    <TouchableOpacity accessibilityRole="link" accessibilityLabel={title} onPress={() => onOpenLink(href)} style={{ alignSelf: 'flex-start' }}>
      <Text style={style}>{title}</Text>
    </TouchableOpacity>
  );
}
