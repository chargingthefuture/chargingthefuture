import type { WhatWorksProductStatus } from 'lib/whatworks/types';

export type AdminProduct = {
  id: string;
  problemId: string;
  problemTitle: string;
  emoji: string;
  name: string;
  kind: string;
  note: string;
  purchaseUrl: string;
  status: WhatWorksProductStatus;
  verifiedCount: number;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type AdminProblem = {
  id: string;
  slug: string;
  emoji: string;
  title: string;
  context: string;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  productCount: number;
  approvedCount: number;
  pendingCount: number;
};

export type AdminMutationResult = { ok: boolean; message?: string };

// All admin mutations carry the CSRF confirmation header the API requires.
export async function adminMutate(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<AdminMutationResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // WhatWorks errors carry `message`; auth-gate denials (deny-taxonomy) carry `reason`/`code`
    // instead, so fall back through those to a usable message rather than a generic string.
    const data = (await res.json().catch(() => null)) as
      | { message?: string; reason?: string; code?: string }
      | null;
    if (res.ok) {
      return { ok: true };
    }
    return { ok: false, message: data?.message ?? data?.reason ?? data?.code ?? `Request failed (${res.status}).` };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}
