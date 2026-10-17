// Joins the silent screen recording, the narration clips and the captions into one MP4.
//
// Each narration clip is placed at the moment its step finished on screen, so the voice describes
// what is already visible. Captions are burned into the picture, because most places a short clip is
// posted play it muted and ignore a separate caption file; the .vtt is written beside it as well for
// players that take one.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

function stamp(seconds, separator) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s}${separator}${String(ms % 1000).padStart(3, '0')}`;
}

// A step's narration can run to a few sentences; one caption per sentence keeps each one short
// enough to read on a phone. Sentences share the step's time in proportion to their length.
export function buildCues(cues) {
  const out = [];
  for (const { text, start, seconds } of cues) {
    const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
    const total = sentences.reduce((sum, s) => sum + s.length, 0);
    let at = start;
    for (const sentence of sentences) {
      const length = (sentence.length / total) * seconds;
      out.push({ text: sentence, start: at, end: at + length });
      at += length;
    }
  }
  return out;
}

export function writeCaptions(cues, dir, slug) {
  const srt = cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n');
  const vtt = `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`;
  const srtFile = join(dir, `${slug}.srt`);
  const vttFile = join(dir, `${slug}.vtt`);
  writeFileSync(srtFile, srt);
  writeFileSync(vttFile, vtt);
  return { srtFile, vttFile };
}

export function assemble({ video, narration, srtFile, output, seconds }) {
  const inputs = ['-i', video];
  const delays = [];
  narration.forEach(({ file, start }, i) => {
    inputs.push('-i', file);
    const ms = Math.round(start * 1000);
    delays.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`);
  });
  const mix = `${narration.map((_, i) => `[a${i}]`).join('')}amix=inputs=${narration.length}:normalize=0,apad=whole_dur=${seconds.toFixed(2)}[aud]`;
  // The subtitles filter takes a path inside a filter string, where : and ' are syntax.
  const subs = srtFile.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const style = 'FontName=DejaVu Sans,FontSize=10,Outline=1,Shadow=0,BorderStyle=3,BackColour=&H80000000,MarginV=40';
  const filter = `${delays.join(';')};${mix};[0:v]scale=iw*2:ih*2:flags=lanczos,subtitles='${subs}':force_style='${style}',format=yuv420p[vid]`;
  execFileSync(
    'ffmpeg',
    [
      '-v', 'error', '-y', ...inputs,
      '-filter_complex', filter,
      '-map', '[vid]', '-map', '[aud]',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-t', seconds.toFixed(2), '-movflags', '+faststart',
      output,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
}
