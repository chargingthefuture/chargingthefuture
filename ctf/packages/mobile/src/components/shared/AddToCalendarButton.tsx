// Add to calendar on Android, the copy of the web's add-to-calendar.tsx: writes the same .ics file
// (seCalendarIcs in @ctf/shared) to the app's cache and hands it to the phone's share sheet, where
// the calendar app takes it. The app never reads a calendar.

import React, { useState } from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CalendarPlus } from 'lucide-react-native';
import { seCalendarFileName, seCalendarIcs, type SeCalendarEvent } from '@ctf/shared';
import { getApiBaseUrl } from '../../auth/authedFetch';

async function share(event: SeCalendarEvent): Promise<void> {
  const url = event.url && !event.url.startsWith('http') ? `${getApiBaseUrl()}${event.url}` : event.url;
  const file = new File(Paths.cache, seCalendarFileName(event.title));
  if (file.exists) file.delete();
  file.create();
  file.write(seCalendarIcs({ ...event, url }));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', dialogTitle: 'Add to calendar' });
}

export function AddToCalendarButton({ event, color, borderColor, style }: { event: SeCalendarEvent; color: string; borderColor: string; style?: StyleProp<ViewStyle> }) {
  const [problem, setProblem] = useState<string | null>(null);
  const press = () => {
    share(event)
      .then(() => setProblem(null))
      .catch((error: unknown) => setProblem(`Could not open the calendar: ${error instanceof Error ? error.message : String(error)}`));
  };
  return (
    <View style={style}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={press}
        style={{ alignSelf: 'flex-start', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor }}
      >
        <CalendarPlus size={13} color={color} />
        <Text style={{ color, fontSize: 12, fontWeight: '600' }}>Add to calendar</Text>
      </TouchableOpacity>
      {problem ? <Text style={{ color, fontSize: 12, marginTop: 4 }}>{problem}</Text> : null}
    </View>
  );
}
