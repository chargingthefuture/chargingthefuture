import { SE_AVATAR_VIEWBOX, seAvatar, type SeAvatarStroke } from '@ctf/shared';

// A member's generated picture: a small landscape or cut paper drawn from a hash of their account
// id (see packages/shared/src/design/se-avatar.ts). Decorative, so screen readers skip it; the
// handle beside it carries the name.
function strokeProps(stroke: SeAvatarStroke | null) {
  return stroke
    ? { stroke: stroke.stroke, strokeWidth: stroke.strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
    : {};
}

export function SeAvatar({ accountId, size = 40, className }: { accountId: string; size?: number; className?: string }) {
  const v = SE_AVATAR_VIEWBOX;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${v} ${v}`}
      aria-hidden="true"
      className={className}
      style={{ borderRadius: '50%', display: 'block' }}
    >
      {seAvatar(accountId).shapes.map((s, i) => {
        if (s.type === 'rect') return <rect key={i} width={v} height={v} fill={s.fill} />;
        if (s.type === 'circle') return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? 'none'} {...strokeProps(s.stroke)} />;
        return <path key={i} d={s.d} fill={s.fill ?? 'none'} opacity={s.opacity} {...strokeProps(s.stroke)} />;
      })}
    </svg>
  );
}
