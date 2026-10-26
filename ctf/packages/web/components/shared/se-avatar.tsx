import { SE_AVATAR_VIEWBOX, seAvatar } from '@ctf/shared';

// A member's generated picture: a pattern from a hash of their account id (see
// packages/shared/src/design/se-avatar.ts). Decorative, so screen readers skip it; the handle
// beside it carries the name.
export function SeAvatar({ accountId, size = 40, className }: { accountId: string; size?: number; className?: string }) {
  const { bg, fg, d, rotate } = seAvatar(accountId);
  const half = SE_AVATAR_VIEWBOX / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${SE_AVATAR_VIEWBOX} ${SE_AVATAR_VIEWBOX}`}
      aria-hidden="true"
      className={className}
      style={{ borderRadius: '50%', display: 'block' }}
    >
      <rect width={SE_AVATAR_VIEWBOX} height={SE_AVATAR_VIEWBOX} fill={bg} />
      <path d={d} fill={fg} transform={`rotate(${rotate} ${half} ${half})`} />
    </svg>
  );
}
