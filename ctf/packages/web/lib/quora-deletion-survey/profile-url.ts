// The profile address a handle stands for. A handle typed as an address is used as is; otherwise
// spaces become the hyphens Quora puts in profile addresses. Kept free of server imports so the
// survey form can build the same address the verification route does.
export function profileUrlForHandle(handle: string): string {
  const trimmed = handle.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const slug = trimmed.replace(/^@/, '').replace(/\s+/g, '-');
  return `https://www.quora.com/profile/${encodeURIComponent(slug)}`;
}
