// Turns each step's narration into a WAV file and measures it.
//
// DEMO_TTS=piper (the default) speaks with Piper, the open-source voice that runs on the runner
// itself: no account, no API credit, no text leaving the machine. PIPER_BIN and PIPER_MODEL say
// where it is. DEMO_TTS=tone writes a quiet tone the length the sentence would take to speak, so
// timing, captions and assembly can be checked on a machine without a voice installed.
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const WORDS_PER_SECOND = 2.6;

export function audioSeconds(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
    encoding: 'utf8',
  });
  const seconds = Number.parseFloat(out.trim());
  if (!Number.isFinite(seconds)) {
    throw new Error(`ffprobe could not read the length of ${file}; it printed "${out.trim()}".`);
  }
  return seconds;
}

function speakWithPiper(text, file) {
  const bin = process.env.PIPER_BIN || 'piper';
  const model = process.env.PIPER_MODEL;
  if (!model) {
    throw new Error('PIPER_MODEL is not set. Point it at a Piper voice (.onnx), or set DEMO_TTS=tone to test without a voice.');
  }
  const args = bin.endsWith('python') || bin.endsWith('python3') ? ['-m', 'piper', '-m', model, '-f', file] : ['-m', model, '-f', file];
  const result = spawnSync(bin, args, { input: text, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Piper failed on "${text.slice(0, 60)}": ${(result.stderr || result.error?.message || '').trim()}`);
  }
}

function writeTone(text, file) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(1, words / WORDS_PER_SECOND).toFixed(2);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`, '-af', 'volume=0.05', file]);
}

// Returns one entry per step: { file, seconds }. `speak` overrides `say` for the voice only, for
// names the voice mispronounces; the captions always show `say`.
export function narrateSteps(steps, workDir) {
  const engine = process.env.DEMO_TTS || 'piper';
  return steps.map((step, index) => {
    const file = join(workDir, `step-${String(index + 1).padStart(2, '0')}.wav`);
    const text = step.speak || step.say;
    if (engine === 'tone') writeTone(text, file);
    else if (engine === 'piper') speakWithPiper(text, file);
    else throw new Error(`DEMO_TTS="${engine}" is not a voice this recorder knows; use piper or tone.`);
    return { file, seconds: audioSeconds(file) };
  });
}
