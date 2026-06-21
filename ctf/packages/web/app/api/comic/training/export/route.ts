import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import { exportComicRatedAnswers, exportComicTrainingExamples } from 'lib/comic/repository';
import type { ComicRatedAnswerExample } from 'lib/comic/types';
import { reportError } from 'lib/observability/report';

// Exports the accumulated @comic training data, which now has two parts:
//   1. Owner corrections — asker questions grouped by the owner-assigned intent label (the
//      `byIntent` map / the YAML `nlu:` block). Unchanged shape; the Rasa NLU service was removed
//      2026-06-14 but this YAML form is kept as a portable training file for whatever model is
//      trained later.
//   2. Rated answers — every answered turn paired with its question text, the published answer text,
//      and the most-recent helpful / not_helpful / flagged rating + when it was rated. This is the
//      human feedback signal. It is DE-IDENTIFIED: no user id and no other PII is included.
// Both parts are admin-gated (the same gate as before). JSON returns both under one object; the YAML
// download keeps the NLU block and appends the rated answers as YAML comments so the file stays a
// valid training file while still carrying the feedback signal for review.
function escapeTrainingExample(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&').replace(/\n/g, ' ').trim();
}

function buildTrainingNluYaml(
  grouped: Record<string, string[]>,
  ratedAnswers: ComicRatedAnswerExample[],
): string {
  const lines: string[] = ['version: "3.1"', 'nlu:'];

  for (const intent of Object.keys(grouped).sort()) {
    const examples = grouped[intent];
    if (examples.length === 0) {
      continue;
    }

    lines.push(`- intent: ${intent}`);
    lines.push('  examples: |');
    for (const example of examples) {
      lines.push(`    - ${escapeTrainingExample(example)}`);
    }
  }

  // Append the human feedback signal as YAML comments so the file remains a valid NLU training file
  // while still carrying every rated answer (question + answer + rating + when it was rated). A
  // fine-tuning run can read these or use the JSON shape (?format=json) for structured access.
  lines.push('');
  lines.push(`# rated_answers (${ratedAnswers.length}) — human feedback signal, de-identified`);
  for (const rated of ratedAnswers) {
    const question = rated.question.replace(/\n/g, ' ').trim();
    const answer = rated.answer.replace(/\n/g, ' ').trim();
    lines.push(`# - rating: ${rated.rating} | rated_at: ${rated.ratedAtIso}`);
    lines.push(`#   question: ${question}`);
    lines.push(`#   answer: ${answer}`);
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
    const [grouped, ratedAnswers] = await Promise.all([
      exportComicTrainingExamples(),
      exportComicRatedAnswers(),
    ]);
    const totalExamples = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

    if (format === 'json') {
      return NextResponse.json(
        { ok: true, totalExamples, byIntent: grouped, ratedAnswers },
        { status: 200 },
      );
    }

    const yaml = buildTrainingNluYaml(grouped, ratedAnswers);
    return new Response(yaml, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="comic-nlu-${new Date().toISOString().slice(0, 10)}.yml"`,
        'X-Total-Examples': String(totalExamples),
        'X-Rated-Answers': String(ratedAnswers.length),
      },
    });
  } catch (error) {
    reportError(error, { area: 'comic', op: 'training_export' });
    return NextResponse.json(
      { ok: false, code: COMIC_ERROR_CODE.persistenceUnavailable, message: 'Unable to export training examples.' },
      { status: 503 },
    );
  }
}
