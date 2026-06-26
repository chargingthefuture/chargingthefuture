// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socketrelay/currency.
import { authedFetchJson, getApiBaseUrl } from '../../auth/authedFetch';

export type WhatWorksProduct = {
  id: string;
  emoji: string;
  name: string;
  kind: string;
  note: string;
  purchaseUrl: string;
  verifiedCount: number;
  viewerHasEndorsed: boolean;
};

export type WhatWorksProblem = {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  context: string;
  products: WhatWorksProduct[];
};

export type WhatWorksStats = { problems: number; verifiedTools: number; survivorsHelped: number };

export type WhatWorksProblemOption = { id: string; slug: string; emoji: string; title: string; context: string };

export async function fetchList(): Promise<{ problems: WhatWorksProblem[]; stats: WhatWorksStats }> {
  return authedFetchJson<{ problems: WhatWorksProblem[]; stats: WhatWorksStats }>('/api/what-works');
}

// Public, sign-in-free teaser slice — mirrors the web public flow. Uses a plain fetch (no
// bearer token) so a signed-out visitor sees the same readable preview the web shows.
export async function fetchPublicList(): Promise<{ problems: WhatWorksProblem[]; stats: WhatWorksStats }> {
  const response = await fetch(`${getApiBaseUrl()}/api/what-works/public`);
  const payload = (await response.json().catch(() => null)) as
    | { problems?: WhatWorksProblem[]; stats?: WhatWorksStats }
    | null;
  if (!response.ok || !payload) {
    throw new Error(`Network request failed: ${response.status}`);
  }
  return {
    problems: payload.problems ?? [],
    stats: payload.stats ?? { problems: 0, verifiedTools: 0, survivorsHelped: 0 },
  };
}

export async function fetchProblems(): Promise<{ problems: WhatWorksProblemOption[] }> {
  return authedFetchJson<{ problems: WhatWorksProblemOption[] }>('/api/what-works/problems');
}

export async function suggestProduct(input: {
  problemId: string;
  name: string;
  purchaseUrl: string;
  note?: string;
}) {
  return authedFetchJson<unknown>('/api/what-works/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ctf-csrf': '1',
    },
    body: JSON.stringify(input),
  });
}

export async function toggleEndorsement(productId: string, endorsed: boolean): Promise<{ verifiedCount: number; viewerHasEndorsed: boolean }> {
  return authedFetchJson<{ verifiedCount: number; viewerHasEndorsed: boolean }>(
    `/api/what-works/products/${productId}/endorse`,
    {
      method: endorsed ? 'DELETE' : 'POST',
      headers: { 'x-ctf-csrf': '1' },
    },
  );
}
