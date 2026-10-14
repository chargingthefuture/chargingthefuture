import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

// A JSON answer that a polling screen can revalidate instead of re-downloading.
//
// The response carries an ETag (a fingerprint of the body) and `Cache-Control: private, no-cache`, so
// the browser keeps its copy but asks every time. When the next poll sends that fingerprint back in
// If-None-Match and the body has not changed, the answer is a bodiless 304 and the browser hands the
// kept copy to fetch() as an ordinary 200. The screen code sees no difference; ctf-web sends a few
// hundred bytes of headers instead of the full list. `private` keeps the copy out of any shared cache,
// so one member's answer is never served to another.
//
// The caller's fetch must use `cache: 'no-cache'` (not `no-store`), or the browser never sends the
// fingerprint back.
export function jsonWithEtag(request: Request, body: unknown): NextResponse {
  const json = JSON.stringify(body);
  const etag = `W/"${createHash('sha1').update(json).digest('base64url')}"`;
  const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' };
  if (etagMatches(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(json, { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
}

// Weak comparison, as If-None-Match requires: a proxy that compresses the body may turn a tag into
// its W/ form, so the prefix is ignored on both sides.
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const opaque = (tag: string) => tag.trim().replace(/^W\//, '');
  const target = opaque(etag);
  return ifNoneMatch.split(',').some((candidate) => candidate.trim() === '*' || opaque(candidate) === target);
}
