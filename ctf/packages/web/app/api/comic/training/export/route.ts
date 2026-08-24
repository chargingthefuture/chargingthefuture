import { NextResponse } from 'next/server';
import { requireComicAdminAccess } from '../../_lib';
import { COMIC_ERROR_CODE } from 'lib/comic/constants';
import {
  exportComicRatedAnswers,
  exportComicTrainingExamples,
  markComicTrainingExamplesExported,
} from 'lib/comic/repository';
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
//
// Downloading also records what it took: every owner-correction row that reached the file and was
// still at 'pending' is flipped to 'exported' with an exported_at stamp, which is what moves the
// admin dashboard's "N awaiting export · N exported" line. The file itself is unchanged by this —
// it is still the whole dataset every time, not a take-once queue; the status only records that a
// row has been downloaded at least once. Pass ?preview=1 to read the file without marking
// anything, e.g. to look at it before a real export run.
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

// What the bookkeeping half of the request did, so the caller is told plainly either way. The file
// is built first and the marking happens after it: if the update fails, the admin still gets the
// full export and a reason for why the counts did not move, rather than a 503 that loses both.
type MarkOutcome = {
  marked: number;
  // Plain-language reason the marking did not happen, or null when it did (or was not asked for).
  skippedReason: string | null;
};

async function markExportedRows(pendingIds: string[], preview: boolean): Promise<MarkOutcome> {
  if (preview) {
    return { marked: 0, skippedReason: 'preview=1 — nothing was marked as exported.' };
  }

  try {
    return { marked: await markComicTrainingExamplesExported(pendingIds), skippedReason: null };
  } catch (error) {
    reportError(error, { area: 'comic', op: 'training_export_mark' });
    const detail = error instanceof Error ? error.message : String(error);
    return {
      marked: 0,
      skippedReason: `The export file is complete, but recording it against the training examples failed, so they still count as awaiting export: ${detail}`,
    };
  }
}

export async function GET(request: Request) {
  const gate = await requireComicAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'yaml';
  const preview = searchParams.get('preview') === '1' || searchParams.get('preview') === 'true';

  try {
    const [examples, ratedAnswers] = await Promise.all([
      exportComicTrainingExamples(),
      exportComicRatedAnswers(),
    ]);
    const grouped = examples.byIntent;
    const totalExamples = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    const mark = await markExportedRows(examples.pendingIds, preview);

    if (format === 'json') {
      return NextResponse.json(
        {
          ok: true,
          totalExamples,
          byIntent: grouped,
          ratedAnswers,
          markedExported: mark.marked,
          markSkippedReason: mark.skippedReason,
        },
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
        'X-Marked-Exported': String(mark.marked),
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
