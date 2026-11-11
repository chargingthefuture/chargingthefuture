// The approved 3.1 board "Share picture", the Android copy of the web's goal-share-sheet.tsx: Close,
// the picture that will be saved, Save picture and Copy as text. Save picture writes the PNG to the
// app's cache and opens the phone's share sheet, where it can be saved to the phone or sent; the
// app asks for no access to the photo library.

import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { SE_GOAL_SHARE_LINK, SE_GOAL_SHARE_WORDS as W, SE_SHARE_PICTURE_WIDTH, seGoalSharePicture, seGoalShareText, seTheme, type SeGoalShare, type SeThemeTokens } from '@ctf/shared';
import { reportError } from '../../../observability/report';
import { SE_FONT } from '../fonts';
import { useSeTheme } from '../useSeTheme';
import { GoalSharePicture } from './GoalSharePicture';
import { qrFor } from './goalShareQr';

export type GoalShareSharer = { handle: string; accountId: string } | null;

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' | 'error'; text: string };

function pngOf(svg: Svg, width: number, height: number): Promise<string> {
  return new Promise((resolve) => svg.toDataURL(resolve, { width: width * 3, height: height * 3 }));
}

async function sharePicture(svg: Svg, width: number, height: number): Promise<void> {
  const base64 = await pngOf(svg, width, height);
  const file = new File(Paths.cache, 'goal-share.png');
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: W.save });
}

function useShareActions(share: SeGoalShare, svg: React.RefObject<Svg | null>, size: { width: number; height: number }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const save = async () => {
    if (!svg.current) return;
    setStatus({ kind: 'busy' });
    try {
      await sharePicture(svg.current, size.width, size.height);
      setStatus({ kind: 'idle' });
    } catch (error) {
      reportError(error, { area: 'goal-share', op: 'save_picture' });
      setStatus({ kind: 'error', text: W.saveFailed });
    }
  };
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(seGoalShareText(share));
      setStatus({ kind: 'done', text: W.copied });
    } catch (error) {
      reportError(error, { area: 'goal-share', op: 'copy_text' });
      setStatus({ kind: 'error', text: W.copyFailed });
    }
  };
  return { status, save, copy };
}

export function GoalShareSheet({ share, sharer, onClose }: { share: SeGoalShare; sharer: GoalShareSharer; onClose: () => void }) {
  const { theme } = useSeTheme();
  const t = seTheme(theme.color, theme.mode);
  const s = makeStyles(t);
  const svg = useRef<Svg | null>(null);
  const { width: screen } = useWindowDimensions();
  const picture = useMemo(() => seGoalSharePicture(share, sharer, t, qrFor(SE_GOAL_SHARE_LINK)), [share, sharer, t]);
  const actions = useShareActions(share, svg, picture);
  const { status } = actions;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable accessibilityLabel={W.close} style={{ height: 40 }} onPress={onClose} />
        <View style={s.sheet} accessibilityViewIsModal accessibilityLabel={W.title}>
          <ScrollView contentContainerStyle={s.content}>
            <View style={s.head}>
              <Text accessibilityRole="header" style={s.title}>
                {W.title}
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={W.close} style={s.round} onPress={onClose}>
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={t.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
                </Svg>
              </TouchableOpacity>
            </View>
            <View accessibilityLabel={W.picture} style={s.figure}>
              <GoalSharePicture ref={svg} picture={picture} width={Math.min(screen - 32, SE_SHARE_PICTURE_WIDTH)} label={`${W.picture}: ${share.title}`} />
            </View>
          </ScrollView>
          <View style={s.foot}>
            {status.kind === 'done' || status.kind === 'error' ? (
              <Text accessibilityLiveRegion="polite" style={s.hint}>
                {status.text}
              </Text>
            ) : null}
            <TouchableOpacity accessibilityRole="button" disabled={status.kind === 'busy'} style={[s.primary, status.kind === 'busy' ? s.disabled : null]} onPress={() => void actions.save()}>
              <Text style={s.primaryLabel}>{status.kind === 'busy' ? W.saving : W.save}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={s.secondary} onPress={() => void actions.copy()}>
              <Text style={s.secondaryLabel}>{W.copy}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { flex: 1, backgroundColor: t.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1.5, borderColor: t.line },
    content: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 22, color: t.ink, fontFamily: SE_FONT.serif },
    round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    figure: { alignItems: 'center' },
    foot: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 8, gap: 14 },
    hint: { fontSize: 14, color: t.soft, textAlign: 'center', fontFamily: SE_FONT.sans },
    primary: { minHeight: 52, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center', boxShadow: `0px 4px 0px ${t.line}` },
    disabled: { opacity: 0.6 },
    primaryLabel: { fontSize: 16, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    secondary: { minHeight: 48, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', boxShadow: `0px 2px 0px ${t.line}` },
    secondaryLabel: { fontSize: 15, color: t.ink, fontFamily: SE_FONT.sansSemi },
  });
}
