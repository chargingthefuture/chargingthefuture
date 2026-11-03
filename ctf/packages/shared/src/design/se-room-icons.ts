// The live room's icons, from the approved boards "Live room" and "Room bar while browsing", as
// path data on a 24 x 24 square, so web and Android draw the same lines. Each is stroked, round
// capped, with no fill, except `more`, which is three filled dots.

export const SE_ROOM_ICONS = {
  back: ['M15 5l-7 7 7 7'],
  bringIn: ['M2.5 20c.8-3.5 3.4-5 6.5-5s5.7 1.5 6.5 5M19 8v6M16 11h6'],
  hand: ['M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 6 17l-1.8-3.4a1.4 1.4 0 0 1 2.3-1.5L8 14'],
  micOff: ['M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.4 2.3M12 18v3M3 3l18 18'],
  micOn: ['M5 11a7 7 0 0 0 14 0M12 18v3'],
  close: ['M6 6l12 12M18 6L6 18'],
};

// The pieces that are shapes rather than lines: the head on `bringIn`, the microphone's body, and
// the three dots on More.
export const SE_ROOM_ICON_SHAPES = {
  bringInHead: { cx: 9, cy: 8, r: 3.5 },
  micBody: { x: 9, y: 3, width: 6, height: 11, rx: 3 },
  moreDots: [5, 12, 19].map((cx) => ({ cx, cy: 12, r: 1.8 })),
};

export type SeRoomIconName = keyof typeof SE_ROOM_ICONS | 'more';
