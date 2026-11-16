'use client';

import type { SePerson } from '@ctf/shared';
import type { PersonSheet } from './person-card';
import { ProfileSheet } from './profile-sheet';
import { QuoteSheet } from './quote-sheet';

// Whichever sheet a People row opened: the profile, or Request a quote. A person opened from a shared
// address is filled in from the page shown when they are on it.
export function PersonSheets({ sheet, viewerId, people, onSheet }: { sheet: PersonSheet | null; viewerId: string | null; people: SePerson[]; onSheet: (_next: PersonSheet | null) => void }) {
  if (!sheet) return null;
  const person = people.find((p) => p.id === sheet.person.id) ?? sheet.person;
  const name = person.name || 'this person';
  const close = () => onSheet(null);
  if (sheet.kind === 'quote') return <QuoteSheet profileId={person.id} name={name} onClose={close} />;
  return (
    <ProfileSheet
      profileId={person.id}
      name={name}
      viewerId={viewerId}
      canQuote={person.offering.length > 0}
      onQuote={() => onSheet({ kind: 'quote', person })}
      onClose={close}
    />
  );
}
