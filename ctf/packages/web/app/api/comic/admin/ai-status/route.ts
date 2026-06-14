import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { pingRasa } from 'lib/comic/rasa';
import { pingOllama } from 'lib/chatbot/ollama';
import { reportError } from 'lib/observability/report';

export const dynamic = 'force-dynamic';

// Admin-only live status of the two AI backends the AI Assistant depends on. Read-only: it pings
// Rasa (intent labelling) and Ollama (answer drafting) and reports configured / reachable / latency
// so the owner can see at a glance, from the @comic admin page, whether each is working.
export async function GET() {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const [rasa, ollama] = await Promise.all([pingRasa(), pingOllama()]);
    return NextResponse.json({ ok: true, rasa, ollama }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'ai_status' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to read AI service status.' },
      { status: 503 },
    );
  }
}
