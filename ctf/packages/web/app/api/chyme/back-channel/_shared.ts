import { NextResponse } from 'next/server';
import { CHYME_ERROR_CODE, type ChymeErrorCode } from 'lib/chyme/constants';
import { BackChannelError } from 'lib/chyme/back-channel';

// Map a Back Channel repository error to an HTTP status. Kept out of the SQL layer so the repository
// never imports Next. Anything not a BackChannelError is a real fault the route reports as 500.
export function backChannelErrorStatus(code: ChymeErrorCode): number {
  switch (code) {
    case CHYME_ERROR_CODE.invalidPayload:
      return 400;
    case CHYME_ERROR_CODE.backChannelBlocked:
      return 403;
    case CHYME_ERROR_CODE.backChannelNotInRoom:
    case CHYME_ERROR_CODE.backChannelNotFound:
    case CHYME_ERROR_CODE.backChannelInvalidState:
      return 409;
    case CHYME_ERROR_CODE.streamUnavailable:
      return 503;
    default:
      return 500;
  }
}

// Uniform JSON error for a caught BackChannelError; returns null for anything else so the caller can
// fall through to its generic 500 handler.
export function backChannelErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof BackChannelError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: backChannelErrorStatus(error.code) },
    );
  }
  return null;
}

// Read `{ recipientUserId }` or `{ callId }` from a request body without throwing on a bad payload.
export async function readJsonField(request: Request, field: string): Promise<string | null> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const value = body?.[field];
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
