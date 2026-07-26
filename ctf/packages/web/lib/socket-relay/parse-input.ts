import type { SocketRelayRequestInput } from './types';

// Shared request-body parsing for the create (`POST /requests`) and update (`PUT /requests/:id`)
// routes. Kept in one place so the two paths cannot drift apart (they parsed identical fields in two
// copies before).

// Only a real number or a non-empty numeric string becomes an amount; booleans, arrays, objects, and
// `null`/`undefined` never coerce to a price (so e.g. `true` is not read as 1).
export function parsePriceAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

// Older clients send a single `category` string; newer ones send a `tags` array (1-3).
export function parseTags(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.tags)) {
    return body.tags.filter((tag): tag is string => typeof tag === 'string');
  }
  return typeof body.category === 'string' && body.category.trim() ? [body.category] : [];
}

export function parseRequestInput(body: Record<string, unknown>): SocketRelayRequestInput {
  // Value type (issue #420): a non-empty currency code names how the request is settled; an absent/blank
  // code means none was chosen. Amount is only kept as a positive finite number; anything else is null
  // (so amount-less types like Free/Barter carry no amount).
  const priceCurrency =
    typeof body.priceCurrency === 'string' && body.priceCurrency.trim().length > 0
      ? body.priceCurrency.trim()
      : null;
  const priceAmount = parsePriceAmount(body.priceAmount);
  return {
    title: typeof body.title === 'string' ? body.title : '',
    details: typeof body.details === 'string' ? body.details : '',
    tags: parseTags(body),
    city: typeof body.city === 'string' ? body.city : null,
    state: typeof body.state === 'string' ? body.state : null,
    country: typeof body.country === 'string' ? body.country : null,
    isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : false,
    priceCurrency,
    priceAmount,
  };
}
