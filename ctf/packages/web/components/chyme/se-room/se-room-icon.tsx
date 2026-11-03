import { SE_ROOM_ICONS, SE_ROOM_ICON_SHAPES, type SeRoomIconName } from '@ctf/shared';

// One of the live room's icons (packages/shared/src/design/se-room-icons.ts), in the current text
// color. Decorative: the button around it carries the label.
export function SeRoomIcon({ name, size = 20, strokeWidth = 2 }: { name: SeRoomIconName; size?: number; strokeWidth?: number }) {
  const { bringInHead: head, micBody: body, moreDots } = SE_ROOM_ICON_SHAPES;
  if (name === 'more') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {moreDots.map((dot) => (
          <circle key={dot.cx} cx={dot.cx} cy={dot.cy} r={dot.r} />
        ))}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'bringIn' ? <circle cx={head.cx} cy={head.cy} r={head.r} /> : null}
      {name === 'micOn' || name === 'micOff' ? <rect x={body.x} y={body.y} width={body.width} height={body.height} rx={body.rx} /> : null}
      {SE_ROOM_ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
