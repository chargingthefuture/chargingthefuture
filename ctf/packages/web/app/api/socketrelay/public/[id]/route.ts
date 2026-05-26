import { NextResponse } from 'next/server';
import { socketRelayErrorResponse } from 'lib/socketrelay/_lib';
import { SOCKETRELAY_ERROR_CODE } from 'lib/socketrelay/constants';
import { getPublicRequestById } from 'lib/socketrelay/repository';

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { id } = await params;

  try {
    const item = await getPublicRequestById(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, code: SOCKETRELAY_ERROR_CODE.requestNotFound, message: 'SocketRelay request not found.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    return socketRelayErrorResponse(error, 'Public request lookup unavailable.');
  }
}
