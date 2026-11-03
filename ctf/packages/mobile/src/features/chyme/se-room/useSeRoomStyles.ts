// The live room's styles and colors, from the 3.1 room screen that provides them.

import { useMemo } from 'react';
import { seTheme } from '@ctf/shared';
import { useChymeEmbed } from '../chyme-embed';
import { makeSeRoomStyles } from './seRoomStyles';

export function useSeRoomStyles() {
  const embed = useChymeEmbed();
  const t = embed?.t ?? seTheme();
  const s = useMemo(() => makeSeRoomStyles(t), [t]);
  return { t, s };
}
