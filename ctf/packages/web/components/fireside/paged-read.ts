// One page of an admin list from a Fireside route that answers { [key]: T[], page, lastPage, total }.
// A failed answer throws with the route's own message, or with `failText` and the status when the
// body has none (a body that is not JSON, such as a host's error page, falls through to that).
export type FiresidePage<T> = { items: T[]; page: number | null; lastPage: number; total: number };

export async function readFiresidePage<T>(url: string, key: string, failText: string): Promise<FiresidePage<T>> {
  const res = await fetch(url);
  const data = (await res.json().catch(() => null)) as
    | ({ message?: string; page?: number; lastPage?: number; total?: number } & Record<string, unknown>)
    | null;
  if (!res.ok || !data) throw new Error(data?.message ?? `${failText} (${res.status}).`);
  const items = data[key];
  return {
    items: Array.isArray(items) ? (items as T[]) : [],
    page: data.page ?? null,
    lastPage: data.lastPage ?? 1,
    total: data.total ?? 0,
  };
}
