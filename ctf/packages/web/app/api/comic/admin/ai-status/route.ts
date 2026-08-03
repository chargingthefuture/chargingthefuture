import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { pingOllama } from 'lib/chatbot/ollama';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

export const dynamic = 'force-dynamic';

// Admin-only live status of the Ollama answer-drafting backend (a RunPod serverless endpoint or a
// native Ollama host). Read-only: pings it and reports configured / reachable / latency so the
// owner can see at a glance, from the @comic admin page, whether drafting is working.
export async function GET() {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const ollama = await pingOllama();
    return NextResponse.json({ ok: true, ollama }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'ai_status' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: `Unable to read AI service status: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
