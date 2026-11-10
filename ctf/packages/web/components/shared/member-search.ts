// Finding a member to pick, shared by the Recurring Activity member picker and the ServiceCredits
// Recipient box: both search the Directory (`GET /api/directory/list?q=`, names and usernames) and
// offer only claimed profiles.

// One member the caller can pick as the other party. Only claimed profiles (with a real user id)
// are offered, because a counterparty must resolve to an actual member.
export interface MemberOption {
  userId: string;
  name: string;
}

interface DirectoryListItem {
  id: string;
  firstName: string;
  lastName: string | null;
  claimedByUserId: string | null;
  username?: string | null;
}

// "Ada Lovelace · @ada": the Directory name with the member's username (owner decision, 2026-11-10),
// so the picker can be searched and read either way.
export function memberLabel(item: Pick<DirectoryListItem, 'firstName' | 'lastName' | 'username'>): string {
  const name = [item.firstName, item.lastName].filter(Boolean).join(' ').trim();
  if (item.username) return name ? `${name} · @${item.username}` : `@${item.username}`;
  return name || 'A member';
}

interface DirectoryListResponse {
  items?: DirectoryListItem[];
}

export function mapDirectoryToMembers(payload: DirectoryListResponse): MemberOption[] {
  return (payload.items ?? [])
    .filter((item): item is DirectoryListItem & { claimedByUserId: string } => Boolean(item.claimedByUserId))
    .map((item) => ({
      userId: item.claimedByUserId,
      name: memberLabel(item),
    }));
}
