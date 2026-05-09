import { NextResponse } from 'next/server';
import { requireFeedAdminAccess } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { exportQuestionsForRasa } from 'lib/feed/repository';
import type { FeedQuestionCategory } from 'lib/feed/types';

function escapeRasaExample(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&').replace(/\n/g, ' ').trim();
}

function buildRasaNluYaml(grouped: Record<FeedQuestionCategory, string[]>): string {
  const categories: FeedQuestionCategory[] = ['housing', 'services', 'safety', 'benefits', 'general'];
  const lines: string[] = ['version: "3.1"', 'nlu:'];

  for (const category of categories) {
    const examples = grouped[category];
    if (examples.length === 0) {
      continue;
    }

    lines.push(`- intent: ${category}`);
    lines.push('  examples: |');
    for (const example of examples) {
      lines.push(`    - ${escapeRasaExample(example)}`);
    }
  }

  return lines.join('\n') + '\n';
}

export async function GET(request: Request) {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'yaml';

  try {
    const grouped = await exportQuestionsForRasa();

    const totalQuestions = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

    if (format === 'json') {
      return NextResponse.json(
        {
          ok: true,
          totalQuestions,
          byCategory: grouped,
        },
        { status: 200 },
      );
    }

    const yaml = buildRasaNluYaml(grouped);
    return new Response(yaml, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="nlu-${new Date().toISOString().slice(0, 10)}.yml"`,
        'X-Total-Questions': String(totalQuestions),
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: 'Unable to export questions.' },
      { status: 503 },
    );
  }
}
