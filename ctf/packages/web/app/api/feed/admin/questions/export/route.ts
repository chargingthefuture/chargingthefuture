import { NextResponse } from 'next/server';
import { requireFeedAdminAccess } from '../../../_lib';
import { FEED_ERROR_CODE } from 'lib/feed/constants';
import { exportQuestionsByCategory } from 'lib/feed/repository';
import type { FeedQuestionCategory } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

function escapeExample(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&').replace(/\n/g, ' ').trim();
}

function buildCategoryYaml(grouped: Record<FeedQuestionCategory, string[]>): string {
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
      lines.push(`    - ${escapeExample(example)}`);
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
    const grouped = await exportQuestionsByCategory();

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

    const yaml = buildCategoryYaml(grouped);
    return new Response(yaml, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="nlu-${new Date().toISOString().slice(0, 10)}.yml"`,
        'X-Total-Questions': String(totalQuestions),
      },
    });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_questions_export' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: `Unable to export questions: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
