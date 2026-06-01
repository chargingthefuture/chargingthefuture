import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { exportComicTrainingExamples } from 'lib/comic/repository';
import { reportError } from 'lib/observability/report';

function escapeRasaExample(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&').replace(/\n/g, ' ').trim();
}

function buildRasaNluYaml(grouped: Record<string, string[]>): string {
  const lines: string[] = ['version: "3.1"', 'nlu:'];

  for (const intent of Object.keys(grouped).sort()) {
    const examples = grouped[intent];
    if (examples.length === 0) {
      continue;
    }

    lines.push(`- intent: ${intent}`);
    lines.push('  examples: |');
    for (const example of examples) {
      lines.push(`    - ${escapeRasaExample(example)}`);
    }
  }

  return lines.join('\n') + '\n';
}

export async function GET(request: Request) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'yaml';

  try {
    const grouped = await exportComicTrainingExamples();
    const totalExamples = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

    if (format === 'json') {
      return NextResponse.json({ ok: true, totalExamples, byIntent: grouped }, { status: 200 });
    }

    const yaml = buildRasaNluYaml(grouped);
    return new Response(yaml, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="comic-nlu-${new Date().toISOString().slice(0, 10)}.yml"`,
        'X-Total-Examples': String(totalExamples),
      },
    });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'get_export_training', extra: { userId: gate.auth.userId } });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to export training examples.' },
      { status: 503 },
    );
  }
}
