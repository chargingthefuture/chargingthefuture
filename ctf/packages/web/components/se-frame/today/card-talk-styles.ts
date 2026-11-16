'use client';

import { createContext, useContext } from 'react';
import seStyles from './card-sheet.module.css';

// The class names a card's conversation is drawn with. Today's sheet uses the 3.1 sheet's own; a
// 3.0 plugin page passes the 3.0 set (card-conversation-classic.module.css), so the conversation
// keeps its behavior and words and takes the look of the screen it sits in.
export type CardTalkClasses = { readonly [key: string]: string };

export const CardTalkStylesContext = createContext<CardTalkClasses>(seStyles);

export function useCardTalkStyles(): CardTalkClasses {
  return useContext(CardTalkStylesContext);
}
