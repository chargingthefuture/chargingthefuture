import { NextResponse } from 'next/server';
import type { HubMessagesResponse, HubMessage } from 'lib/hub/types';
import { requireHubAccess } from '../_lib';

export async function GET() {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    // TODO: Fetch messages from hub_messages table for the active Hub channel.
    // For now, return empty message list to satisfy type contract.
    const messages: HubMessage[] = [];

    const response: HubMessagesResponse = {
      channelId: 'general', // TODO: Get from active channel
      messages,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to read Hub messages.',
      },
      { status: 503 },
    );
  }
}

type MessageRequestBody = {
  text?: unknown;
};

export async function POST(request: Request) {
  const gate = await requireHubAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  let body: MessageRequestBody;
  try {
    body = (await request.json()) as MessageRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Invalid JSON payload.',
      },
      { status: 400 },
    );
  }

  const text = typeof body.text === 'string' ? body.text : '';
  if (!text || text.trim().length === 0 || text.length > 1000) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Message text must be 1 to 1000 characters after trimming.',
      },
      { status: 400 },
    );
  }

  try {
    // TODO: Save message to hub_messages table.
    // For now, return a synthetic message to satisfy type contract.
    const message: HubMessage = {
      id: 'temp-' + Date.now(),
      userId: gate.identity.userId,
      username: gate.identity.username,
      displayName: gate.identity.displayName,
      avatarUrl: gate.identity.avatarUrl,
      text: text.trim(),
      sentAtIso: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to send message.',
      },
      { status: 503 },
    );
  }
}
